import { describe, expect, it } from "vitest";
import { advise, generateCandidates } from "../lib/advisor";
import { defaultValues } from "../lib/assumptions";
import type { ScenarioId } from "../lib/contract";
import { PRESETS } from "../lib/presets";
import { evaluateRules } from "../lib/rules";
import { settings } from "./helpers";

const v = defaultValues();

const blocking = (board: Parameters<typeof evaluateRules>[0]) => evaluateRules(board).filter((r) => r.severity !== "info");

describe("advisor", () => {
  it.each(PRESETS.flatMap((p) => (["normal", "drought2021"] as ScenarioId[]).map((s) => [p.name, s, p.file.board] as const)))(
    "never returns a recommendation that violates a rule: %s, %s",
    (_name, scenarioId, board) => {
      expect(blocking(board)).toEqual([]);
      const result = advise(board, v, settings({ scenarioId }));

      for (const card of [...result.cards, ...(result.plan ? [result.plan] : [])]) {
        expect(blocking(card.board)).toEqual([]);
      }
    },
  );

  it("ranks cards by risk-adjusted NPV", () => {
    const { cards } = advise(PRESETS[0].file.board, v, settings({ scenarioId: "drought2021" }));
    expect(cards.length).toBeGreaterThan(0);
    const npvs = cards.map((c) => c.npvRiskAdjusted);
    expect([...npvs].sort((a, b) => b - a)).toEqual(npvs);
  });

  it("cards carry the numbers the UI needs", () => {
    const { cards } = advise(PRESETS[0].file.board, v, settings({ scenarioId: "drought2021" }));
    for (const c of cards) {
      expect(c.why.length).toBeGreaterThan(10);
      expect(c.tradeoff.length).toBeGreaterThan(0);
      expect(Number.isFinite(c.annualSavings)).toBe(true);
      expect(Number.isFinite(c.capex)).toBe(true);
    }
  });

  it("the desal bundle always ships with brine disposal", () => {
    const desal = generateCandidates(PRESETS[0].file.board, v).find((c) => c.id === "desal");
    expect(desal?.pieces).toEqual(expect.arrayContaining(["seawater", "desal", "brine"]));
  });
});
