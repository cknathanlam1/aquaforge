import { describe, expect, it } from "vitest";
import { defaultValues } from "../lib/assumptions";
import { DEMO_STEPS, demoStateAt } from "../lib/demo";
import { compare } from "../lib/finance";
import { evaluateRules } from "../lib/rules";

const v = defaultValues();

describe("guided demo narrative", () => {
  it("has the five steps in order", () => {
    expect(DEMO_STEPS.map((s) => s.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("(a) baseline: a positive, non-zero annual water bill", () => {
    const s = demoStateAt(0);
    expect(compare(s.board, v, s.settings).metrics.annualCost.value).toBeGreaterThan(0);
  });

  it("(b) drought: cost of doing nothing and tankers per day", () => {
    const s = demoStateAt(1);
    const m = compare(s.board, v, s.settings).metrics;
    expect(s.settings.scenarioId).toBe("drought2021");
    expect(m.costOfDoingNothing.value).toBeGreaterThan(0);
    expect(m.tankersPerDay.value).toBeGreaterThan(0);
  });

  it("(c) a basic filter into the fab opens the popup recommending Desal + Polishing", () => {
    const s = demoStateAt(2);
    expect(s.popup).toMatchObject({ valid: false, recommendedPieces: ["desal", "polish"] });
  });

  it("(d) recycle + desal + polishing + storage: valid board with risk-adjusted savings", () => {
    const s = demoStateAt(3);
    expect(evaluateRules(s.board).filter((r) => r.severity !== "info")).toEqual([]);
    const m = compare(s.board, v, s.settings).metrics;
    expect(m.capex.value).toBeGreaterThan(0);
    expect(m.riskAdjustedSavings.value).toBeGreaterThan(m.netAnnualSavings.value ?? 0);
  });

  it("(e) a neighbor on the shared loop scales the savings", () => {
    const d = demoStateAt(3);
    const e = demoStateAt(4);
    expect(evaluateRules(e.board).filter((r) => r.severity !== "info")).toEqual([]);
    const savingsD = compare(d.board, v, d.settings).metrics.netAnnualSavings.value ?? 0;
    const savingsE = compare(e.board, v, e.settings).metrics.netAnnualSavings.value ?? 0;
    expect(savingsE).toBeGreaterThan(savingsD);
  });
});
