/**
 * Deterministic explainer used when Claude is unavailable (no key, error, timeout).
 * It builds plain-English text purely from numbers in the AdviseRequest: it never
 * computes a new figure, so it can't contradict the dashboard. Dollars come first.
 */

import { SCENARIO_LABELS, type AdviseRequest, type AdvisorCard, type Metric } from "../contract";
import { formatMetric, formatUsd, formatValue, formatYears } from "./format";

export type Intent = "cutCost" | "drought" | "payback" | "desal" | "recycling" | "summary";

const INTENT_PATTERNS: Array<[Intent, RegExp]> = [
  ["cutCost", /\b(cut|reduce|lower|save|slash|trim)\b.*\b(cost|bill|spend|water|%|percent)/i],
  ["drought", /\b(drought|shortage|disrupt|outage|truck|tanker|risk|dry|rationing|cut-?off)\b/i],
  ["payback", /\b(payback|pay back|roi|return|npv|break.?even|worth it|capex|invest)/i],
  ["desal", /\b(desal|desalination|seawater|sea water|brine)\b/i],
  ["recycling", /\b(recycl|reuse|reclaim|wastewater|circular)/i],
];

/** First matching intent wins; desal/recycling beat the generic cut-cost phrasing. */
export function detectIntent(question: string): Intent {
  const specific = INTENT_PATTERNS.filter(([intent]) => intent === "desal" || intent === "recycling");
  for (const [intent, pattern] of [...specific, ...INTENT_PATTERNS]) {
    if (pattern.test(question)) return intent;
  }
  return "summary";
}

function isNum(metric: Metric): metric is Metric & { value: number } {
  return typeof metric.value === "number" && Number.isFinite(metric.value);
}

function heroLine(req: AdviseRequest): string {
  const { netAnnualSavings, riskAdjustedSavings } = req.comparison.metrics;
  if (!isNum(netAnnualSavings)) return "The engine hasn't computed savings for this design yet.";
  const verb = netAnnualSavings.value >= 0 ? "saves" : "costs an extra";
  const risk = isNum(riskAdjustedSavings)
    ? ` Counting avoided disruption losses, the risk-adjusted figure is ${formatMetric(riskAdjustedSavings)}.`
    : "";
  return `Compared with doing nothing, this design ${verb} ${formatUsd(Math.abs(netAnnualSavings.value))} a year.${risk}`;
}

function paybackLine(req: AdviseRequest): string {
  const { payback, npv, capex } = req.comparison.metrics;
  const capexText = isNum(capex) ? `It needs ${formatMetric(capex)} of upfront capex` : "Upfront capex isn't computed";
  const paybackText = isNum(payback)
    ? `, paid back in ${formatMetric(payback)}`
    : ", and it doesn't pay back under the current assumptions";
  const npvText = isNum(npv) ? ` Net present value: ${formatMetric(npv)}.` : "";
  return `${capexText}${paybackText}.${npvText}`;
}

function droughtLine(req: AdviseRequest): string {
  const { costOfDoingNothing, tankersPerDay, expectedDisruption } = req.comparison.metrics;
  const scenario = SCENARIO_LABELS[req.settings.scenarioId];
  const parts: string[] = [];
  if (isNum(costOfDoingNothing)) {
    parts.push(`In the "${scenario}" scenario, doing nothing costs ${formatMetric(costOfDoingNothing)} more than a normal year.`);
  }
  if (isNum(expectedDisruption)) {
    parts.push(`Expected disruption cost for this design: ${formatMetric(expectedDisruption)}.`);
  }
  if (isNum(tankersPerDay) && tankersPerDay.value > 0) {
    parts.push(`Covering the shortfall by truck takes ${formatMetric(tankersPerDay)}.`);
  }
  return parts.join(" ");
}

function cardLine(card: AdvisorCard, lead: string): string {
  const payback = card.paybackYears === null ? "no payback under current assumptions" : `payback ${formatYears(card.paybackYears)}`;
  const savings =
    card.annualSavings >= 0
      ? `saves ${formatUsd(card.annualSavings)}/yr`
      : `costs ${formatUsd(Math.abs(card.annualSavings))}/yr more in a normal year`;
  return (
    `${lead} "${card.title}": ${savings} ` +
    `(${formatUsd(card.riskAdjustedSavings)}/yr risk-adjusted), capex ${formatUsd(card.capex)}, ${payback}, ` +
    `saves ${formatValue(card.waterSaved, "m3/day")}. ${card.why} Trade-off: ${card.tradeoff}`
  );
}

function allCards(req: AdviseRequest): AdvisorCard[] {
  return req.advisor?.cards ?? [];
}

function topCard(req: AdviseRequest): AdvisorCard | null {
  const cards = allCards(req);
  if (cards.length === 0) return null;
  return cards.reduce((best, card) => (card.riskAdjustedSavings > best.riskAdjustedSavings ? card : best));
}

function findCard(req: AdviseRequest, pieces: string[]): AdvisorCard | null {
  return allCards(req).find((card) => card.pieces.some((piece) => pieces.includes(piece))) ?? null;
}

function hasPiece(req: AdviseRequest, pieces: string[]): boolean {
  return req.board.nodes.some((node) => !node.ghost && pieces.includes(node.type));
}

function violationsLine(req: AdviseRequest): string {
  const broken = req.comparison.rules.filter((rule) => !rule.valid && rule.severity === "error");
  if (broken.length === 0) return "";
  const first = broken[0];
  const more = broken.length > 1 ? " (and other blocking issues on the board)" : "";
  return `Fix first: ${first.message.replace(/[.\s]+$/, "")}${more}. The numbers above assume the board as drawn.`;
}

function cutCostSection(req: AdviseRequest): string {
  const target = req.question.match(/(\d+(?:\.\d+)?)\s*(%|percent)/i);
  const annual = req.comparison.metrics.annualCost;
  const intro = target
    ? `The model doesn't compute a ${target[1]}% target directly; it compares concrete designs.`
    : "Here is where the biggest savings are.";
  const base = isNum(annual) ? ` This design's annual water bill is ${formatMetric(annual)}.` : "";
  const plan = req.advisor?.plan;
  const cards = [...allCards(req)].sort((a, b) => b.annualSavings - a.annualSavings).slice(0, 2);
  const lines = plan ? [cardLine(plan, "Best combined plan")] : cards.map((card, i) => cardLine(card, i === 0 ? "Top move" : "Next"));
  const advice = lines.length > 0 ? ` ${lines.join(" ")}` : " Add recycling or leak detection to the board and the advisor will price them.";
  return `${intro}${base}${advice}`;
}

function desalSection(req: AdviseRequest): string {
  const card = findCard(req, ["desal", "seawater"]);
  const brineRule = req.comparison.rules.find((rule) => !rule.valid && /brine|desal/i.test(rule.message));
  const onBoard = hasPiece(req, ["desal"]) ? "Desalination is on your board." : "There's no desalination on your board yet.";
  const cardText = card ? ` ${cardLine(card, "Advisor option")}` : " The advisor didn't rank a desal option for this site.";
  const ruleText = brineRule ? ` Note: ${brineRule.message}` : "";
  return `${onBoard}${cardText}${ruleText} Desal is drought-proof but energy-heavy and needs brine disposal.`;
}

function recyclingSection(req: AdviseRequest): string {
  const { recycledPct } = req.comparison.metrics;
  const pctText = isNum(recycledPct) ? `This design recycles ${formatMetric(recycledPct)} of its supply.` : "";
  const card = findCard(req, ["recycle", "wwt", "polish"]);
  const cardText = card ? ` ${cardLine(card, "Advisor option")}` : " The advisor has no further recycling option ranked.";
  return `${pctText}${cardText}`.trim();
}

function intentSection(req: AdviseRequest, intent: Intent): string {
  const top = topCard(req);
  switch (intent) {
    case "cutCost":
      return cutCostSection(req);
    case "drought":
      return [droughtLine(req), top ? cardLine(top, "Best hedge") : ""].filter(Boolean).join(" ");
    case "payback":
      return paybackLine(req);
    case "desal":
      return desalSection(req);
    case "recycling":
      return recyclingSection(req);
    case "summary":
      return [paybackLine(req), droughtLine(req), top ? cardLine(top, "Top recommendation") : ""].filter(Boolean).join(" ");
  }
}

export function scriptedAnswer(req: AdviseRequest): string {
  const intent = detectIntent(req.question);
  const sections = [heroLine(req)];
  if (intent !== "payback" && intent !== "summary") sections.push(paybackLine(req));
  sections.push(intentSection(req, intent), violationsLine(req));
  return sections.filter((section) => section.trim().length > 0).join("\n\n");
}
