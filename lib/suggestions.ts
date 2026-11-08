/**
 * Suggestions: better options for designs that already work. Today there is one kind:
 * swap a regular desalination plant for Harmony (batch RO) when everything it feeds needs
 * Tier 3 or less. Every reason is built from engine numbers, not copy.
 */

import type { AssumptionValues } from "./assumptions";
import { activeBoard } from "./board";
import type { Board, BoardNode, PieceType, ScenarioSettings, Suggestion } from "./contract";
import { evaluate } from "./finance";
import { PIECES } from "./pieces";
import { analyzeBoard, evaluateRules, requiredTier } from "./rules";
import { DAYS_PER_YEAR } from "./units";

const MIN_WORTHWHILE_USD = 1;

function usd(x: number): string {
  const abs = Math.abs(x);
  if (abs >= 1e6) return `$${(x / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${Math.round(x / 1e3)}k`;
  return `$${Math.round(x)}`;
}

/** "a", "a and b", "a, b and c" */
function listText(items: string[]): string {
  if (items.length <= 2) return items.join(" and ");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function n(x: number): string {
  return Math.round(x).toLocaleString("en-US");
}

/** Consumers a node feeds through pass-through pieces only (junctions, storage). */
function directConsumers(board: Board, nodeId: string): BoardNode[] {
  const analysis = analyzeBoard(board);
  const seen = new Set<string>();
  const out: BoardNode[] = [];
  const stack = [nodeId];
  while (stack.length) {
    const id = stack.pop() as string;
    for (const e of analysis.validOut[id] ?? []) {
      if (analysis.edges[e.id]?.kind !== "supply" || seen.has(e.to)) continue;
      seen.add(e.to);
      const to = board.nodes.find((x) => x.id === e.to);
      if (!to) continue;
      const role = PIECES[to.type].role;
      if (role === "consumer") out.push(to);
      else if (role === "junction" || role === "storage") stack.push(to.id);
      else return []; // feeds further treatment: its quality is needed downstream
    }
  }
  return out;
}

function violationKeys(board: Board): Set<string> {
  return new Set(evaluateRules(board).filter((r) => r.severity !== "info").map((r) => `${r.ruleId}|${r.nodeId ?? ""}|${r.edgeId ?? ""}`));
}

/** The board with a regular desal plant swapped for Harmony, if everything it feeds needs Tier ≤ 3. */
export function harmonySwapBoard(board: Board, desalId: string): Board | null {
  const consumers = directConsumers(board, desalId);
  if (!consumers.length) return null;
  const maxNeed = Math.max(...consumers.map((c) => requiredTier(c.type) ?? 1));
  return maxNeed <= (PIECES.harmony.treatment?.outTier ?? 3) ? swapType(board, desalId, "harmony") : null;
}

function swapType(board: Board, nodeId: string, to: PieceType): Board {
  return { ...board, nodes: board.nodes.map((x) => (x.id === nodeId ? { ...x, type: to, existing: false } : x)) };
}

function harmonySwap(board: Board, desal: BoardNode, v: AssumptionValues, settings: ScenarioSettings, cur: ReturnType<typeof evaluate>): Suggestion | null {
  const consumers = directConsumers(board, desal.id);
  if (!consumers.length) return null;
  const maxNeed = Math.max(...consumers.map((c) => requiredTier(c.type) ?? 1));
  const harmonyTier = PIECES.harmony.treatment?.outTier ?? 3;
  if (maxNeed > harmonyTier) return null;

  const next = swapType(board, desal.id, "harmony");
  const before = violationKeys(board);
  if ([...violationKeys(next)].some((k) => !before.has(k))) return null;

  const after = evaluate(next, v, settings);
  const annualSavings = cur.annual.total - after.annual.total;
  const riskAdjustedSavings = annualSavings + (cur.expectedDisruptionCost - after.expectedDisruptionCost);
  if (riskAdjustedSavings < MIN_WORTHWHILE_USD) return null;

  const energySaved = cur.normalDay.totals.energyKwh - after.normalDay.totals.energyKwh;
  const brineReduced = cur.normalDay.totals.brine - after.normalDay.totals.brine;
  const produced = after.normalDay.produced[desal.id] ?? 0;
  const membraneSaving = (v["varcost.desal"] - v["varcost.harmony"]) * produced * DAYS_PER_YEAR;
  const energyPct = Math.round((1 - v["harmony.energy"] / v["energy.desal"]) * 100);
  const brinePct = cur.normalDay.totals.brine > 0 ? Math.round((brineReduced / cur.normalDay.totals.brine) * 100) : 0;
  const names = listText([...new Set(consumers.map((c) => PIECES[c.type].name.toLowerCase()))]);
  const needs = new Set(consumers.map((c) => requiredTier(c.type) ?? 1));
  const needText = needs.size > 1 ? `Tier ${maxNeed} or less` : `Tier ${maxNeed}`;

  const reasons = [
    `Right-sized quality: your ${names} ${consumers.length > 1 ? "need" : "needs"} ${needText}. Regular desal makes Tier 4, so you pay for treatment you don't use. Harmony stops at Tier ${harmonyTier}.`,
    `Less energy: batch RO uses about ${energyPct}% less power, ${n(energySaved)} kWh/day.`,
    `Less brine: higher recovery cuts brine by ${brinePct}%, ${n(brineReduced)} m³/day less to dispose of (and less seawater to pump).`,
  ];
  if (membraneSaving > 0) reasons.push(`Lower membrane and chemical cost: backwashing limits scaling, about ${usd(membraneSaving)} a year.`);

  return {
    id: `harmony:${desal.id}`,
    kind: "swap",
    nodeId: desal.id,
    from: "desal",
    to: "harmony",
    title: "Switch to Harmony desalination",
    reasons,
    annualSavings,
    riskAdjustedSavings,
    capexDelta: after.capex - cur.capex,
    energySavedKwhPerDay: energySaved,
    brineReducedM3PerDay: brineReduced,
    board: next,
  };
}

export function suggestions(input: Board, v: AssumptionValues, settings: ScenarioSettings): Suggestion[] {
  const board = activeBoard(input);
  const desals = board.nodes.filter((x) => x.type === "desal");
  if (!desals.length) return [];
  const cur = evaluate(board, v, settings);
  return desals
    .map((d) => harmonySwap(board, d, v, settings, cur))
    .filter((s): s is Suggestion => s !== null)
    .sort((a, b) => b.riskAdjustedSavings - a.riskAdjustedSavings);
}
