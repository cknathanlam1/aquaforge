/**
 * Guided demo: wraps the engine's five deterministic steps (lib/demo.ts via lib/engine.ts) with
 * UI-only labels and the metric each step highlights. Copy here carries no numbers; the narration
 * card shows the live engine value of the highlighted metric.
 */
import type { Comparison } from "@/lib/contract";
import { DEMO_STEPS as ENGINE_STEPS, demoStateAt, type DemoState } from "@/lib/engine";

export type MetricKey = keyof Comparison["metrics"];

export interface DemoStep {
  short: string;
  title: string;
  text: string;
  highlight: MetricKey | null;
}

const UI: Record<string, { short: string; highlight: MetricKey | null }> = {
  a: { short: "1 · Weak points", highlight: "costOfDoingNothing" },
  b: { short: "2 · River → Fab", highlight: null },
  c: { short: "3 · Desalination", highlight: "netAnnualSavings" },
  d: { short: "4 · Assumptions", highlight: null },
  e: { short: "5 · AI advisor", highlight: "riskAdjustedSavings" },
};

export const DEMO_STEPS: DemoStep[] = ENGINE_STEPS.map((s) => ({
  short: UI[s.id]?.short ?? s.title,
  title: s.title,
  text: s.narration,
  highlight: UI[s.id]?.highlight ?? null,
}));

export function buildDemoState(step: number): DemoState {
  return demoStateAt(step);
}
