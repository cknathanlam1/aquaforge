/**
 * Deterministic advisor. Enumerates candidate additions from templates, keeps only those that
 * introduce no rule violation, ranks them by incremental risk-adjusted NPV, then searches small
 * combinations (greedy up to 3 steps, plus all pairs of the top 4) for a best plan.
 */

import type { AssumptionValues } from "./assumptions";
import { activeBoard, addEdge, addNode, freeCellNear, nodeById, removeEdge } from "./board";
import type { AdvisorCard, AdvisorResult, Board, BoardNode, PieceType, RuleResult, ScenarioSettings } from "./contract";
import { evaluate, type EvaluationDetail, npv, simplePayback } from "./finance";
import { PIECES } from "./pieces";
import { evaluateRules, requiredTier } from "./rules";

const MAX_CARDS = 5;
const GREEDY_STEPS = 3;
const PAIR_POOL = 4;

interface Candidate {
  id: string;
  title: string;
  pieces: PieceType[];
  board: Board;
  why: (delta: Delta) => string;
}

interface Delta {
  water: number;
  net: number;
  riskAdj: number;
  capex: number;
  energy: number;
  recycled: number;
}

function fmtM3(x: number): string {
  return `${Math.round(x).toLocaleString("en-US")} m³/day`;
}

// ------------------------------------------------------------------ board queries

function consumersOf(board: Board): BoardNode[] {
  return board.nodes.filter((n) => PIECES[n.type].role === "consumer");
}

function ultrapureConsumers(board: Board): BoardNode[] {
  return consumersOf(board).filter((n) => (requiredTier(n.type) ?? 1) >= 4);
}

function lowTierConsumers(board: Board, maxTier: number): BoardNode[] {
  return consumersOf(board).filter((n) => (requiredTier(n.type) ?? 1) <= maxTier);
}

/** Treatment nodes that accept Tier ≤ 3 feed and output Tier 4 (RO, desal). */
function tier4Feeds(board: Board): BoardNode[] {
  return board.nodes.filter((n) => {
    const t = PIECES[n.type].treatment;
    return PIECES[n.type].role === "treatment" && t?.outTier === 4 && (requiredTier(n.type) ?? 1) <= 3;
  });
}

function polishers(board: Board): BoardNode[] {
  return board.nodes.filter((n) => n.type === "polish" || n.type === "upw");
}

function near(board: Board, ref: BoardNode | undefined, dx: number, dy: number): { x: number; y: number } {
  return freeCellNear(board, (ref?.x ?? 4) + dx, (ref?.y ?? 4) + dy);
}

function connectAll(board: Board, pairs: Array<[string, string]>): Board {
  return pairs.reduce((b, [from, to]) => addEdge(b, from, to).board, board);
}

// ------------------------------------------------------------------ candidate templates

function recycleLoop(board: Board): Candidate | null {
  const feeds = tier4Feeds(board).filter((n) => n.type === "ro");
  const direct = lowTierConsumers(board, 3);
  if (!feeds.length && !direct.length) return null;
  const sources = consumersOf(board).filter((c) => !board.edges.some((e) => e.from === c.id && PIECES[(nodeById(board, e.to) as BoardNode).type].role === "reuse"));
  if (!sources.length) return null;
  const anchor = sources[0];
  const placed = addNode(board, "recycle", near(board, anchor, -2, 1));
  const next = connectAll(placed.board, [
    ...sources.map((c): [string, string] => [c.id, placed.id]),
    ...feeds.map((f): [string, string] => [placed.id, f.id]),
    ...direct.map((c): [string, string] => [placed.id, c.id]),
  ]);
  return {
    id: "recycle",
    title: "Recycling loop",
    pieces: ["recycle"],
    board: next,
    why: (d) => `Reuses ${fmtM3(d.recycled)} of wastewater, cutting outside withdrawal by ${fmtM3(d.water)}.`,
  };
}

function desalBundle(board: Board): Candidate | null {
  if (board.nodes.some((n) => n.type === "desal")) return null;
  const ups = ultrapureConsumers(board);
  const pols = polishers(board);
  if (!ups.length && !pols.length) return null;
  const anchor = pols[0] ?? ups[0];
  const sea = addNode(board, "seawater", near(board, anchor, -4, 4));
  const desal = addNode(sea.board, "desal", near(sea.board, anchor, -2, 3));
  const brine = addNode(desal.board, "brine", near(desal.board, anchor, -2, 5));
  let next = connectAll(brine.board, [
    [sea.id, desal.id],
    [desal.id, brine.id],
  ]);
  const pieces: PieceType[] = ["seawater", "desal", "brine"];
  if (pols.length) next = connectAll(next, pols.map((p): [string, string] => [desal.id, p.id]));
  else {
    const pol = addNode(next, "polish", near(next, anchor, 0, 3));
    next = connectAll(pol.board, [[desal.id, pol.id], ...ups.map((c): [string, string] => [pol.id, c.id])]);
    pieces.push("polish");
  }
  return {
    id: "desal",
    title: "Desal + polishing (seawater)",
    pieces,
    board: next,
    why: () => "Adds a drought-proof Tier 4 supply from seawater that keeps the polishing train running when reservoir water is cut.",
  };
}

function storageFor(board: Board, consumer: BoardNode): Candidate | null {
  const inbound = board.edges.filter((e) => e.to === consumer.id && PIECES[(nodeById(board, e.from) as BoardNode).type].role !== "storage");
  const edge = inbound.find((e) => PIECES[(nodeById(board, e.from) as BoardNode).type].role !== "consumer");
  if (!edge) return null;
  const tank = addNode(removeEdge(board, edge.id), "tank", near(board, consumer, 1, -1));
  const next = connectAll(tank.board, [
    [edge.from, tank.id],
    [tank.id, consumer.id],
  ]);
  return {
    id: `tank:${consumer.id}`,
    title: `Storage tank for ${PIECES[consumer.type].name}`,
    pieces: ["tank"],
    board: next,
    why: () => `Buffers ${PIECES[consumer.type].name} through short supply outages, so a pipeline break doesn't stop production.`,
  };
}

function efficiency(board: Board, type: PieceType): Candidate | null {
  if (board.nodes.some((n) => n.type === type)) return null;
  if (type === "opt" && !consumersOf(board).some((c) => ["fab", "fabArea"].includes(PIECES[c.type].consumer?.kind ?? ""))) return null;
  const placed = addNode(board, type, freeCellNear(board, 7, 0));
  const share = { leak: "every building", meter: "every building", opt: "the fab" }[type as "leak" | "meter" | "opt"] ?? "the site";
  return {
    id: type,
    title: PIECES[type].name,
    pieces: [type],
    board: placed.board,
    why: (d) => `Trims demand in ${share}, saving ${fmtM3(d.water)} of withdrawal for little capex.`,
  };
}

function secondSupplier(board: Board, type: "nearby" | "well"): Candidate | null {
  if (board.nodes.some((n) => n.type === type)) return null;
  const feeds = tier4Feeds(board).filter((n) => n.type === "ro");
  const direct = lowTierConsumers(board, type === "nearby" ? 3 : 2);
  if (!feeds.length && !direct.length) return null;
  const anchor = feeds[0] ?? direct[0];
  const src = addNode(board, type, near(board, anchor, -3, -1));
  let next = src.board;
  let outlet = src.id;
  const pieces: PieceType[] = [type];
  if (type === "well") {
    const f = addNode(next, "filter", near(next, anchor, -2, -1));
    next = addEdge(f.board, src.id, f.id).board;
    outlet = f.id;
    pieces.push("filter");
  }
  next = connectAll(next, [...feeds, ...direct].map((t): [string, string] => [outlet, t.id]));
  return {
    id: type,
    title: type === "nearby" ? "Shared supply from a nearby plant" : "Groundwater backup",
    pieces,
    board: next,
    why: () => type === "nearby" ? "Adds a second supplier of Tier 3 water, so a reservoir cut doesn't fall entirely on trucks." : "Adds a small independent supply that keeps running when reservoir water is cut.",
  };
}

/**
 * The user's own consumers ranked by downtime exposure: a fab's own downtime cost, or for a
 * cooling piece, the downtime of the server halls it cools. Neighbors are excluded (not our capex).
 */
function downtimeExposure(board: Board, c: BoardNode, v: AssumptionValues): number {
  const spec = PIECES[c.type].consumer;
  if (PIECES[c.type].group === "nbr" || !spec) return 0;
  if (spec.kind === "cooling") {
    return board.edges
      .filter((e) => e.from === c.id && PIECES[(nodeById(board, e.to) as BoardNode).type].role === "server")
      .reduce((sum, e) => {
        const key = PIECES[(nodeById(board, e.to) as BoardNode).type].consumer?.downtimeKey;
        return sum + (key ? v[key] : 0);
      }, 0);
  }
  return spec.kind === "fab" || spec.kind === "fabArea" || spec.kind === "datacenter" ? (spec.downtimeKey ? v[spec.downtimeKey] : 0) : 0;
}

const STORAGE_TARGETS = 2;

export function generateCandidates(input: Board, v: AssumptionValues): Candidate[] {
  const board = activeBoard(input);
  const highValue = consumersOf(board)
    .filter((c) => !board.edges.some((e) => e.to === c.id && PIECES[(nodeById(board, e.from) as BoardNode).type].role === "storage"))
    .map((c) => ({ c, exposure: downtimeExposure(board, c, v) }))
    .filter((x) => x.exposure > 0)
    .sort((a, b) => b.exposure - a.exposure)
    .slice(0, STORAGE_TARGETS)
    .map((x) => x.c);
  const list = [
    recycleLoop(board),
    desalBundle(board),
    ...highValue.map((c) => storageFor(board, c)),
    efficiency(board, "leak"),
    efficiency(board, "meter"),
    efficiency(board, "opt"),
    secondSupplier(board, "nearby"),
    secondSupplier(board, "well"),
  ];
  return list.filter((c): c is Candidate => c !== null);
}

// ------------------------------------------------------------------ validation & scoring

function violationKey(r: RuleResult): string {
  return `${r.ruleId}|${r.nodeId ?? ""}|${r.edgeId ?? ""}|${r.from ?? ""}|${r.to ?? ""}`;
}

/** True when the candidate board has no error/warning that the current board doesn't already have. */
export function introducesNoViolation(current: Board, next: Board): boolean {
  const before = new Set(evaluateRules(current).filter((r) => r.severity !== "info").map(violationKey));
  return evaluateRules(next).filter((r) => r.severity !== "info").every((r) => before.has(violationKey(r)));
}

function deltaOf(cur: EvaluationDetail, next: EvaluationDetail): Delta {
  const net = cur.annual.total - next.annual.total;
  return {
    water: cur.normalDay.totals.withdrawn - next.normalDay.totals.withdrawn,
    net,
    riskAdj: net + (cur.expectedDisruptionCost - next.expectedDisruptionCost),
    capex: next.capex - cur.capex,
    energy: next.normalDay.totals.energyKwh - cur.normalDay.totals.energyKwh,
    recycled: next.normalDay.totals.recycledSupply - cur.normalDay.totals.recycledSupply,
  };
}

function tradeoffText(pieces: PieceType[], d: Delta): string {
  const parts = new Set<string>();
  for (const p of pieces) for (const t of PIECES[p].tradeoffs) parts.add(t);
  if (d.energy > 1) parts.add(`+${Math.round(d.energy).toLocaleString("en-US")} kWh/day`);
  if (d.net < 0) parts.add("costs more per year before counting outage risk");
  return [...parts].join(", ") || "minor";
}

function toCard(c: Candidate, d: Delta, v: AssumptionValues): AdvisorCard {
  const r = v["finance.discountRate"];
  const years = v["finance.horizonYears"];
  return {
    id: c.id,
    title: c.title,
    pieces: c.pieces,
    why: c.why(d),
    waterSaved: d.water,
    annualSavings: d.net,
    riskAdjustedSavings: d.riskAdj,
    capex: d.capex,
    paybackYears: simplePayback(d.capex, d.net),
    npvRiskAdjusted: npv(d.riskAdj, r, years, d.capex),
    tradeoff: tradeoffText(c.pieces, d),
    board: c.board,
  };
}

interface Scored {
  candidate: Candidate;
  card: AdvisorCard;
}

function scoreAll(board: Board, cur: EvaluationDetail, v: AssumptionValues, settings: ScenarioSettings): Scored[] {
  return generateCandidates(board, v)
    .filter((c) => introducesNoViolation(board, c.board))
    .map((candidate) => {
      const next = evaluate(candidate.board, v, settings);
      return { candidate, card: toCard(candidate, deltaOf(cur, next), v) };
    })
    .sort((a, b) => b.card.npvRiskAdjusted - a.card.npvRiskAdjusted);
}

function planCard(startEval: EvaluationDetail, steps: Candidate[], finalBoard: Board, v: AssumptionValues, settings: ScenarioSettings): AdvisorCard {
  const pieces = steps.flatMap((s) => s.pieces);
  const plan: Candidate = {
    id: `plan:${steps.map((s) => s.id).join("+")}`,
    title: `Best plan: ${steps.map((s) => s.title).join(" + ")}`,
    pieces,
    board: finalBoard,
    why: (d) => `Together these save ${fmtM3(d.water)} of withdrawal and protect production through droughts and outages.`,
  };
  return toCard(plan, deltaOf(startEval, evaluate(finalBoard, v, settings)), v);
}

export function advise(input: Board, v: AssumptionValues, settings: ScenarioSettings): AdvisorResult {
  const board = activeBoard(input);
  if (consumersOf(board).length === 0) return { cards: [], plan: null };
  const curEval = evaluate(board, v, settings);
  const singles = scoreAll(board, curEval, v, settings);
  const cards = singles.slice(0, MAX_CARDS).map((s) => s.card);

  // Greedy: apply the best positive candidate, re-score, repeat.
  let greedyBoard = board;
  let greedyEval = curEval;
  const greedySteps: Candidate[] = [];
  for (let i = 0; i < GREEDY_STEPS; i++) {
    const best = (i === 0 ? singles : scoreAll(greedyBoard, greedyEval, v, settings))[0];
    if (!best || best.card.npvRiskAdjusted <= 0) break;
    greedySteps.push(best.candidate);
    greedyBoard = best.candidate.board;
    greedyEval = evaluate(greedyBoard, v, settings);
  }

  // Small search: every pair from the top singles.
  let bestPair: { steps: Candidate[]; board: Board; card: AdvisorCard } | null = null;
  const pool = singles.slice(0, PAIR_POOL);
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const second = generateCandidates(pool[i].candidate.board, v).find((c) => c.id === pool[j].candidate.id);
      if (!second || !introducesNoViolation(board, second.board)) continue;
      const steps = [pool[i].candidate, pool[j].candidate];
      const card = planCard(curEval, steps, second.board, v, settings);
      if (!bestPair || card.npvRiskAdjusted > bestPair.card.npvRiskAdjusted) bestPair = { steps, board: second.board, card };
    }
  }

  const greedyCard = greedySteps.length ? planCard(curEval, greedySteps, greedyBoard, v, settings) : null;
  const candidates = [greedyCard, bestPair?.card ?? null].filter((c): c is AdvisorCard => c !== null && c.npvRiskAdjusted > 0);
  const plan = candidates.sort((a, b) => b.npvRiskAdjusted - a.npvRiskAdjusted)[0] ?? null;
  return { cards, plan };
}
