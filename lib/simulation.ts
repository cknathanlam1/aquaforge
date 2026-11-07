/**
 * Water-balance solver for one representative day.
 *
 * Model (stated assumptions):
 *  - Demand-driven: each consumer pulls its demand upstream through VALID supply pipes only.
 *  - Merit-order dispatch: sources are used in priority rounds (rain/recycled 1, reclaimed 2,
 *    municipal/river 3, groundwater 4, seawater/desal 5, trucked water 6). A cheaper tier of
 *    supply is exhausted site-wide before the next one is touched.
 *  - Treatment loses (1 − recovery) of its feed as reject: to discharge, or to brine for desal.
 *  - Consumers return (1 − consumptive share) as wastewater: to recycling/WWT if piped there,
 *    otherwise to discharge. Recycled supply depends on that wastewater, so the day is solved
 *    as a fixed point.
 *  - Trucked water arrives at mandated-cut sources (municipal/river) and is capped per day.
 *  - Storage and junctions pass water through; storage only matters for outage buffering.
 * Mass balance: withdrawn = consumptive + discharge + brine (checked in tests).
 */

import type { AssumptionKey, AssumptionValues } from "./assumptions";
import { activeBoard } from "./board";
import type { Board, BoardEdge, BoardNode, DayResult, EdgeResult, NodeResult, NodeStatus, WaterTotals } from "./contract";
import { PIECES, type SourceClass } from "./pieces";
import { analyzeBoard } from "./rules";

const EPS = 1e-9;
const MAX_ITERATIONS = 100;
const CONVERGENCE_TOL = 1e-6;
const TRUCK_PRIORITY = 6;
const RECYCLED_PRIORITY = 1;
const PRIORITY_ROUNDS = [1, 2, 3, 4, 5, 6];

export interface SimConditions {
  /** Capacity multiplier per source class (default 1). */
  availability: Partial<Record<SourceClass, number>>;
  /** Max base draw per mandated-cut source node (m³/day), or null for no cut. */
  permitted: Record<string, number> | null;
  /** Total trucked water the site can receive (m³/day). */
  truckingCapacity: number;
  /** Source/reuse node ids knocked out (acute disruption). */
  disabled: ReadonlySet<string>;
  /** Capacity multiplier for energy-intensive treatment (coupling toggle). */
  energyIntensiveAvail: number;
}

export const NORMAL_CONDITIONS: SimConditions = {
  availability: {},
  permitted: null,
  truckingCapacity: 0,
  disabled: new Set<string>(),
  energyIntensiveAvail: 1,
};

export interface SourceDraw {
  id: string;
  cls: SourceClass;
  priceKey: AssumptionKey;
  base: number;
  trucked: number;
  mandatedCut: boolean;
}

export interface ConsumerDay {
  id: string;
  demand: number;
  delivered: number;
  unmet: number;
  lostPerHour: number;
  /** Base (piped) draw from municipal-class sources attributed to this consumer, m³/day. */
  municipalDraw: number;
  /** False for buildings with no downtime cost (fire tank, cooling makeup); finance values their unmet water instead. */
  downtimeValued: boolean;
}

export interface DaySim extends DayResult {
  sources: SourceDraw[];
  consumers: ConsumerDay[];
  /** Product water per treatment/reuse node (for variable opex). */
  produced: Record<string, number>;
}

function val(v: AssumptionValues, key: AssumptionKey | undefined, fallback = 0): number {
  return key ? v[key] : fallback;
}

function recoveryOf(node: BoardNode, v: AssumptionValues): number {
  const t = PIECES[node.type].treatment;
  if (!t) return 1;
  const r = t.brineFractionKey ? 1 - v[t.brineFractionKey] : val(v, t.recoveryKey, 1);
  return Math.min(1, Math.max(EPS, r));
}

/** Site-wide demand multipliers from efficiency pieces. */
function demandMultipliers(board: Board, v: AssumptionValues): { all: number; fab: number } {
  let all = 1;
  let fab = 1;
  for (const n of board.nodes) {
    const eff = PIECES[n.type].efficiency;
    if (!eff) continue;
    const keep = 1 - Math.min(1, Math.max(0, v[eff.reductionKey]));
    if (eff.appliesTo === "all") all *= keep;
    else fab *= keep;
  }
  return { all, fab };
}

export function consumerDemand(node: BoardNode, board: Board, v: AssumptionValues): number {
  const spec = PIECES[node.type].consumer;
  if (!spec?.demandKey) return 0;
  // Efficiency pieces are the user's: they don't cut a neighbor's demand.
  if (PIECES[node.type].group === "nbr") return Math.max(0, v[spec.demandKey]);
  const m = demandMultipliers(board, v);
  const fabMult = spec.kind === "fab" || spec.kind === "fabArea" ? m.fab : 1;
  return Math.max(0, v[spec.demandKey]) * m.all * fabMult;
}

interface DayState {
  sourceBaseLeft: Map<string, number>;
  truckLeft: number;
  capLeft: Map<string, number>;
  inflow: Map<string, number>;
  outflow: Map<string, number>;
  edgeFlow: Map<string, number>;
  base: Map<string, number>;
  trucked: Map<string, number>;
  delivered: Map<string, number>;
  municipal: Map<string, number>;
}

function add(map: Map<string, number>, key: string, amount: number): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}

export function simulateDay(input: Board, v: AssumptionValues, cond: SimConditions = NORMAL_CONDITIONS): DaySim {
  const board = activeBoard(input);
  const analysis = analyzeBoard(board);
  const byId = new Map(board.nodes.map((n) => [n.id, n]));
  const kindOf = (e: BoardEdge) => analysis.edges[e.id]?.kind ?? null;

  const supplyIn = new Map<string, BoardEdge[]>();
  for (const n of board.nodes) supplyIn.set(n.id, (analysis.validIn[n.id] ?? []).filter((e) => kindOf(e) === "supply"));

  // Lowest dispatch priority reachable upstream, used to order a node's inputs.
  const bestPriorityMemo = new Map<string, number>();
  const bestPriority = (id: string): number => {
    const memo = bestPriorityMemo.get(id);
    if (memo !== undefined) return memo;
    const def = PIECES[(byId.get(id) as BoardNode).type];
    let p = Infinity;
    if (def.role === "source" && def.source) p = def.source.priority;
    else if (def.role === "reuse") p = RECYCLED_PRIORITY;
    else for (const e of supplyIn.get(id) ?? []) p = Math.min(p, bestPriority(e.from));
    bestPriorityMemo.set(id, p);
    return p;
  };
  for (const [id, edges] of supplyIn) supplyIn.set(id, [...edges].sort((a, b) => bestPriority(a.from) - bestPriority(b.from)));

  const consumers = board.nodes
    .filter((n) => PIECES[n.type].role === "consumer")
    .map((n) => ({ node: n, demand: consumerDemand(n, board, v) }))
    .sort((a, b) => {
      const da = val(v, PIECES[a.node.type].consumer?.downtimeKey);
      const db = val(v, PIECES[b.node.type].consumer?.downtimeKey);
      return db - da || a.node.id.localeCompare(b.node.id);
    });

  const reuseNodes = board.nodes.filter((n) => PIECES[n.type].role === "reuse");
  const wastewaterOut = new Map<string, BoardEdge[]>();
  for (const n of board.nodes) wastewaterOut.set(n.id, (analysis.validOut[n.id] ?? []).filter((e) => kindOf(e) === "wastewater"));

  const sourceCapacity = (n: BoardNode): number => {
    const spec = PIECES[n.type].source;
    if (!spec || cond.disabled.has(n.id)) return 0;
    let cap = Math.max(0, v[spec.capacityKey]) * (cond.availability[spec.cls] ?? 1);
    if (spec.drought === "mandatedCut" && cond.permitted && n.id in cond.permitted) cap = Math.min(cap, cond.permitted[n.id]);
    return cap;
  };
  const treatmentCapacity = (n: BoardNode): number => {
    const t = PIECES[n.type].treatment;
    if (!t) return 0;
    return Math.max(0, v[t.capacityKey]) * (t.energyIntensive ? cond.energyIntensiveAvail : 1);
  };

  const runDispatch = (wastewaterIn: Map<string, number>): DayState => {
    const s: DayState = {
      sourceBaseLeft: new Map(),
      truckLeft: Math.max(0, cond.truckingCapacity),
      capLeft: new Map(),
      inflow: new Map(),
      outflow: new Map(),
      edgeFlow: new Map(),
      base: new Map(),
      trucked: new Map(),
      delivered: new Map(),
      municipal: new Map(),
    };
    for (const n of board.nodes) {
      const role = PIECES[n.type].role;
      if (role === "source") s.sourceBaseLeft.set(n.id, sourceCapacity(n));
      else if (role === "treatment") s.capLeft.set(n.id, treatmentCapacity(n));
      else if (role === "reuse") {
        const available = cond.disabled.has(n.id) ? 0 : recoveryOf(n, v) * (wastewaterIn.get(n.id) ?? 0);
        s.capLeft.set(n.id, Math.min(treatmentCapacity(n), available));
      }
    }

    let consumerId = "";
    // Nodes that returned nothing this round stay dry for the rest of it (capacity only falls
    // within a round), which keeps diamond-shaped networks from exploding into exponential search.
    let dry = new Set<string>();
    const draw = (id: string, amount: number, p: number): number => {
      if (amount <= EPS || dry.has(id)) return 0;
      const got = drawNode(id, amount, p);
      if (got <= EPS) dry.add(id);
      return got;
    };
    const drawNode = (id: string, amount: number, p: number): number => {
      const node = byId.get(id) as BoardNode;
      const def = PIECES[node.type];
      if (def.role === "source" && def.source) {
        const spec = def.source;
        let taken = 0;
        if (spec.priority <= p) {
          const t = Math.min(s.sourceBaseLeft.get(id) ?? 0, amount);
          s.sourceBaseLeft.set(id, (s.sourceBaseLeft.get(id) ?? 0) - t);
          add(s.base, id, t);
          if (spec.cls === "municipal") add(s.municipal, consumerId, t);
          taken += t;
        }
        if (spec.drought === "mandatedCut" && TRUCK_PRIORITY <= p && taken < amount) {
          const t = Math.min(s.truckLeft, amount - taken);
          s.truckLeft -= t;
          add(s.trucked, id, t);
          taken += t;
        }
        add(s.outflow, id, taken);
        return taken;
      }
      if (def.role === "reuse") {
        if (RECYCLED_PRIORITY > p) return 0;
        const t = Math.min(s.capLeft.get(id) ?? 0, amount);
        s.capLeft.set(id, (s.capLeft.get(id) ?? 0) - t);
        add(s.outflow, id, t);
        return t;
      }
      if (def.role === "treatment") {
        const want = Math.min(amount, s.capLeft.get(id) ?? 0);
        if (want <= EPS) return 0;
        const r = recoveryOf(node, v);
        const got = drawInputs(id, want / r, p);
        const produced = got * r;
        s.capLeft.set(id, (s.capLeft.get(id) ?? 0) - produced);
        add(s.inflow, id, got);
        add(s.outflow, id, produced);
        return produced;
      }
      if (def.role === "storage" || def.role === "junction") {
        const got = drawInputs(id, amount, p);
        add(s.inflow, id, got);
        add(s.outflow, id, got);
        return got;
      }
      return 0;
    };
    const drawInputs = (id: string, amount: number, p: number): number => {
      let remaining = amount;
      for (const e of supplyIn.get(id) ?? []) {
        if (remaining <= EPS) break;
        const got = draw(e.from, remaining, p);
        add(s.edgeFlow, e.id, got);
        remaining -= got;
      }
      return amount - remaining;
    };

    for (const p of PRIORITY_ROUNDS) {
      dry = new Set<string>();
      for (const c of consumers) {
        const left = c.demand - (s.delivered.get(c.node.id) ?? 0);
        if (left <= EPS) continue;
        consumerId = c.node.id;
        const got = drawInputs(c.node.id, left, p);
        add(s.delivered, c.node.id, got);
        add(s.inflow, c.node.id, got);
      }
    }
    return s;
  };

  /** Feed each recycling plant can process per day (its product capacity ÷ recovery). */
  const reuseFeedCap = new Map<string, number>(reuseNodes.map((n) => [n.id, cond.disabled.has(n.id) ? 0 : treatmentCapacity(n) / recoveryOf(n, v)]));

  /**
   * Wastewater fills a consumer's recycling plants up to their feed capacity (spilling to the
   * next plant), and whatever is left goes to its discharge pipes, or the sewer if it has none.
   */
  const routeWastewater = (s: DayState) => {
    const toReuse = new Map<string, number>();
    const edgeFlow = new Map<string, number>();
    const feedLeft = new Map(reuseFeedCap);
    let toDischarge = 0;
    for (const c of consumers) {
      const spec = PIECES[c.node.type].consumer;
      let ww = (s.delivered.get(c.node.id) ?? 0) * (1 - val(v, spec?.consumptiveKey));
      const outs = wastewaterOut.get(c.node.id) ?? [];
      const reuseOuts = outs.filter((e) => PIECES[(byId.get(e.to) as BoardNode).type].role === "reuse");
      const dischargeOuts = outs.filter((e) => !reuseOuts.includes(e));
      for (const e of reuseOuts) {
        const take = Math.min(ww, feedLeft.get(e.to) ?? 0);
        feedLeft.set(e.to, (feedLeft.get(e.to) ?? 0) - take);
        add(toReuse, e.to, take);
        add(edgeFlow, e.id, take);
        ww -= take;
      }
      if (ww <= EPS) continue;
      // Overflow: discharge pipes if any, else the last recycling pipe (its plant bypasses to sewer), else the sewer.
      const spill = dischargeOuts.length ? dischargeOuts : reuseOuts.slice(-1);
      for (const e of spill) add(edgeFlow, e.id, ww / spill.length);
      if (!dischargeOuts.length && reuseOuts.length) add(toReuse, reuseOuts[reuseOuts.length - 1].to, ww);
      else toDischarge += ww;
    }
    return { toReuse, edgeFlow, toDischarge };
  };

  // Fixed point on wastewater reaching recycling plants.
  let wastewaterIn = new Map<string, number>();
  let state = runDispatch(wastewaterIn);
  let routed = routeWastewater(state);
  for (let i = 0; i < MAX_ITERATIONS && reuseNodes.length; i++) {
    const delta = Math.max(0, ...reuseNodes.map((n) => Math.abs((routed.toReuse.get(n.id) ?? 0) - (wastewaterIn.get(n.id) ?? 0))));
    if (delta < CONVERGENCE_TOL && i > 0) break;
    wastewaterIn = routed.toReuse;
    state = runDispatch(wastewaterIn);
    routed = routeWastewater(state);
  }

  // ---------------- accounting ----------------
  const nodes: Record<string, NodeResult> = {};
  const produced: Record<string, number> = {};
  let discharge = routed.toDischarge;
  let brine = 0;
  let energyKwh = 0;
  const brineByDesal = new Map<string, number>();

  for (const n of board.nodes) {
    const def = PIECES[n.type];
    const inflow = state.inflow.get(n.id) ?? 0;
    const outflow = state.outflow.get(n.id) ?? 0;
    let status: NodeStatus = outflow > EPS || inflow > EPS ? "ok" : "idle";
    if (def.role === "source" && def.source) {
      energyKwh += outflow * val(v, def.source.energyKey);
    } else if (def.role === "treatment" && def.treatment) {
      produced[n.id] = outflow;
      energyKwh += outflow * v[def.treatment.energyKey];
      const reject = Math.max(0, inflow - outflow);
      if (def.treatment.reject === "brine") {
        brine += reject;
        brineByDesal.set(n.id, reject);
      } else discharge += reject;
      if (analysis.nodeTier[n.id] === null) status = "invalid";
    } else if (def.role === "reuse" && def.treatment) {
      const wwIn = routed.toReuse.get(n.id) ?? 0;
      const processed = outflow / recoveryOf(n, v);
      produced[n.id] = outflow;
      energyKwh += outflow * v[def.treatment.energyKey];
      discharge += Math.max(0, processed - outflow) + Math.max(0, wwIn - processed);
      nodes[n.id] = { id: n.id, tier: analysis.nodeTier[n.id] ?? null, status, inflow: wwIn, outflow };
      continue;
    }
    nodes[n.id] = { id: n.id, tier: analysis.nodeTier[n.id] ?? null, status, inflow, outflow };
  }

  const consumerDays: ConsumerDay[] = [];
  let consumptive = 0;
  for (const c of consumers) {
    const spec = PIECES[c.node.type].consumer;
    const delivered = state.delivered.get(c.node.id) ?? 0;
    const unmet = Math.max(0, c.demand - delivered);
    const frac = c.demand > EPS ? unmet / c.demand : 0;
    const lostPerHour = frac * val(v, spec?.downtimeKey);
    consumptive += delivered * val(v, spec?.consumptiveKey);
    const status: NodeStatus = c.demand <= EPS ? "ok" : delivered <= EPS ? "offline" : unmet > c.demand * 1e-6 ? "partial" : "ok";
    nodes[c.node.id] = { id: c.node.id, tier: null, status, inflow: delivered, outflow: delivered * (1 - val(v, spec?.consumptiveKey)), demand: c.demand, delivered, unmet, lostPerHour };
    consumerDays.push({ id: c.node.id, demand: c.demand, delivered, unmet, lostPerHour, municipalDraw: state.municipal.get(c.node.id) ?? 0, downtimeValued: Boolean(spec?.downtimeKey) });
  }

  // Server halls: online in proportion to the best-served cooling piece feeding them.
  for (const n of board.nodes) {
    const def = PIECES[n.type];
    if (def.role !== "server") continue;
    const coolers = (analysis.validIn[n.id] ?? []).filter((e) => kindOf(e) === "cooling");
    const served = Math.max(0, ...coolers.map((e) => {
      const r = nodes[e.from];
      return r?.demand ? (r.delivered ?? 0) / r.demand : 0;
    }));
    const lostPerHour = (1 - served) * val(v, def.consumer?.downtimeKey);
    const status: NodeStatus = served >= 1 - 1e-6 ? "ok" : served <= EPS ? "offline" : "partial";
    nodes[n.id] = { id: n.id, tier: null, status, inflow: 0, outflow: 0, lostPerHour };
    consumerDays.push({ id: n.id, demand: 0, delivered: 0, unmet: 0, lostPerHour, municipalDraw: 0, downtimeValued: true });
  }

  const edges: Record<string, EdgeResult> = {};
  for (const e of board.edges) {
    const a = analysis.edges[e.id];
    let flow = state.edgeFlow.get(e.id) ?? routed.edgeFlow.get(e.id) ?? 0;
    if (a?.kind === "brine") {
      const brineOuts = (analysis.validOut[e.from] ?? []).filter((x) => kindOf(x) === "brine");
      flow = (brineByDesal.get(e.from) ?? 0) / Math.max(1, brineOuts.length);
    }
    if (a?.kind === "cooling") flow = 0;
    edges[e.id] = { id: e.id, kind: a?.kind ?? null, valid: a?.valid ?? false, flow, tier: a?.fromTier ?? null };
  }

  const sources: SourceDraw[] = board.nodes
    .filter((n) => PIECES[n.type].role === "source")
    .map((n) => {
      const spec = PIECES[n.type].source as NonNullable<(typeof PIECES)[typeof n.type]["source"]>;
      return { id: n.id, cls: spec.cls, priceKey: spec.priceKey, base: state.base.get(n.id) ?? 0, trucked: state.trucked.get(n.id) ?? 0, mandatedCut: spec.drought === "mandatedCut" };
    });

  const withdrawn = sources.reduce((sum, s) => sum + s.base + s.trucked, 0);
  const trucked = sources.reduce((sum, s) => sum + s.trucked, 0);
  const recycledSupply = reuseNodes.reduce((sum, n) => sum + (produced[n.id] ?? 0), 0);
  const demand = consumers.reduce((sum, c) => sum + c.demand, 0);
  const delivered = consumers.reduce((sum, c) => sum + (state.delivered.get(c.node.id) ?? 0), 0);
  const truckCap = Math.max(EPS, v["truck.capacity"]);

  const totals: WaterTotals = {
    withdrawn,
    recycledSupply,
    recycledPct: withdrawn + recycledSupply > EPS ? recycledSupply / (withdrawn + recycledSupply) : 0,
    consumptive,
    discharge,
    brine,
    demand,
    delivered,
    unmet: Math.max(0, demand - delivered),
    energyKwh,
    trucked,
    tankersPerDay: trucked > EPS ? Math.ceil(trucked / truckCap - 1e-9) : 0,
    massBalanceError: withdrawn - consumptive - discharge - brine,
  };

  return { nodes, edges, totals, sources, consumers: consumerDays, produced };
}
