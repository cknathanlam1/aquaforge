/**
 * Weak points: what breaks first, judged against a 2021-type drought (whatever scenario the user
 * has selected). Every figure comes from the same simulation and finance code as the dashboard.
 */

import type { AssumptionValues } from "./assumptions";
import { activeBoard } from "./board";
import type { Board, PieceType, ScenarioSettings, WeakPoint } from "./contract";
import { evaluate } from "./finance";
import { PIECES } from "./pieces";
import { evaluateRules } from "./rules";
import { DAYS_PER_YEAR, HOURS_PER_DAY } from "./units";

const EXPOSED_SHARE_HIGH = 0.8;
const EXPOSED_SHARE_FLAG = 0.5;
const WASTEWATER_FLAG_M3 = 1000;

function m3(x: number): string {
  return `${Math.round(x).toLocaleString("en-US")} m³/day`;
}

function usd(x: number): string {
  const abs = Math.abs(x);
  if (abs >= 1e6) return `$${(x / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${Math.round(x / 1e3)}k`;
  return `$${Math.round(x)}`;
}

function nameOf(board: Board, id: string): string {
  const n = board.nodes.find((x) => x.id === id);
  return n ? PIECES[n.type].name : id;
}

export function weakPoints(input: Board, v: AssumptionValues, settings: ScenarioSettings): WeakPoint[] {
  const board = activeBoard(input);
  const points: WeakPoint[] = [];

  const drought = evaluate(board, v, { ...settings, scenarioId: "drought2021" });

  // Buildings with no water at all come first: they're losing production right now.
  const hasSource = board.nodes.some((n) => PIECES[n.type].role === "source");
  for (const r of evaluateRules(board).filter((x) => x.ruleId === "consumer-offline" && x.nodeId)) {
    const id = r.nodeId as string;
    const def = PIECES[(board.nodes.find((n) => n.id === id) ?? { type: "fab" }).type as PieceType];
    const lost = drought.normalDay.nodes[id]?.lostPerHour ?? 0;
    const ultrapure = (def.consumer?.kind === "fab" || def.consumer?.kind === "fabArea");
    points.push({
      id: `offline:${id}`,
      severity: "high",
      title: hasSource ? `${def.name} is offline` : `${def.name} has no water source`,
      detail: (hasSource ? r.reasonText : `Nothing supplies the ${def.name.toLowerCase()}, so it's offline.`) + (lost > 0 ? ` Every hour costs ${usd(lost)} of lost production.` : ""),
      nodeIds: [id],
      annualImpact: null,
      lostPerHour: lost > 0 ? lost : undefined,
      fix: ultrapure
        ? "Add a water source and treat it to ultrapure: a seawater intake into a desalination plant (Tier 4), then ultrapure polishing (Tier 5). The sea can't be cut in a drought, so it also makes the supply chain more resilient. A second, independent source (municipal water through RO) means one outage can't stop production."
        : "Add a water source and the treatment this building needs. Two independent sources mean one drought or outage can't stop it.",
      fixPieces: ultrapure ? ["seawater", "desal", "polish", "brine"] : ["municipal"],
    });
  }
  const normal = drought.normalDay;
  const stress = drought.stressDay;
  const days = drought.run.params.droughtDays;

  // 1. Supply concentrated on drought-exposed sources.
  const exposed = normal.sources.filter((s) => s.mandatedCut && s.base > 0);
  const exposedM3 = exposed.reduce((sum, s) => sum + s.base, 0);
  const totalSupply = normal.totals.withdrawn + normal.totals.recycledSupply;
  const share = totalSupply > 0 ? exposedM3 / totalSupply : 0;
  if (share >= EXPOSED_SHARE_FLAG) {
    const single = normal.sources.filter((s) => s.base > 0).length === 1;
    points.push({
      id: "exposed-supply",
      severity: share >= EXPOSED_SHARE_HIGH ? "high" : "medium",
      title: single ? "Everything hangs on one drought-exposed source" : "Most water depends on drought-exposed sources",
      detail: `${Math.round(share * 100)}% of supply is reservoir or river water, which the government cuts first in a drought (${Math.round(drought.run.params.cut * 100)}% in 2021).`,
      nodeIds: exposed.map((s) => s.id),
      annualImpact: null,
      fix: "Add a second source a drought can't cut: seawater through a desalination plant, or shared reclaimed water from a nearby plant. Recycling your own wastewater also shrinks what the cut applies to.",
      fixPieces: ["seawater", "desal", "nearby", "recycle"],
    });
  }

  // 2. Trucking to cover the cut.
  const dailyStress = drought.dailyStress;
  if (stress && dailyStress && stress.totals.tankersPerDay > 0) {
    const truckingYear = days * dailyStress.trucking;
    points.push({
      id: "trucking",
      severity: "high",
      title: `${stress.totals.tankersPerDay} tanker trips a day in a drought`,
      detail: `Covering the cut with trucks costs ${usd(dailyStress.trucking)} a day for ${days} days: ${usd(truckingYear)} a year.`,
      nodeIds: exposed.map((s) => s.id),
      annualImpact: truckingYear,
      fix: "Make the gap smaller or fill it yourself: a recycling loop cuts the reservoir draw the cut is applied to, and desalination fills the rest at a fraction of the cost of trucked water.",
      fixPieces: ["recycle", "seawater", "desal"],
    });
  }

  // 3. Buildings that still run short when trucks hit their limit.
  for (const c of stress?.consumers ?? []) {
    if (c.unmet <= 0 || c.lostPerHour <= 0) continue;
    if (normal.nodes[c.id]?.status === "offline") continue; // already flagged as having no water
    const yearly = days * c.lostPerHour * HOURS_PER_DAY;
    points.push({
      id: `short:${c.id}`,
      severity: "high",
      title: `${nameOf(board, c.id)} runs short in a drought`,
      detail: `Trucks can't cover the whole cut: ${m3(c.unmet)} short, losing ${usd(c.lostPerHour)} of production an hour.`,
      nodeIds: [c.id],
      annualImpact: yearly,
      lostPerHour: c.lostPerHour,
      fix: "Add supply that doesn't depend on the reservoir (desalination, a nearby plant, or groundwater) so trucks only cover what's left.",
      fixPieces: ["seawater", "desal", "nearby", "well"],
    });
  }

  // 4. Single points of failure for an acute outage.
  for (const line of drought.disruption) {
    if (line.lostPerEvent <= 0) continue;
    points.push({
      id: `outage:${line.sourceId}`,
      severity: line.expected >= 1e6 ? "high" : "medium",
      title: `A ${line.outageHours}-hour ${nameOf(board, line.sourceId)} outage stops production`,
      detail: `No backup supply or storage covers it. One outage costs about ${usd(line.lostPerEvent)}; at a ${Math.round(line.probability * 100)}% yearly chance that's ${usd(line.expected)} a year expected.`,
      nodeIds: [line.sourceId],
      annualImpact: line.expected,
      fix: "Put a storage tank in front of the fab to ride through the outage (each tank holds about a day of supply), or add a second, independent source.",
      fixPieces: ["tank", "seawater", "desal"],
    });
  }

  // 5. Wastewater thrown away.
  const hasReuse = board.nodes.some((n) => PIECES[n.type].role === "reuse");
  const discharged = normal.totals.discharge;
  if (!hasReuse && discharged >= WASTEWATER_FLAG_M3) {
    const dischargePieces = board.nodes.filter((n) => PIECES[n.type].sinkKind === "discharge").map((n) => n.id);
    const sinks = dischargePieces.length ? dischargePieces : board.nodes.filter((n) => PIECES[n.type].role === "consumer").map((n) => n.id);
    const yearlyFees = discharged * v["price.discharge"] * DAYS_PER_YEAR;
    points.push({
      id: "no-reuse",
      severity: "medium",
      title: "Used water goes straight to the sewer",
      detail: `${m3(discharged)} is discharged instead of reused. You pay for it twice: once to buy it, once (${usd(yearlyFees)} a year) to discharge it.`,
      nodeIds: sinks,
      annualImpact: yearlyFees,
      fix: "Pipe the building's wastewater to a recycling loop, and the loop's output back into RO and polishing. You buy less water and discharge less.",
      fixPieces: ["recycle", "ro"],
    });
  }

  // Offline buildings first (they're losing production now), then severity, then dollars.
  const rank = (p: WeakPoint) => (p.id.startsWith("offline:") ? 0 : p.severity === "high" ? 1 : 2);
  return points.sort((a, b) => rank(a) - rank(b) || (b.annualImpact ?? 0) - (a.annualImpact ?? 0));
}
