/**
 * Guided demo: UI labels and the metric each engine step (lib/demo.ts via lib/engine.ts)
 * highlights. Copy here carries no numbers; the narration card and the impact callout show live
 * engine values.
 */
import type { Comparison } from "@/lib/contract";
import { DEMO_STEPS as ENGINE_STEPS } from "@/lib/engine";

export type MetricKey = keyof Comparison["metrics"];

export interface DemoStep {
  short: string;
  title: string;
  text: string;
  highlight: MetricKey | null;
}

const UI: Record<string, { short: string; highlight: MetricKey | null }> = {
  a: { short: "1 · No water", highlight: null },
  b: { short: "2 · Regular desal", highlight: "netAnnualSavings" },
  c: { short: "3 · Harmony", highlight: "netAnnualSavings" },
  d: { short: "4 · Assumptions", highlight: null },
  e: { short: "5 · AI advisor", highlight: "riskAdjustedSavings" },
};

export const DEMO_STEPS: DemoStep[] = ENGINE_STEPS.map((s) => ({
  short: UI[s.id]?.short ?? s.title,
  title: s.title,
  text: s.narration,
  highlight: UI[s.id]?.highlight ?? null,
}));
