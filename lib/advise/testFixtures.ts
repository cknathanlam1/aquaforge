/** Test-only fixture: a realistic AdviseRequest. Not imported by app code. */

import type { AdviseRequest, AdvisorCard, Comparison, Metric, MetricUnit } from "../contract";

function metric(key: string, label: string, value: number | null, unit: MetricUnit, formula: string): Metric {
  return { key, label, value, unit, formula, inputs: [{ symbol: "X", label: `${label} input`, value: value ?? 0, unit }] };
}

const recycleCard: AdvisorCard = {
  id: "recycle",
  title: "Add a recycling plant",
  pieces: ["recycle"],
  why: "Turns fab wastewater back into process water.",
  waterSaved: 6300,
  annualSavings: 1_234_000,
  riskAdjustedSavings: 2_870_000,
  capex: 4_500_000,
  paybackYears: 3.6,
  npvRiskAdjusted: 9_120_000,
  tradeoff: "Adds energy use and a membrane replacement schedule.",
  board: { nodes: [], edges: [] },
};

const desalCard: AdvisorCard = {
  ...recycleCard,
  id: "desal",
  title: "Add seawater desalination",
  pieces: ["seawater", "desal", "brine"],
  waterSaved: 4000,
  annualSavings: -310_000,
  riskAdjustedSavings: 1_450_000,
  capex: 12_000_000,
  paybackYears: null,
  npvRiskAdjusted: -2_300_000,
  tradeoff: "Energy-heavy and needs brine disposal.",
};

const metrics: Comparison["metrics"] = {
  netAnnualSavings: metric("netAnnualSavings", "Net annual savings", 812_500, "usd/yr", "Baseline cost − Design cost"),
  riskAdjustedSavings: metric("riskAdjustedSavings", "Risk-adjusted savings", 2_455_000, "usd/yr", "Net savings + avoided disruption"),
  payback: metric("payback", "Simple payback", 5.5, "years", "Capex ÷ Net annual savings"),
  npv: metric("npv", "NPV", 3_960_000, "usd", "Σ savings/(1+r)^t − Capex"),
  npvRiskAdjusted: metric("npvRiskAdjusted", "Risk-adjusted NPV", 11_700_000, "usd", "Σ risk-adj savings/(1+r)^t − Capex"),
  capex: metric("capex", "Capex", 4_500_000, "usd", "Σ new piece capex"),
  annualCost: metric("annualCost", "Annual water cost", 6_120_000, "usd/yr", "Water + energy + O&M"),
  waterWithdrawn: metric("waterWithdrawn", "Water withdrawn", 18_400, "m3/day", "Σ source withdrawals"),
  recycledPct: metric("recycledPct", "Recycled share", 0.34, "pct", "Recycled ÷ total supply"),
  treatmentEnergy: metric("treatmentEnergy", "Treatment energy", 21_900, "kWh/day", "Σ flow × kWh/m³"),
  supplyRisk: metric("supplyRisk", "Supply risk score", 0.42, "score", "Weighted outage probability"),
  expectedDisruption: metric("expectedDisruption", "Expected disruption cost", 1_642_500, "usd/yr", "Σ p × outage cost"),
  tankersPerDay: metric("tankersPerDay", "Tankers per day", 92, "tankers/day", "Shortfall ÷ 20 m³"),
  costOfDoingNothing: metric("costOfDoingNothing", "Cost of doing nothing", 7_350_000, "usd/yr", "Drought cost − normal cost"),
  doNothing2050: metric("doNothing2050", "Do nothing in 2050", null, "usd/yr", "2050 cost − normal cost"),
};

export function makeRequest(question: string, overrides: Partial<AdviseRequest> = {}): AdviseRequest {
  return {
    question,
    board: {
      nodes: [
        { id: "n1", type: "municipal", x: 0, y: 0, existing: true },
        { id: "n2", type: "fab", x: 2, y: 0, existing: true },
        { id: "n3", type: "desal", x: 4, y: 1, existing: false },
      ],
      edges: [{ id: "e1", from: "n1", to: "n2" }],
    },
    settings: { scenarioId: "drought2021", cutLevel: "initial", truckingEnabled: true, surchargeEnabled: true, couplingEnabled: false },
    comparison: {
      metrics,
      rules: [
        {
          ruleId: "brine",
          valid: false,
          severity: "error",
          message: "Desal needs brine disposal before it can run.",
          recommendedPieces: ["brine"],
          reasonText: "Desal produces concentrated brine.",
          tierChain: [],
        },
      ],
    },
    advisor: { cards: [recycleCard, desalCard], plan: null },
    ...overrides,
  };
}
