/**
 * SHARED CONTRACT between the engine (lib/*, workstream A) and its consumers
 * (UI in app/ + components/, workstream B; advise API in app/api/advise, workstream D).
 *
 * Rules for every workstream:
 *  - Do not change these shapes without coordinating; add optional fields only.
 *  - The engine implements `EngineApi` in lib/engine.ts. Until it lands, consumers may use
 *    a local mock that returns these shapes (keep mocks out of lib/).
 *  - All money is USD (convert at display time with fx.twdPerUsd). All volumes are m³/day unless named otherwise.
 */

import type { AssumptionKey, AssumptionValues } from "./assumptions";

// ---------- Pieces (ids match the Claude Design wireframe's T table, plus a few additions) ----------

export const PIECE_TYPES = [
  // water sources
  "municipal", "river", "well", "rain", "seawater", "desal", "harmony", "nearby",
  // treatment
  "filter", "softener", "ro", "wwt", "recycle", "polish", "brine",
  // semiconductor fab
  "fab", "clean", "wet", "cmp", "upw", "chem",
  // data center campus
  "datacenter", "server", "server2", "tower", "chiller", "evap", "closed", "tank",
  "gen", "ups", "sub", "net", "fire", "gate", "office",
  // efficiency
  "leak", "meter", "opt",
  // connectors / sinks
  "valve", "pump", "discharge",
  // neighbors
  "neighbor_fab", "neighbor_dc",
] as const;

export type PieceType = (typeof PIECE_TYPES)[number];

/** Palette groups, in display order (wireframe CATS + neighbors). */
export type PaletteGroup = "src" | "trt" | "fab" | "dc" | "eff" | "con" | "nbr";

export type Tier = 1 | 2 | 3 | 4 | 5;

export const TIER_NAMES: Record<Tier, string> = {
  1: "Raw",
  2: "Filtered",
  3: "Process-grade",
  4: "Desalinated/RO",
  5: "Ultrapure",
};

/** Catalog entry as exposed to the UI (engine owns the full definition in lib/pieces.ts). */
export interface PieceInfo {
  type: PieceType;
  name: string;
  group: PaletteGroup;
  description: string;
  /** Tier this piece outputs (sources/treatment), null if it outputs no supply water. */
  outputTier: Tier | null;
  /** Minimum input tier it needs, null if it takes no supply water. */
  requiredTier: Tier | null;
  capexKey?: AssumptionKey;
  omKey?: AssumptionKey;
  tradeoffs: string[];
}

// ---------- Board ----------

export interface BoardNode {
  id: string;
  type: PieceType;
  /** Isometric grid cell. */
  x: number;
  y: number;
  /** Pre-existing facility: no capex counted. Preset pieces are existing; user-added pieces are not. */
  existing: boolean;
  /** AI-suggested, not yet accepted. Ghost nodes are ignored by the engine. */
  ghost?: boolean;
}

/** A pipe. Its kind is inferred by the engine from the two pieces. */
export interface BoardEdge {
  id: string;
  from: string;
  to: string;
}

export interface Board {
  nodes: BoardNode[];
  edges: BoardEdge[];
}

export type EdgeKind = "supply" | "wastewater" | "brine" | "cooling" | "efficiency";

// ---------- Scenario settings ----------

export type ScenarioId = "normal" | "drought2021" | "stress2035" | "stress2050";

export const SCENARIO_LABELS: Record<ScenarioId, string> = {
  normal: "Normal year",
  drought2021: "2021-type drought",
  stress2035: "2035 stress",
  stress2050: "2050 stress",
};

export interface ScenarioSettings {
  scenarioId: ScenarioId;
  /** 2021 drought: "initial" = 11% cut, "escalated" = 15% cut. */
  cutLevel: "initial" | "escalated";
  truckingEnabled: boolean;
  surchargeEnabled: boolean;
  /** Energy-water coupling (drought blackouts). Off by default. */
  couplingEnabled: boolean;
}

export const DEFAULT_SETTINGS: ScenarioSettings = {
  scenarioId: "normal",
  cutLevel: "initial",
  truckingEnabled: true,
  surchargeEnabled: true,
  couplingEnabled: false,
};

/** The whole serializable scenario (JSON import/export and URL hash). */
export interface ScenarioFile {
  version: 1;
  name: string;
  board: Board;
  settings: ScenarioSettings;
  /** Only keys the user changed. */
  assumptionOverrides: Partial<Record<AssumptionKey, number>>;
}

// ---------- Rules ----------

export type Severity = "error" | "warning" | "info";

export interface TierStep {
  label: string;
  pieceType?: PieceType;
  tier: Tier | null;
  /** have = already on the path, missing = recommended addition, target = the piece being fed. */
  status: "have" | "missing" | "target";
}

export interface RuleResult {
  ruleId: string;
  valid: boolean;
  severity: Severity;
  /** Friendly one-liner (popup title/body). */
  message: string;
  recommendedPieces: PieceType[];
  /** Plain-English why. */
  reasonText: string;
  tierChain: TierStep[];
  nodeId?: string;
  edgeId?: string;
  /** For a proposed connection: the two endpoints. */
  from?: string;
  to?: string;
}

// ---------- Simulation & finance results ----------

export type NodeStatus = "ok" | "offline" | "partial" | "idle" | "invalid";

export interface NodeResult {
  id: string;
  tier: Tier | null;
  status: NodeStatus;
  inflow: number;
  outflow: number;
  /** Consumers only. */
  demand?: number;
  delivered?: number;
  unmet?: number;
  /** USD/hour of lost production while short (consumers only). */
  lostPerHour?: number;
}

export interface EdgeResult {
  id: string;
  kind: EdgeKind | null;
  valid: boolean;
  /** m³/day; drives droplet animation speed/thickness. */
  flow: number;
  tier: Tier | null;
}

export interface WaterTotals {
  withdrawn: number;
  recycledSupply: number;
  recycledPct: number;
  consumptive: number;
  discharge: number;
  brine: number;
  demand: number;
  delivered: number;
  unmet: number;
  energyKwh: number;
  trucked: number;
  tankersPerDay: number;
  massBalanceError: number;
}

export interface DayResult {
  nodes: Record<string, NodeResult>;
  edges: Record<string, EdgeResult>;
  totals: WaterTotals;
}

export type MetricUnit = "usd" | "usd/yr" | "years" | "m3/day" | "pct" | "kWh/day" | "tankers/day" | "score";

export interface FormulaInput {
  symbol: string;
  label: string;
  value: number;
  unit: MetricUnit | string;
  /** Assumption that feeds this input, so the "show your work" panel can link to it. */
  assumptionKey?: AssumptionKey;
}

/** Every number on the dashboard is a Metric: value + the formula with inputs plugged in. */
export interface Metric {
  key: string;
  label: string;
  value: number | null;
  unit: MetricUnit;
  /** Symbolic, e.g. "Payback = Capex ÷ Net annual savings". */
  formula: string;
  inputs: FormulaInput[];
  note?: string;
}

export interface CostBreakdown {
  water: number;
  surcharge: number;
  trucking: number;
  discharge: number;
  brine: number;
  energy: number;
  variableOM: number;
  fixedOM: number;
  shortage: number;
  total: number;
}

export interface Evaluation {
  normalDay: DayResult;
  /** Present when the scenario has drought days. */
  stressDay: DayResult | null;
  annual: CostBreakdown;
  expectedDisruptionCost: number;
  capex: number;
}

export interface Comparison {
  design: Evaluation;
  baseline: Evaluation;
  metrics: {
    netAnnualSavings: Metric;
    riskAdjustedSavings: Metric;
    payback: Metric;
    npv: Metric;
    npvRiskAdjusted: Metric;
    capex: Metric;
    annualCost: Metric;
    waterWithdrawn: Metric;
    recycledPct: Metric;
    treatmentEnergy: Metric;
    supplyRisk: Metric;
    expectedDisruption: Metric;
    tankersPerDay: Metric;
    /** Baseline extra cost in the selected scenario vs a normal year. */
    costOfDoingNothing: Metric;
    /** Same, but for 2050 stress (the "Do nothing" toggle). */
    doNothing2050: Metric;
  };
  rules: RuleResult[];
}

// ---------- Advisor ----------

export interface AdvisorCard {
  id: string;
  title: string;
  pieces: PieceType[];
  why: string;
  waterSaved: number;
  annualSavings: number;
  riskAdjustedSavings: number;
  capex: number;
  paybackYears: number | null;
  npvRiskAdjusted: number;
  tradeoff: string;
  /** Board with this recommendation applied (new nodes marked ghost: false, existing: false). */
  board: Board;
}

export interface AdvisorResult {
  cards: AdvisorCard[];
  /** Best combination found by greedy + small search. */
  plan: AdvisorCard | null;
}

// ---------- Weak points ----------

/** A vulnerability the engine found on the board (guided demo step 1). */
export interface WeakPoint {
  id: string;
  severity: "high" | "medium";
  title: string;
  detail: string;
  /** Pieces to highlight on the board. */
  nodeIds: string[];
  /** Annual cost this weakness drives (USD/yr), or null when it has no clean dollar figure. */
  annualImpact: number | null;
  /** Lost production per hour while it lasts (USD/h), for weaknesses that stop a building. */
  lostPerHour?: number;
  /** How to solve it, in plain English (shown when the weak point is clicked). */
  fix: string;
  /** Pieces that solve it, in palette order of use. */
  fixPieces: PieceType[];
}

// ---------- Suggestions ----------

/**
 * A better option for a design that already works (not a rule violation). The piece at `nodeId`
 * glows as a suggestion; clicking it shows `reasons`; accepting replaces the board with `board`.
 */
export interface Suggestion {
  id: string;
  kind: "swap";
  nodeId: string;
  from: PieceType;
  to: PieceType;
  title: string;
  /** Plain-English reasons, each built from engine numbers. */
  reasons: string[];
  /** Change vs the current design (positive = better), USD/yr. */
  annualSavings: number;
  riskAdjustedSavings: number;
  /** Extra capex the swap needs (negative = cheaper), USD. */
  capexDelta: number;
  energySavedKwhPerDay: number;
  brineReducedM3PerDay: number;
  board: Board;
}

// ---------- Engine API (implemented in lib/engine.ts by workstream A) ----------

export interface EngineApi {
  pieceCatalog(): PieceInfo[];
  presets(): Array<{ id: string; name: string; file: ScenarioFile }>;
  /** Validate a proposed pipe before adding it. valid=false → show the constraint popup. */
  checkConnection(board: Board, from: string, to: string): RuleResult;
  /** All current rule violations on the board. */
  evaluateRules(board: Board): RuleResult[];
  /** Full comparison vs the auto-derived do-nothing baseline. */
  compare(board: Board, values: AssumptionValues, settings: ScenarioSettings): Comparison;
  /** Insert the missing recommended pieces from a failed connection (incl. brine disposal for desal). */
  applyRecommendation(board: Board, result: RuleResult): Board;
  advise(board: Board, values: AssumptionValues, settings: ScenarioSettings): AdvisorResult;
  /** Vulnerabilities, judged against a 2021-type drought, ranked by severity then dollars. */
  weakPoints(board: Board, values: AssumptionValues, settings: ScenarioSettings): WeakPoint[];
  /** Better options for pieces that already work (e.g. regular desal → Harmony). */
  suggestions(board: Board, values: AssumptionValues, settings: ScenarioSettings): Suggestion[];
}

// ---------- Advise API (app/api/advise, workstream D) ----------

export interface AdviseRequest {
  question: string;
  board: Board;
  settings: ScenarioSettings;
  /** Engine numbers the LLM may cite. It must not invent others. */
  comparison: Pick<Comparison, "metrics" | "rules">;
  advisor: AdvisorResult | null;
}

export interface AdviseResponse {
  success: boolean;
  source: "claude" | "scripted";
  answer: string;
  error?: string;
}
