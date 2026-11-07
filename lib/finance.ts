/**
 * Finance: annual cost, capex, payback, NPV and expected disruption cost, design vs baseline.
 * Every dashboard number is returned as a Metric (value + formula + plugged-in inputs).
 *
 *   Annual cost      = normal days × daily cost(normal) + drought days × daily cost(drought) + fixed O&M
 *   Daily cost       = water + surcharge + trucking + discharge + brine + energy + variable O&M + shortage losses
 *   Net savings      = Baseline annual cost − Design annual cost
 *   Payback          = Capex ÷ Net annual savings          (none if savings ≤ 0)
 *   NPV              = Σ_{t=1..N} savings ÷ (1+r)^t − Capex
 *   E[disruption]    = Σ_sources P(outage) × Σ_consumers max(0, outage h − buffer h) × lost $/h
 *   Risk-adjusted    = Net savings + (Baseline E[disruption] − Design E[disruption])
 */

import type { AssumptionKey, AssumptionValues } from "./assumptions";
import { activeBoard } from "./board";
import { buildBaseline } from "./baseline";
import type { Board, BoardNode, Comparison, CostBreakdown, Evaluation, FormulaInput, Metric, MetricUnit, ScenarioId, ScenarioSettings } from "./contract";
import { PIECES } from "./pieces";
import { analyzeBoard, evaluateRules } from "./rules";
import { droughtConditions, riskClassOf, runScenario, type ScenarioParams, type ScenarioRun, truckingPlan } from "./scenarios";
import { type DaySim, NORMAL_CONDITIONS, type SimConditions, simulateDay } from "./simulation";
import { DAYS_PER_MONTH, DAYS_PER_YEAR, HOURS_PER_DAY } from "./units";

// ------------------------------------------------------------------ pure formulas

export function simplePayback(capex: number, annualSavings: number): number | null {
  if (capex <= 0) return null; // nothing to pay back
  if (annualSavings <= 0) return null;
  return capex / annualSavings;
}

const MIN_DISCOUNT_RATE = -0.99;

export function npv(annualSavings: number, rate: number, years: number, capex: number): number {
  const r = Math.max(MIN_DISCOUNT_RATE, rate);
  let total = 0;
  for (let t = 1; t <= Math.max(0, Math.round(years)); t++) total += annualSavings / Math.pow(1 + r, t);
  return total - capex;
}

/**
 * Taiwan's MOEA water consumption fee on piped municipal use above the monthly threshold, per
 * user (consumer). It applies only in the dry season, so the daily figure is averaged over the
 * year: fee-month cost × (season days ÷ 365).
 */
export function dailySurcharge(municipalDrawPerDay: number, v: AssumptionValues, priceMultiplier: number): number {
  const monthly = municipalDrawPerDay * DAYS_PER_MONTH;
  const excess = Math.max(0, monthly - v["policy.surchargeThreshold"]);
  const seasonShare = Math.min(1, Math.max(0, v["policy.surchargeSeasonDays"] / DAYS_PER_YEAR));
  return ((excess * v["policy.surchargeRate"] * priceMultiplier) / DAYS_PER_MONTH) * seasonShare;
}

// ------------------------------------------------------------------ costs

export type DailyCost = Omit<CostBreakdown, "fixedOM" | "total">;

export function dailyCost(board: Board, day: DaySim, v: AssumptionValues, settings: ScenarioSettings, priceMultiplier: number, elecMultiplier: number): DailyCost {
  const water = day.sources.reduce((sum, s) => sum + s.base * v[s.priceKey] * priceMultiplier, 0);
  const surcharge = settings.surchargeEnabled ? day.consumers.reduce((sum, c) => sum + dailySurcharge(c.municipalDraw, v, priceMultiplier), 0) : 0;
  const trucking = truckingPlan(day.totals.trucked, v).cost;
  const discharge = day.totals.discharge * v["price.discharge"] * priceMultiplier;
  const brine = day.totals.brine * v["price.brine"] * priceMultiplier;
  const energy = day.totals.energyKwh * v["price.electricity"] * elecMultiplier;
  const variableOM = board.nodes.reduce((sum, n) => {
    const key = PIECES[n.type].treatment?.varcostKey;
    return key ? sum + (day.produced[n.id] ?? 0) * v[key] : sum;
  }, 0);
  // Buildings with a downtime cost lose production; the rest (fire tank, cooling makeup) are
  // valued at what it would cost to truck the missing water in, so leaving them dry never "saves" money.
  const truckUnitCost = v["truck.capacity"] > 0 ? v["truck.tripCost"] / v["truck.capacity"] : 0;
  const shortage = day.consumers.reduce(
    (sum, c) => sum + c.lostPerHour * HOURS_PER_DAY + (c.downtimeValued ? 0 : c.unmet * truckUnitCost),
    0,
  );
  return { water, surcharge, trucking, discharge, brine, energy, variableOM, shortage };
}

function sumDaily(d: DailyCost): number {
  return d.water + d.surcharge + d.trucking + d.discharge + d.brine + d.energy + d.variableOM + d.shortage;
}

export function fixedOM(board: Board, v: AssumptionValues): number {
  return activeBoard(board).nodes.reduce((sum, n) => sum + (PIECES[n.type].omKey ? v[PIECES[n.type].omKey as AssumptionKey] : 0), 0);
}

export function capexOf(board: Board, v: AssumptionValues): number {
  return activeBoard(board).nodes.reduce((sum, n) => sum + (!n.existing && PIECES[n.type].capexKey ? v[PIECES[n.type].capexKey as AssumptionKey] : 0), 0);
}

// ------------------------------------------------------------------ disruption risk

export interface DisruptionLine {
  sourceId: string;
  probability: number;
  outageHours: number;
  /** Σ over consumers of max(0, hours − buffer) × extra lost $/h. */
  lostPerEvent: number;
  expected: number;
}

function downstream(analysis: ReturnType<typeof analyzeBoard>, start: string): Set<string> {
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length) {
    const id = stack.pop() as string;
    for (const e of analysis.validOut[id] ?? []) {
      const k = analysis.edges[e.id]?.kind;
      if ((k === "supply" || k === "cooling") && !seen.has(e.to)) {
        seen.add(e.to);
        stack.push(e.to);
      }
    }
  }
  return seen;
}

/** Hours of storage buffer protecting `consumer` against an outage of `source`. */
function bufferHours(board: Board, v: AssumptionValues, analysis: ReturnType<typeof analyzeBoard>, normal: DaySim, sourceId: string, consumerId: string): number {
  const fromSource = downstream(analysis, sourceId);
  let hours = 0;
  for (const n of board.nodes) {
    const volKey = PIECES[n.type].storageVolumeKey;
    if (!volKey || !fromSource.has(n.id)) continue;
    const served = downstream(analysis, n.id);
    if (!served.has(consumerId)) continue;
    const servedDemand = [...served].reduce((sum, id) => sum + (normal.nodes[id]?.demand ?? 0), 0);
    if (servedDemand > 0) hours += (v[volKey] / servedDemand) * HOURS_PER_DAY;
  }
  return hours;
}

interface OutageContext {
  /** Share of the year these conditions hold. */
  weight: number;
  conditions: SimConditions;
  /** The undisrupted day under the same conditions. */
  day: DaySim;
}

function lostPerOutage(board: Board, v: AssumptionValues, analysis: ReturnType<typeof analyzeBoard>, normal: DaySim, sourceId: string, hours: number, ctx: OutageContext): number {
  const hit = simulateDay(board, v, { ...ctx.conditions, disabled: new Set([...ctx.conditions.disabled, sourceId]) });
  let lost = 0;
  for (const c of hit.consumers) {
    const before = ctx.day.consumers.find((x) => x.id === c.id)?.lostPerHour ?? 0;
    const extra = Math.max(0, c.lostPerHour - before);
    if (extra > 0) lost += Math.max(0, hours - bufferHours(board, v, analysis, normal, sourceId, c.id)) * extra;
  }
  return lost;
}

/**
 * Expected acute-outage cost. An outage can land on a normal day or a drought day; each is
 * simulated under its own conditions (cuts and trucking apply on drought days) and weighted
 * by its share of the year.
 */
export function expectedDisruption(input: Board, v: AssumptionValues, params: ScenarioParams, run: ScenarioRun, settings: ScenarioSettings): DisruptionLine[] {
  const board = activeBoard(input);
  const analysis = analyzeBoard(board);
  const normal = run.normalDay;
  const droughtShare = params.droughtDays / DAYS_PER_YEAR;
  const contexts: OutageContext[] = [{ weight: 1 - droughtShare, conditions: NORMAL_CONDITIONS, day: normal }];
  if (run.stressDay && droughtShare > 0) {
    contexts.push({ weight: droughtShare, conditions: droughtConditions(normal, params, settings, v), day: run.stressDay });
  }
  const lines: DisruptionLine[] = [];
  for (const n of board.nodes) {
    const def = PIECES[n.type];
    const cls = def.source ? riskClassOf(def.source.cls) : def.role === "reuse" ? "recycled" : null;
    if (!cls || (normal.nodes[n.id]?.outflow ?? 0) <= 0) continue;
    const probability = params.disruptionP[cls];
    const outageHours = params.outageHours[cls];
    if (probability <= 0 || outageHours <= 0) continue;
    const lostPerEvent = contexts.reduce((sum, ctx) => sum + ctx.weight * lostPerOutage(board, v, analysis, normal, n.id, outageHours, ctx), 0);
    lines.push({ sourceId: n.id, probability, outageHours, lostPerEvent, expected: probability * lostPerEvent });
  }
  return lines;
}

// ------------------------------------------------------------------ evaluation

export interface EvaluationDetail extends Evaluation {
  normalDay: DaySim;
  stressDay: DaySim | null;
  run: ScenarioRun;
  dailyNormal: DailyCost;
  dailyStress: DailyCost | null;
  disruption: DisruptionLine[];
}

export function evaluate(input: Board, v: AssumptionValues, settings: ScenarioSettings, scenarioId: ScenarioId = settings.scenarioId): EvaluationDetail {
  const board = activeBoard(input);
  const run = runScenario(board, v, settings, scenarioId);
  const { params } = run;
  const dailyNormal = dailyCost(board, run.normalDay, v, settings, params.priceMultiplier, 1);
  const dailyStress = run.stressDay ? dailyCost(board, run.stressDay, v, settings, params.priceMultiplier, params.droughtElecMultiplier) : null;
  const normalDays = DAYS_PER_YEAR - params.droughtDays;
  const annualOf = (k: keyof DailyCost) => normalDays * dailyNormal[k] + params.droughtDays * (dailyStress?.[k] ?? 0);
  const om = fixedOM(board, v);
  const annual: CostBreakdown = {
    water: annualOf("water"),
    surcharge: annualOf("surcharge"),
    trucking: annualOf("trucking"),
    discharge: annualOf("discharge"),
    brine: annualOf("brine"),
    energy: annualOf("energy"),
    variableOM: annualOf("variableOM"),
    fixedOM: om,
    shortage: annualOf("shortage"),
    total: normalDays * sumDaily(dailyNormal) + params.droughtDays * (dailyStress ? sumDaily(dailyStress) : 0) + om,
  };
  const disruption = expectedDisruption(board, v, params, run, settings);
  return {
    normalDay: run.normalDay,
    stressDay: run.stressDay,
    annual,
    expectedDisruptionCost: disruption.reduce((sum, l) => sum + l.expected, 0),
    capex: capexOf(board, v),
    run,
    dailyNormal,
    dailyStress,
    disruption,
  };
}

// ------------------------------------------------------------------ metrics

function fin(symbol: string, label: string, value: number, unit: MetricUnit | string, assumptionKey?: AssumptionKey): FormulaInput {
  return assumptionKey ? { symbol, label, value, unit, assumptionKey } : { symbol, label, value, unit };
}

function metric(key: string, label: string, value: number | null, unit: MetricUnit, formula: string, inputs: FormulaInput[], note?: string): Metric {
  return note ? { key, label, value, unit, formula, inputs, note } : { key, label, value, unit, formula, inputs };
}

function costInputs(prefix: string, a: CostBreakdown): FormulaInput[] {
  return [
    fin(`${prefix}water`, "Water purchases", a.water, "usd/yr"),
    fin(`${prefix}surcharge`, "Water consumption fee (Nov–Apr)", a.surcharge, "usd/yr", "policy.surchargeRate"),
    fin(`${prefix}trucks`, "Trucked water", a.trucking, "usd/yr", "truck.tripCost"),
    fin(`${prefix}discharge`, "Discharge fees", a.discharge, "usd/yr", "price.discharge"),
    fin(`${prefix}brine`, "Brine disposal", a.brine, "usd/yr", "price.brine"),
    fin(`${prefix}energy`, "Treatment & pumping energy", a.energy, "usd/yr", "price.electricity"),
    fin(`${prefix}varOM`, "Variable O&M (chemicals, membranes)", a.variableOM, "usd/yr"),
    fin(`${prefix}fixedOM`, "Fixed O&M", a.fixedOM, "usd/yr"),
    fin(`${prefix}shortage`, "Lost production from unmet demand", a.shortage, "usd/yr"),
  ];
}

function capexInputs(board: Board, v: AssumptionValues): FormulaInput[] {
  const byType = new Map<string, { count: number; key: AssumptionKey; name: string }>();
  for (const n of activeBoard(board).nodes as BoardNode[]) {
    const key = PIECES[n.type].capexKey;
    if (n.existing || !key) continue;
    const cur = byType.get(n.type) ?? { count: 0, key, name: PIECES[n.type].name };
    byType.set(n.type, { ...cur, count: cur.count + 1 });
  }
  return [...byType.values()].map((x) => fin(x.name, `${x.count} × ${x.name}`, x.count * v[x.key], "usd", x.key));
}

function exposedShare(day: DaySim): { exposed: number; total: number } {
  const exposed = day.sources.filter((s) => s.mandatedCut).reduce((sum, s) => sum + s.base, 0);
  return { exposed, total: day.totals.withdrawn + day.totals.recycledSupply };
}

export function compare(input: Board, v: AssumptionValues, settings: ScenarioSettings): Comparison {
  const board = activeBoard(input);
  const baselineBoard = buildBaseline(board, v);
  const design = evaluate(board, v, settings);
  const baseline = evaluate(baselineBoard, v, settings);
  const baselineNormal = settings.scenarioId === "normal" ? baseline : evaluate(baselineBoard, v, settings, "normal");
  const baseline2050 = settings.scenarioId === "stress2050" ? baseline : evaluate(baselineBoard, v, settings, "stress2050");

  const r = v["finance.discountRate"];
  const years = v["finance.horizonYears"];
  // Incremental capex: new consumers need conventional plumbing in the do-nothing world too.
  const capex = design.capex - baseline.capex;
  const net = baseline.annual.total - design.annual.total;
  const avoided = baseline.expectedDisruptionCost - design.expectedDisruptionCost;
  const riskAdj = net + avoided;
  const payback = simplePayback(capex, net);
  const scen = design.run.params.label;

  const npvInputs = (s: number, label: string) => [
    fin("S", label, s, "usd/yr"),
    fin("r", "Discount rate", r, "pct", "finance.discountRate"),
    fin("N", "Horizon", years, "years", "finance.horizonYears"),
    fin("Capex", "Capex", capex, "usd"),
  ];

  const share = exposedShare(design.normalDay);
  const risk = share.total > 0 ? (100 * share.exposed) / share.total : 0;
  const trucked = design.stressDay?.totals.trucked ?? 0;

  const metrics: Comparison["metrics"] = {
    netAnnualSavings: metric("netAnnualSavings", "Net annual savings", net, "usd/yr", "Net annual savings = Baseline annual cost − Design annual cost", [
      fin("B", `Baseline annual cost (${scen})`, baseline.annual.total, "usd/yr"),
      fin("D", `Design annual cost (${scen})`, design.annual.total, "usd/yr"),
    ], net < 0 ? "Negative: this design costs more per year than doing nothing. Shown honestly." : undefined),
    riskAdjustedSavings: metric("riskAdjustedSavings", "Risk-adjusted savings", riskAdj, "usd/yr", "Risk-adjusted savings = Net annual savings + (Baseline E[disruption] − Design E[disruption])", [
      fin("S", "Net annual savings", net, "usd/yr"),
      fin("Eb", "Baseline expected disruption cost", baseline.expectedDisruptionCost, "usd/yr"),
      fin("Ed", "Design expected disruption cost", design.expectedDisruptionCost, "usd/yr"),
    ]),
    payback: metric("payback", "Simple payback", payback, "years", "Simple payback = Capex ÷ Net annual savings", [
      fin("Capex", "Capex", capex, "usd"),
      fin("S", "Net annual savings", net, "usd/yr"),
    ], payback === null ? (capex <= 0 ? "No new capex, so nothing to pay back." : "No payback: net annual savings are zero or negative. See risk-adjusted savings for the supply-security value.") : undefined),
    npv: metric("npv", `NPV (${years} yr)`, npv(net, r, years, capex), "usd", "NPV = Σ_{t=1..N} S ÷ (1+r)^t − Capex", npvInputs(net, "Net annual savings")),
    npvRiskAdjusted: metric("npvRiskAdjusted", `Risk-adjusted NPV (${years} yr)`, npv(riskAdj, r, years, capex), "usd", "NPV = Σ_{t=1..N} S_risk ÷ (1+r)^t − Capex", npvInputs(riskAdj, "Risk-adjusted savings")),
    capex: metric("capex", "Capex", capex, "usd", "Capex = Σ capex of new design pieces − capex the do-nothing baseline would also spend (existing pieces are sunk)", [
      ...capexInputs(board, v),
      fin("Cb", "Less: conventional plumbing the baseline also needs", -baseline.capex, "usd"),
    ]),
    annualCost: metric("annualCost", "Annual water cost", design.annual.total, "usd/yr", "Annual cost = Σ (normal days × daily cost) + Σ (drought days × drought-day cost) + fixed O&M", [
      fin("days", "Drought days in this scenario", design.run.params.droughtDays, "days/yr"),
      ...costInputs("", design.annual),
    ]),
    waterWithdrawn: metric("waterWithdrawn", "Water withdrawn", design.normalDay.totals.withdrawn, "m3/day", "Withdrawn = Σ source draws (normal day)", [
      fin("Wb", "Baseline withdrawn", baseline.normalDay.totals.withdrawn, "m3/day"),
      ...design.normalDay.sources.map((s) => fin(s.id, `${PIECES[(board.nodes.find((n) => n.id === s.id) as BoardNode).type].name} (${s.id})`, s.base, "m3/day")),
    ]),
    recycledPct: metric("recycledPct", "Recycled share", design.normalDay.totals.recycledPct * 100, "pct", "Recycled % = recycled supply ÷ (recycled supply + withdrawn)", [
      fin("R", "Recycled supply", design.normalDay.totals.recycledSupply, "m3/day"),
      fin("W", "Withdrawn", design.normalDay.totals.withdrawn, "m3/day"),
    ]),
    treatmentEnergy: metric("treatmentEnergy", "Treatment energy", design.normalDay.totals.energyKwh, "kWh/day", "Energy = Σ kWh/m³ × m³ produced (treatment) or pumped (sources)", [
      fin("Eb", "Baseline energy", baseline.normalDay.totals.energyKwh, "kWh/day"),
      fin("price", "Electricity price", v["price.electricity"], "USD/kWh", "price.electricity"),
    ]),
    supplyRisk: metric("supplyRisk", "Supply risk", risk, "score", "Supply risk = 100 × drought-exposed supply (municipal + river) ÷ total supply", [
      fin("X", "Drought-exposed supply", share.exposed, "m3/day"),
      fin("T", "Total supply (withdrawn + recycled)", share.total, "m3/day"),
    ]),
    expectedDisruption: metric("expectedDisruption", "Expected disruption cost", design.expectedDisruptionCost, "usd/yr", "E[disruption] = Σ P(outage) × Σ max(0, outage h − storage buffer h) × lost $/h", design.disruption.map((l) => fin(l.sourceId, `${l.sourceId}: P=${l.probability}, ${l.outageHours} h outage, $/event`, l.lostPerEvent, "usd", undefined))),
    tankersPerDay: metric("tankersPerDay", "Tankers per drought day", design.stressDay?.totals.tankersPerDay ?? 0, "tankers/day", "Tankers/day = ⌈trucked m³ ÷ tanker capacity⌉", [
      fin("T", "Trucked water (drought day)", trucked, "m3/day"),
      fin("cap", "Tanker capacity", v["truck.capacity"], "m³/tanker", "truck.capacity"),
      fin("max", "Max tankers/day", v["truck.maxPerDay"], "tankers/day", "truck.maxPerDay"),
    ]),
    costOfDoingNothing: metric("costOfDoingNothing", `Cost of doing nothing (${scen})`, baseline.annual.total - baselineNormal.annual.total, "usd/yr", "Cost of doing nothing = Baseline annual cost (scenario) − Baseline annual cost (normal year)", [
      fin("Bs", `Baseline, ${scen}`, baseline.annual.total, "usd/yr"),
      fin("Bn", "Baseline, normal year", baselineNormal.annual.total, "usd/yr"),
      fin("tankers", "Baseline tankers per drought day", baseline.stressDay?.totals.tankersPerDay ?? 0, "tankers/day"),
    ]),
    doNothing2050: metric("doNothing2050", "Do nothing until 2050", baseline2050.annual.total - baselineNormal.annual.total, "usd/yr", "Do nothing (2050) = Baseline annual cost (2050 stress) − Baseline annual cost (normal year)", [
      fin("B50", "Baseline, 2050 stress", baseline2050.annual.total, "usd/yr"),
      fin("Bn", "Baseline, normal year", baselineNormal.annual.total, "usd/yr"),
    ]),
  };

  return { design, baseline, metrics, rules: evaluateRules(board) };
}
