import { describe, expect, it } from "vitest";
import { defaultValues } from "../lib/assumptions";
import { DEMO_STEPS, demoStateAt } from "../lib/demo";
import { compare } from "../lib/finance";
import { evaluateRules } from "../lib/rules";
import { weakPoints } from "../lib/weakpoints";

const v = defaultValues();
const blocking = (s: ReturnType<typeof demoStateAt>) => evaluateRules(s.board).filter((r) => r.severity !== "info");

describe("guided demo narrative", () => {
  it("has the five steps in order", () => {
    expect(DEMO_STEPS.map((s) => s.title)).toEqual([
      "Find the weak points",
      "Try something that doesn't work",
      "Swap in desalination",
      "Check the assumptions",
      "Ask the AI advisor",
    ]);
  });

  it("(1) weak points: drought exposure, trucking and an outage, each with its cost", () => {
    const s = demoStateAt(0);
    expect(s.settings.scenarioId).toBe("drought2021");
    expect(s.showWeakPoints).toBe(true);

    const points = weakPoints(s.board, v, s.settings);
    const ids = points.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(["exposed-supply", "trucking", "no-reuse"]));
    expect(ids.some((id) => id.startsWith("outage:"))).toBe(true);
    // Highlighted pieces exist on the board, and dollar figures are real numbers.
    for (const p of points) {
      for (const id of p.nodeIds) expect(s.board.nodes.some((n) => n.id === id)).toBe(true);
      if (p.annualImpact !== null) expect(p.annualImpact).toBeGreaterThan(0);
    }
    expect(points[0].severity).toBe("high");
  });

  it("(1) trucking weak point matches the dashboard's drought numbers", () => {
    const s = demoStateAt(0);
    const trucking = weakPoints(s.board, v, s.settings).find((p) => p.id === "trucking");
    const tankers = compare(s.board, v, s.settings).metrics.tankersPerDay.value;
    expect(trucking?.title).toBe(`${tankers} tanker trips a day in a drought`);
  });

  it("(2) a river intake into the fab is rejected and Desal + Polishing is recommended", () => {
    const s = demoStateAt(1);
    expect(s.board.nodes.some((n) => n.type === "river")).toBe(true);
    expect(s.popup).toMatchObject({ valid: false, ruleId: "tier-requirement", recommendedPieces: ["desal", "polish"] });
    expect(s.popup?.reasonText).toMatch(/Tier 1/);
  });

  it("(3) desalination fed from the sea replaces the river: valid, drought-proof, and it pays", () => {
    const s = demoStateAt(2);
    const types = s.board.nodes.map((n) => n.type);
    expect(types).toEqual(expect.arrayContaining(["seawater", "desal", "polish", "brine"]));
    expect(types).not.toContain("river");
    expect(blocking(s)).toEqual([]);

    const m = compare(s.board, v, s.settings).metrics;
    expect(m.capex.value).toBeGreaterThan(0);
    expect(m.tankersPerDay.value).toBe(0);
    expect(m.netAnnualSavings.value).toBeGreaterThan(0);
  });

  it("(4) assumptions step opens the assumptions panel without changing the board", () => {
    const c = demoStateAt(2);
    const d = demoStateAt(3);
    expect(d.panel).toBe("assumptions");
    expect(d.board).toEqual(c.board);
  });

  it("(5) advisor step switches to advisor mode and runs it", () => {
    const e = demoStateAt(4);
    expect(e).toMatchObject({ panel: "advisor", mode: "advisor", runAdvisor: true, popup: null });
    expect(blocking(e)).toEqual([]);
  });
});
