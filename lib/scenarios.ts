/**
 * Scenarios: Normal year / 2021-type drought / 2035 stress / 2050 stress.
 * A scenario year = (365 − droughtDays) normal days + droughtDays stress days.
 * On stress days, mandated-cut sources (municipal, river) may only deliver
 * normal-day draw × (1 − cut); trucked water covers the shortfall up to the site's tanker limit.
 */

import type { AssumptionKey, AssumptionValues } from "./assumptions";
import type { Board, ScenarioId, ScenarioSettings } from "./contract";
import { SCENARIO_LABELS } from "./contract";
import type { SourceClass } from "./pieces";
import { type DaySim, NORMAL_CONDITIONS, type SimConditions, simulateDay } from "./simulation";

export type RiskClass = "municipal" | "groundwater" | "seawater" | "recycled" | "reclaimed";

export const RISK_CLASSES: RiskClass[] = ["municipal", "groundwater", "seawater", "recycled", "reclaimed"];

/** Which acute-outage profile a source class uses (rain has none). */
export function riskClassOf(cls: SourceClass): RiskClass | null {
  if (cls === "municipal" || cls === "surface") return "municipal";
  if (cls === "rain") return null;
  return cls;
}

export interface ScenarioParams {
  id: ScenarioId;
  label: string;
  priceMultiplier: number;
  droughtDays: number;
  cut: number;
  groundwaterAvail: number;
  rainAvail: number;
  disruptionP: Record<RiskClass, number>;
  outageHours: Record<RiskClass, number>;
  /** Drought-day electricity multiplier (1 unless coupling is on). */
  droughtElecMultiplier: number;
  /** Drought-day capacity factor for energy-intensive treatment (1 unless coupling is on). */
  energyIntensiveAvail: number;
}

function key(s: string): AssumptionKey {
  return s as AssumptionKey;
}

export function scenarioParams(v: AssumptionValues, settings: ScenarioSettings, id: ScenarioId = settings.scenarioId): ScenarioParams {
  const cutKey = id === "drought2021" && settings.cutLevel === "escalated" ? "scenario.drought2021.cutEscalated" : `scenario.${id}.cut`;
  const disruptionP = {} as Record<RiskClass, number>;
  const outageHours = {} as Record<RiskClass, number>;
  for (const rc of RISK_CLASSES) {
    disruptionP[rc] = clamp01(v[key(`risk.p.${rc}.${id}`)]);
    outageHours[rc] = Math.max(0, v[key(`risk.hours.${rc}`)]);
  }
  return {
    id,
    label: SCENARIO_LABELS[id],
    priceMultiplier: Math.max(0, v[key(`scenario.${id}.priceMultiplier`)]),
    droughtDays: Math.min(365, Math.max(0, Math.round(v[key(`scenario.${id}.droughtDays`)]))),
    cut: clamp01(v[key(cutKey)]),
    groundwaterAvail: clamp01(v[key(`scenario.${id}.groundwaterAvail`)]),
    rainAvail: clamp01(v["rain.droughtAvail"]),
    disruptionP,
    outageHours,
    droughtElecMultiplier: settings.couplingEnabled ? Math.max(0, v["coupling.elecMultiplier"]) : 1,
    energyIntensiveAvail: settings.couplingEnabled ? clamp01(v["coupling.energyIntensiveAvail"]) : 1,
  };
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** Permitted withdrawal under a mandated cut. */
export function permittedWithdrawal(normalDraw: number, cut: number): number {
  return Math.max(0, normalDraw) * (1 - clamp01(cut));
}

export interface TruckingPlan {
  tankers: number;
  cost: number;
}

/** Tankers/day = ⌈shortfall ÷ tanker capacity⌉; cost = tankers × trip cost. */
export function truckingPlan(shortfallM3: number, v: AssumptionValues): TruckingPlan {
  const cap = v["truck.capacity"];
  if (shortfallM3 <= 0 || cap <= 0) return { tankers: 0, cost: 0 };
  const tankers = Math.ceil(shortfallM3 / cap - 1e-9);
  return { tankers, cost: tankers * v["truck.tripCost"] };
}

export function droughtConditions(normalDay: DaySim, params: ScenarioParams, settings: ScenarioSettings, v: AssumptionValues): SimConditions {
  const permitted: Record<string, number> = {};
  for (const s of normalDay.sources) if (s.mandatedCut) permitted[s.id] = permittedWithdrawal(s.base, params.cut);
  return {
    availability: { groundwater: params.groundwaterAvail, rain: params.rainAvail },
    permitted,
    truckingCapacity: settings.truckingEnabled ? Math.max(0, v["truck.maxPerDay"]) * Math.max(0, v["truck.capacity"]) : 0,
    disabled: new Set<string>(),
    energyIntensiveAvail: params.energyIntensiveAvail,
  };
}

export interface ScenarioRun {
  params: ScenarioParams;
  normalDay: DaySim;
  stressDay: DaySim | null;
}

export function runScenario(board: Board, v: AssumptionValues, settings: ScenarioSettings, id: ScenarioId = settings.scenarioId): ScenarioRun {
  const params = scenarioParams(v, settings, id);
  const normalDay = simulateDay(board, v, NORMAL_CONDITIONS);
  const stressDay = params.droughtDays > 0 ? simulateDay(board, v, droughtConditions(normalDay, params, settings, v)) : null;
  return { params, normalDay, stressDay };
}
