/**
 * Constraint engine. Requirements, bridges and explanations are DATA (tables below);
 * the rule functions only read them. Every rule returns a RuleResult:
 * {valid, severity, message, recommendedPieces, reasonText, tierChain}.
 */

import { activeBoard, addEdge, addNode, freeCellNear, nodeById, removeEdge } from "./board";
import type { Board, BoardEdge, BoardNode, EdgeKind, PieceType, RuleResult, Severity, Tier, TierStep } from "./contract";
import { TIER_NAMES } from "./contract";
import { PIECES, pieceDef } from "./pieces";

// ------------------------------------------------------------------ data

export interface TierRequirement {
  minTier: Tier;
  why: string;
}

/** Minimum input tier per piece. Anything not listed accepts any tier. */
export const TIER_REQUIREMENTS: Partial<Record<PieceType, TierRequirement>> = {
  fab: { minTier: 5, why: "chips need ultrapure water; trace salts and ions ruin wafers" },
  neighbor_fab: { minTier: 5, why: "chips need ultrapure water; trace salts and ions ruin wafers" },
  wet: { minTier: 5, why: "wafer rinsing and wet etch need ultrapure water" },
  cmp: { minTier: 5, why: "CMP slurry rinse needs ultrapure water" },
  clean: { minTier: 5, why: "cleanroom humidification and rinse need ultrapure water" },
  upw: { minTier: 4, why: "the UPW plant only polishes; it needs RO- or desal-grade (Tier 4) feed" },
  polish: { minTier: 4, why: "EDI + UV polishing only finishes water; it needs RO- or desal-grade (Tier 4) feed" },
  ro: { minTier: 2, why: "RO membranes clog without filtered feed" },
  tower: { minTier: 2, why: "cooling tower makeup needs filtered water to limit scale and biofouling" },
  chiller: { minTier: 2, why: "chiller makeup needs filtered water to limit scale" },
  evap: { minTier: 2, why: "evaporative cooling needs filtered water to limit scale" },
  neighbor_dc: { minTier: 2, why: "cooling makeup needs filtered water" },
  closed: { minTier: 3, why: "closed-loop liquid cooling needs process-grade water to protect cold plates" },
  office: { minTier: 2, why: "people need potable-grade (filtered) water" },
  gate: { minTier: 2, why: "people need potable-grade (filtered) water" },
  fire: { minTier: 2, why: "fire suppression tanks need filtered water so nozzles don't clog" },
};

/** What each bridging piece does, in plain English. */
export const STEP_EXPLANATIONS: Partial<Record<PieceType, string>> = {
  filter: "A Basic filter removes sediment, bringing raw water up to Tier 2 (Filtered).",
  ro: "An RO unit pushes filtered water through membranes to Tier 4, which covers any Tier 3 need.",
  desal: "Desalination strips dissolved salts, lifting water to Tier 4 (Desalinated/RO). That alone is not ultrapure.",
  polish: "Ultrapure polishing (EDI + UV) removes the last ions and microbes, completing Tier 5.",
};

/** Pieces that perform the Tier 4 -> 5 polishing step. */
const POLISHERS: ReadonlySet<PieceType> = new Set<PieceType>(["polish", "upw"]);

/** Companion pieces added with a recommendation (desal always needs brine disposal). */
export const COMPANIONS: Partial<Record<PieceType, PieceType[]>> = { desal: ["brine"] };

export function requiredTier(type: PieceType): Tier | null {
  const def = PIECES[type];
  if (def.role === "treatment" || def.role === "consumer" || def.role === "storage" || def.role === "junction") {
    return TIER_REQUIREMENTS[type]?.minTier ?? 1;
  }
  return null;
}

/**
 * Pieces that bridge `fromTier` up to `goalTier`.
 * Tier 4+ always goes through Desal (drought-proof), Tier 5 adds Polishing.
 */
export function bridge(fromTier: Tier, goalTier: Tier): PieceType[] {
  const steps: PieceType[] = [];
  let cur: number = fromTier;
  if (goalTier >= 4 && cur < 4) {
    steps.push("desal");
    cur = 4;
  }
  if (goalTier === 3 && cur < 3) {
    if (cur < 2) steps.push("filter");
    steps.push("ro");
    cur = 4;
  }
  if (goalTier === 2 && cur < 2) {
    steps.push("filter");
    cur = 2;
  }
  if (goalTier === 5 && cur < 5) steps.push("polish");
  return steps;
}

// ------------------------------------------------------------------ analysis

export function connectionKind(fromType: PieceType, toType: PieceType): EdgeKind | null {
  const outs = PIECES[fromType].ports.out;
  const ins = PIECES[toType].ports.in;
  return outs.find((k) => ins.includes(k)) ?? null;
}

export interface EdgeAnalysis {
  kind: EdgeKind | null;
  cycle: boolean;
  fromTier: Tier | null;
  required: Tier | null;
  valid: boolean;
}

export interface BoardAnalysis {
  nodeTier: Record<string, Tier | null>;
  edges: Record<string, EdgeAnalysis>;
  /** Valid edges into each node, by kind. */
  validIn: Record<string, BoardEdge[]>;
  validOut: Record<string, BoardEdge[]>;
}

/**
 * Pipes are accepted in the order they were laid; a pipe that would close a loop over pipes
 * already accepted is the cycle edge. So the newest pipe is always the one flagged,
 * regardless of node order.
 */
function findCycleEdges(edges: BoardEdge[]): Set<string> {
  const out = new Map<string, string[]>();
  const cyc = new Set<string>();
  const reaches = (from: string, target: string): boolean => {
    const seen = new Set<string>([from]);
    const stack = [from];
    while (stack.length) {
      const id = stack.pop() as string;
      if (id === target) return true;
      for (const next of out.get(id) ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    return false;
  };
  for (const e of edges) {
    if (reaches(e.to, e.from)) cyc.add(e.id);
    else out.set(e.from, [...(out.get(e.from) ?? []), e.to]);
  }
  return cyc;
}

function topoOrder(nodes: BoardNode[], edges: BoardEdge[]): string[] {
  const indeg = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (const e of edges) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  const queue = nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift() as string;
    order.push(id);
    for (const e of edges) {
      if (e.from !== id) continue;
      const d = (indeg.get(e.to) ?? 0) - 1;
      indeg.set(e.to, d);
      if (d === 0) queue.push(e.to);
    }
  }
  return order;
}

function minTier(tiers: Array<Tier | null>): Tier | null {
  const vals = tiers.filter((t): t is Tier => t !== null);
  return vals.length ? (Math.min(...vals) as Tier) : null;
}

export function analyzeBoard(input: Board): BoardAnalysis {
  const board = activeBoard(input);
  const byId = new Map(board.nodes.map((n) => [n.id, n]));
  const kinds = new Map<string, EdgeKind | null>();
  for (const e of board.edges) {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    kinds.set(e.id, a && b && a.id !== b.id ? connectionKind(a.type, b.type) : null);
  }
  const supplyEdges = board.edges.filter((e) => kinds.get(e.id) === "supply");
  const cycle = findCycleEdges(supplyEdges);
  const dag = supplyEdges.filter((e) => !cycle.has(e.id));

  const nodeTier: Record<string, Tier | null> = {};
  const hasWastewaterIn = (id: string): boolean => board.edges.some((e) => e.to === id && kinds.get(e.id) === "wastewater");

  for (const id of topoOrder(board.nodes, dag)) {
    const node = byId.get(id) as BoardNode;
    const def = PIECES[node.type];
    const inTiers = dag.filter((e) => e.to === id).map((e) => nodeTier[e.from] ?? null);
    if (def.role === "source") nodeTier[id] = def.source?.tier ?? null;
    else if (def.role === "reuse") nodeTier[id] = hasWastewaterIn(id) ? (def.treatment?.outTier ?? null) : null;
    else if (def.role === "treatment") {
      const need = requiredTier(node.type) ?? 1;
      nodeTier[id] = inTiers.some((t) => t !== null && t >= need) ? (def.treatment?.outTier ?? null) : null;
    } else if (def.role === "storage" || def.role === "junction") nodeTier[id] = minTier(inTiers);
    else nodeTier[id] = null;
  }
  for (const n of board.nodes) if (!(n.id in nodeTier)) nodeTier[n.id] = null;

  const edges: Record<string, EdgeAnalysis> = {};
  const validIn: Record<string, BoardEdge[]> = {};
  const validOut: Record<string, BoardEdge[]> = {};
  for (const n of board.nodes) {
    validIn[n.id] = [];
    validOut[n.id] = [];
  }
  for (const e of board.edges) {
    const kind = kinds.get(e.id) ?? null;
    const to = byId.get(e.to);
    const fromTier = nodeTier[e.from] ?? null;
    const required = to ? requiredTier(to.type) : null;
    let valid = kind !== null;
    if (kind === "supply") {
      valid = !cycle.has(e.id) && fromTier !== null && fromTier >= (required ?? 1);
    }
    edges[e.id] = { kind, cycle: cycle.has(e.id), fromTier, required, valid };
    if (valid) {
      validIn[e.to] = [...(validIn[e.to] ?? []), e];
      validOut[e.from] = [...(validOut[e.from] ?? []), e];
    }
  }
  return { nodeTier, edges, validIn, validOut };
}

// ------------------------------------------------------------------ results

function capitalArticle(name: string): string {
  const a = article(name);
  return a[0].toUpperCase() + a.slice(1);
}

function article(name: string): string {
  return /^[aeiou]/i.test(name) ? "an" : "a";
}

function ok(ruleId: string, extra: Partial<RuleResult> = {}): RuleResult {
  return { ruleId, valid: true, severity: "info", message: "Connected.", recommendedPieces: [], reasonText: "", tierChain: [], ...extra };
}

function fail(ruleId: string, severity: Severity, message: string, reasonText: string, extra: Partial<RuleResult> = {}): RuleResult {
  return { ruleId, valid: false, severity, message, reasonText, recommendedPieces: [], tierChain: [], ...extra };
}

/** Walk upstream from a node along its best (highest-tier) valid supply input. */
function upstreamChain(board: Board, analysis: BoardAnalysis, startId: string): TierStep[] {
  const steps: TierStep[] = [];
  const seen = new Set<string>();
  let cur: string | undefined = startId;
  while (cur && !seen.has(cur) && steps.length < 8) {
    seen.add(cur);
    const node = nodeById(board, cur);
    if (!node) break;
    steps.unshift({ label: pieceDef(node.type).name, pieceType: node.type, tier: analysis.nodeTier[cur] ?? null, status: "have" });
    const inputs: BoardEdge[] = (analysis.validIn[cur] ?? []).filter((e) => analysis.edges[e.id]?.kind === "supply");
    const best: BoardEdge | undefined = [...inputs].sort((a, b) => (analysis.nodeTier[b.from] ?? 0) - (analysis.nodeTier[a.from] ?? 0))[0];
    cur = best?.from;
  }
  return steps;
}

interface TierPlan {
  recommended: PieceType[];
  missing: PieceType[];
}

function tierPlan(fromTier: Tier, target: PieceType): TierPlan {
  const need = requiredTier(target) ?? 1;
  if (POLISHERS.has(target)) {
    // Present the full ultrapure train; the target itself does the polishing.
    const recommended = [...bridge(fromTier, 4), "polish" as PieceType];
    return { recommended, missing: recommended.filter((p) => p !== "polish") };
  }
  const recommended = bridge(fromTier, need);
  return { recommended, missing: recommended.filter((p) => p !== target) };
}

function tierViolation(board: Board, analysis: BoardAnalysis, edge: BoardEdge): RuleResult {
  const from = nodeById(board, edge.from) as BoardNode;
  const to = nodeById(board, edge.to) as BoardNode;
  const fromName = pieceDef(from.type).name;
  const toName = pieceDef(to.type).name;
  const t = analysis.nodeTier[from.id] as Tier;
  const need = requiredTier(to.type) as Tier;
  const req = TIER_REQUIREMENTS[to.type];
  const plan = tierPlan(t, to.type);
  const chain: TierStep[] = [
    ...upstreamChain(board, analysis, from.id),
    ...plan.missing.map((p): TierStep => ({ label: pieceDef(p).name, pieceType: p, tier: PIECES[p].treatment?.outTier ?? null, status: "missing" })),
    { label: toName, pieceType: to.type, tier: need, status: "target" },
  ];
  const explain = plan.recommended.map((p) => STEP_EXPLANATIONS[p]).filter(Boolean).join(" ");
  const reasonText =
    `${fromName} delivers Tier ${t} (${TIER_NAMES[t]}). ${toName} needs Tier ${need} (${TIER_NAMES[need]}): ${req?.why ?? "it needs cleaner water"}. ` +
    explain;
  return fail("tier-requirement", "error", `${capitalArticle(fromName)} ${fromName} can't feed ${article(toName)} ${toName}.`, reasonText.trim(), {
    recommendedPieces: plan.recommended,
    tierChain: chain,
    edgeId: edge.id,
    from: from.id,
    to: to.id,
  });
}

function kindViolation(from: BoardNode, to: BoardNode, edgeId?: string): RuleResult {
  const a = pieceDef(from.type);
  const b = pieceDef(to.type);
  const extra = { edgeId, from: from.id, to: to.id };
  if (from.id === to.id) return fail("connection-kind", "info", "A piece can't connect to itself.", "Pick a different piece to connect to.", extra);
  if (a.ports.out.length === 0) {
    return fail("connection-kind", "error", "Nothing flows out of that!", `${capitalArticle(a.name)} ${a.name} doesn't send water anywhere. Start your pipe at a water source or treatment unit.`, extra);
  }
  if (b.role === "server") {
    return fail("connection-kind", "error", "No water needed here", `${b.name}s take cooling, not water. Pipe water to a cooling tower or liquid-cooling loop, then link that to the hall.`, extra);
  }
  if (b.sinkKind === "brine") {
    return fail("connection-kind", "error", "Brine only goes one way", "Brine disposal only accepts the salty leftovers from a desalination plant.", extra);
  }
  if (b.ports.in.length === 0) {
    return fail("connection-kind", "error", "No water needed here", `${capitalArticle(b.name)} ${b.name} doesn't take a water pipe.`, extra);
  }
  if (b.role === "reuse" || b.sinkKind === "discharge") {
    return fail("connection-kind", "error", "That pipe carries used water", `${b.name} takes used water from buildings, not supply water. Connect a building's outflow to it.`, extra);
  }
  return fail("connection-kind", "error", "Those pieces don't connect", `${a.name} can't send water to ${b.name}. Water runs from sources, through treatment, to the pieces that use it.`, extra);
}

/** Rule definitions: data with an evaluate function, run over every edge or node. */
interface EdgeRule {
  id: string;
  scope: "edge";
  evaluate: (board: Board, a: BoardAnalysis, edge: BoardEdge) => RuleResult | null;
}
interface NodeRule {
  id: string;
  scope: "node";
  evaluate: (board: Board, a: BoardAnalysis, node: BoardNode) => RuleResult | null;
}

export const RULES: ReadonlyArray<EdgeRule | NodeRule> = [
  {
    id: "connection-kind",
    scope: "edge",
    evaluate: (board, a, e) => {
      if (a.edges[e.id]?.kind) return null;
      const from = nodeById(board, e.from);
      const to = nodeById(board, e.to);
      return from && to ? kindViolation(from, to, e.id) : null;
    },
  },
  {
    id: "supply-loop",
    scope: "edge",
    evaluate: (_b, a, e) =>
      a.edges[e.id]?.cycle
        ? fail("supply-loop", "error", "That pipe makes a loop", "Supply pipes can't loop back on themselves. Use a Recycling loop to reuse water instead.", { edgeId: e.id, from: e.from, to: e.to })
        : null,
  },
  {
    id: "tier-requirement",
    scope: "edge",
    evaluate: (board, a, e) => {
      const ea = a.edges[e.id];
      if (!ea || ea.kind !== "supply" || ea.cycle || ea.fromTier === null) return null;
      return ea.fromTier < (ea.required ?? 1) ? tierViolation(board, a, e) : null;
    },
  },
  {
    id: "no-upstream-water",
    scope: "edge",
    evaluate: (board, a, e) => {
      const ea = a.edges[e.id];
      if (!ea || ea.kind !== "supply" || ea.cycle || ea.fromTier !== null) return null;
      const from = nodeById(board, e.from);
      const name = from ? pieceDef(from.type).name : "That piece";
      return fail("no-upstream-water", "warning", `${name} has no clean water to pass on yet`, `${name} isn't getting valid supply, so nothing flows through this pipe. Feed it first.`, { edgeId: e.id, from: e.from, to: e.to });
    },
  },
  {
    id: "desal-brine",
    scope: "node",
    evaluate: (board, a, n) => {
      if (n.type !== "desal") return null;
      const hasBrine = (a.validOut[n.id] ?? []).some((e) => a.edges[e.id]?.kind === "brine");
      return hasBrine
        ? null
        : fail("desal-brine", "warning", "Desal plant needs brine disposal", "Desalination makes clean water plus a concentrated salty stream (brine). Where will the salty leftovers go? Add Brine disposal and connect it.", { nodeId: n.id, recommendedPieces: ["brine"] });
    },
  },
  {
    id: "consumer-offline",
    scope: "node",
    evaluate: (board, a, n) => {
      const def = PIECES[n.type];
      if (def.role !== "consumer" && def.role !== "server") return null;
      const kind: EdgeKind = def.role === "server" ? "cooling" : "supply";
      const fed = (a.validIn[n.id] ?? []).some((e) => {
        if (a.edges[e.id]?.kind !== kind) return false;
        if (kind === "supply") return true;
        // Cooling only counts if the cooling piece itself has valid supply.
        return (a.validIn[e.from] ?? []).some((x) => a.edges[x.id]?.kind === "supply");
      });
      if (fed) return null;
      const why = def.role === "server" ? "It needs a cooling piece (that itself has water) connected to it." : "Connect a water source through the right treatment.";
      return fail("consumer-offline", "error", `${def.name} is offline`, `${def.name} has no valid ${kind === "cooling" ? "cooling" : "water"} supply. ${why}`, { nodeId: n.id });
    },
  },
  {
    id: "reuse-no-input",
    scope: "node",
    evaluate: (_b, a, n) => {
      const def = PIECES[n.type];
      if (def.role !== "reuse") return null;
      const fed = (a.validIn[n.id] ?? []).some((e) => a.edges[e.id]?.kind === "wastewater");
      return fed ? null : fail("reuse-no-input", "warning", `${def.name} has nothing to treat`, "Connect a building's used-water outflow to it, then pipe its Tier 3 output where it's needed.", { nodeId: n.id });
    },
  },
];

export function evaluateRules(input: Board): RuleResult[] {
  const board = activeBoard(input);
  const analysis = analyzeBoard(board);
  const results: RuleResult[] = [];
  for (const rule of RULES) {
    if (rule.scope === "edge") {
      for (const e of board.edges) {
        const r = rule.evaluate(board, analysis, e);
        if (r) results.push(r);
      }
    } else {
      for (const n of board.nodes) {
        const r = rule.evaluate(board, analysis, n);
        if (r) results.push(r);
      }
    }
  }
  return results;
}

/** Check a proposed pipe before adding it. */
export function checkConnection(input: Board, fromId: string, toId: string): RuleResult {
  const board = activeBoard(input);
  const from = nodeById(board, fromId);
  const to = nodeById(board, toId);
  if (!from || !to) return fail("connection-kind", "info", "Pick two pieces on the board.", "One of those pieces isn't on the board.", { from: fromId, to: toId });
  if (fromId === toId) return kindViolation(from, to);
  if (board.edges.some((e) => e.from === fromId && e.to === toId)) {
    return ok("already-connected", { message: "Already connected.", from: fromId, to: toId });
  }
  const { board: next, id } = addEdge(board, fromId, toId);
  const analysis = analyzeBoard(next);
  const edge = next.edges.find((e) => e.id === id) as BoardEdge;
  for (const rule of RULES) {
    if (rule.scope !== "edge") continue;
    const r = rule.evaluate(next, analysis, edge);
    if (r) return { ...r, edgeId: undefined, from: fromId, to: toId };
  }
  return ok("connection-ok", { from: fromId, to: toId, tierChain: upstreamChain(next, analysis, toId) });
}

/** Missing pieces a result asks for (status "missing" in its chain, or its plain recommendations). */
export function missingPieces(result: RuleResult): PieceType[] {
  const fromChain = result.tierChain.filter((s) => s.status === "missing" && s.pieceType).map((s) => s.pieceType as PieceType);
  return fromChain.length ? fromChain : result.recommendedPieces;
}

/**
 * Insert a result's missing pieces between its endpoints (or next to its node), plus companions
 * such as brine disposal for desal. New pieces are not existing (capex counts).
 */
export function applyRecommendation(input: Board, result: RuleResult): Board {
  let board = input;
  const add = missingPieces(result);
  if (result.ruleId === "desal-brine" && result.nodeId) {
    const desal = nodeById(board, result.nodeId);
    if (!desal) return board;
    const placed = addNode(board, "brine", freeCellNear(board, desal.x + 1, desal.y));
    return addEdge(placed.board, desal.id, placed.id).board;
  }
  const fromId = result.from;
  const toId = result.to;
  const from = fromId ? nodeById(board, fromId) : undefined;
  const to = toId ? nodeById(board, toId) : undefined;
  if (!from || !to || add.length === 0) return board;
  if (result.edgeId) board = removeEdge(board, result.edgeId);
  else {
    const existing = board.edges.find((e) => e.from === from.id && e.to === to.id);
    if (existing) board = removeEdge(board, existing.id);
  }
  let prev = from.id;
  add.forEach((type, i) => {
    const f = (i + 1) / (add.length + 1);
    const placed = addNode(board, type, freeCellNear(board, from.x + (to.x - from.x) * f, from.y + (to.y - from.y) * f));
    board = addEdge(placed.board, prev, placed.id).board;
    for (const companion of COMPANIONS[type] ?? []) {
      const host = nodeById(board, placed.id) as BoardNode;
      const c = addNode(board, companion, freeCellNear(board, host.x, host.y + 1));
      board = addEdge(c.board, placed.id, c.id).board;
    }
    prev = placed.id;
  });
  return addEdge(board, prev, to.id).board;
}
