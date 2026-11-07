/**
 * Boundary validation for POST /api/advise. Hand-rolled (no schema lib in deps):
 * checks shape and caps sizes, then returns a typed AdviseRequest or a friendly error.
 */

import type { AdviseRequest } from "../contract";

export const MAX_QUESTION_CHARS = 500;
export const MAX_BODY_BYTES = 256 * 1024;
const MAX_NODES = 500;
const MAX_EDGES = 1_000;
const MAX_RULES = 300;
const MAX_CARDS = 50;

const SCENARIO_IDS = new Set(["normal", "drought2021", "stress2035", "stress2050"]);
const REQUIRED_METRICS = [
  "netAnnualSavings",
  "riskAdjustedSavings",
  "payback",
  "npv",
  "capex",
  "annualCost",
  "costOfDoingNothing",
  "tankersPerDay",
] as const;

export type ValidationResult = { ok: true; value: AdviseRequest } | { ok: false; error: string };

type Obj = Record<string, unknown>;

function isObj(value: unknown): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumOrNull(value: unknown): boolean {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isFiniteNum(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

function checkMetric(name: string, metric: unknown): string | null {
  if (!isObj(metric)) return `Metric "${name}" is missing or not an object.`;
  if (typeof metric.label !== "string") return `Metric "${name}" needs a text label.`;
  if (typeof metric.unit !== "string") return `Metric "${name}" needs a unit.`;
  if (typeof metric.formula !== "string") return `Metric "${name}" needs a formula.`;
  if (!isNumOrNull(metric.value)) return `Metric "${name}" value must be a number or null.`;
  if (!Array.isArray(metric.inputs)) return `Metric "${name}" inputs must be a list.`;
  const badInput = metric.inputs.some(
    (input) => !isObj(input) || typeof input.label !== "string" || !isFiniteNum(input.value),
  );
  return badInput ? `Metric "${name}" has a malformed input.` : null;
}

function checkComparison(comparison: unknown): string | null {
  if (!isObj(comparison)) return "Missing engine results (comparison).";
  if (!isObj(comparison.metrics)) return "Missing engine metrics.";
  for (const name of REQUIRED_METRICS) {
    const error = checkMetric(name, comparison.metrics[name]);
    if (error) return error;
  }
  for (const [name, metric] of Object.entries(comparison.metrics)) {
    const error = checkMetric(name, metric);
    if (error) return error;
  }
  if (!Array.isArray(comparison.rules) || comparison.rules.length > MAX_RULES) {
    return "Rule results must be a list (at most 300).";
  }
  const badRule = comparison.rules.some(
    (rule) => !isObj(rule) || typeof rule.valid !== "boolean" || typeof rule.message !== "string",
  );
  return badRule ? "A rule result is malformed." : null;
}

function checkCard(card: unknown): boolean {
  if (!isObj(card)) return false;
  const numbers = [card.waterSaved, card.annualSavings, card.riskAdjustedSavings, card.capex, card.npvRiskAdjusted];
  return (
    typeof card.title === "string" &&
    typeof card.why === "string" &&
    typeof card.tradeoff === "string" &&
    Array.isArray(card.pieces) &&
    numbers.every(isFiniteNum) &&
    isNumOrNull(card.paybackYears)
  );
}

function checkAdvisor(advisor: unknown): string | null {
  if (advisor === null) return null;
  if (!isObj(advisor) || !Array.isArray(advisor.cards)) return "Advisor results must be null or have a cards list.";
  if (advisor.cards.length > MAX_CARDS) return "Too many advisor cards.";
  if (!advisor.cards.every(checkCard)) return "An advisor card is malformed.";
  if (advisor.plan !== null && advisor.plan !== undefined && !checkCard(advisor.plan)) {
    return "The advisor plan is malformed.";
  }
  return null;
}

function checkBoardAndSettings(body: Obj): string | null {
  const board = body.board;
  if (!isObj(board) || !Array.isArray(board.nodes) || !Array.isArray(board.edges)) {
    return "Missing board (nodes and edges).";
  }
  if (board.nodes.length > MAX_NODES || board.edges.length > MAX_EDGES) return "Board is too large.";
  if (!board.nodes.every((node) => isObj(node) && typeof node.type === "string")) return "A board piece is malformed.";
  const settings = body.settings;
  if (!isObj(settings) || typeof settings.scenarioId !== "string" || !SCENARIO_IDS.has(settings.scenarioId)) {
    return "Missing or unknown scenario settings.";
  }
  return null;
}

export function validateAdviseRequest(body: unknown): ValidationResult {
  if (!isObj(body)) return { ok: false, error: "Request body must be a JSON object." };
  if (typeof body.question !== "string" || body.question.trim().length === 0) {
    return { ok: false, error: "Please type a question." };
  }
  if (body.question.length > MAX_QUESTION_CHARS) {
    return { ok: false, error: `Please keep the question under ${MAX_QUESTION_CHARS} characters.` };
  }
  const error =
    checkBoardAndSettings(body) ?? checkComparison(body.comparison) ?? checkAdvisor(body.advisor ?? null);
  if (error) return { ok: false, error };
  return {
    ok: true,
    value: { ...(body as unknown as AdviseRequest), question: body.question.trim(), advisor: (body.advisor ?? null) as AdviseRequest["advisor"] },
  };
}
