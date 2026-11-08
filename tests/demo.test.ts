import { describe, expect, it } from "vitest";
import { defaultValues } from "../lib/assumptions";
import { addEdge, addNode } from "../lib/board";
import { DEMO_DC_ID, DEMO_STEPS, demoNext, demoStart, demoStateAt } from "../lib/demo";
import { compare } from "../lib/finance";
import { evaluateRules } from "../lib/rules";
import { suggestions } from "../lib/suggestions";
import { weakPoints } from "../lib/weakpoints";

const v = defaultValues();
const blocking = (s: ReturnType<typeof demoStateAt>) => evaluateRules(s.board).filter((r) => r.severity !== "info");

describe("guided demo narrative (data center + Harmony)", () => {
  it("has the five steps in order", () => {
    expect(DEMO_STEPS.map((s) => s.title)).toEqual([
      "A data center with no water",
      "Add a regular desalination plant",
      "Switch to Harmony",
      "Check the assumptions",
      "Ask the AI advisor",
    ]);
  });

  it("(1) starts with a data center, no source and no pipes; the fix is seawater desalination", () => {
    const s = demoStateAt(0);
    expect(s.board.nodes.map((n) => n.type)).toEqual(["datacenter"]);
    expect(s.board.edges).toEqual([]);
    const [first] = weakPoints(s.board, v, s.settings);
    expect(first).toMatchObject({ id: `offline:${DEMO_DC_ID}`, title: "Data center campus has no water source", lostPerHour: v["downtime.datacenter"] });
    expect(first.fixPieces).toEqual(["seawater", "desal", "brine"]);
  });

  it("(2) regular desal is valid, and the engine suggests Harmony with computed reasons", () => {
    const s = demoStateAt(1);
    expect(s.board.nodes.map((n) => n.type)).toEqual(expect.arrayContaining(["desal", "seawater", "brine"]));
    expect(blocking(s)).toEqual([]);

    const [sg] = suggestions(s.board, v, s.settings);
    expect(sg).toMatchObject({ kind: "swap", from: "desal", to: "harmony", capexDelta: 0 });
    expect(sg.annualSavings).toBeGreaterThan(0);
    expect(sg.energySavedKwhPerDay).toBeGreaterThan(0);
    expect(sg.brineReducedM3PerDay).toBeGreaterThan(0);
    expect(sg.reasons[0]).toMatch(/Tier 3/);
    expect(sg.reasons.join(" ")).toMatch(/energy/);
    expect(sg.reasons.join(" ")).toMatch(/brine/);
  });

  it("(2) keeps the presenter's own hand-built desal plant", () => {
    const start = demoStart();
    const sea = addNode(start.board, "seawater", { x: 0, y: 5 });
    const desal = addNode(sea.board, "desal", { x: 2, y: 4 });
    const handBuilt = { ...start, board: addEdge(addEdge(desal.board, sea.id, desal.id).board, desal.id, DEMO_DC_ID).board };
    const s = demoNext(handBuilt, 1);
    expect(s.board.nodes.filter((n) => n.type === "desal").map((n) => n.id)).toEqual([desal.id]);
    expect(s.board.nodes.filter((n) => n.type === "seawater")).toHaveLength(1);
    expect(blocking(s)).toEqual([]);
  });

  it("(3) Harmony replaces regular desal: valid, cheaper to run, impact callout on", () => {
    const b = demoStateAt(1);
    const c = demoStateAt(2);
    expect(c.board.nodes.map((n) => n.type)).toContain("harmony");
    expect(c.board.nodes.map((n) => n.type)).not.toContain("desal");
    expect(blocking(c)).toEqual([]);
    expect(c.impactCallout).toBe(true);
    const mb = compare(b.board, v, b.settings);
    const mc = compare(c.board, v, c.settings);
    expect(mc.metrics.netAnnualSavings.value ?? 0).toBeGreaterThan(mb.metrics.netAnnualSavings.value ?? 0);
    expect(mc.design.normalDay.totals.energyKwh).toBeLessThan(mb.design.normalDay.totals.energyKwh);
    expect(mc.design.normalDay.totals.brine).toBeLessThan(mb.design.normalDay.totals.brine);
    expect(suggestions(c.board, v, c.settings)).toEqual([]);
  });

  it("(4) assumptions step opens the assumptions panel without changing the board", () => {
    expect(demoStateAt(3).panel).toBe("assumptions");
    expect(demoStateAt(3).board).toEqual(demoStateAt(2).board);
  });

  it("(5) advisor step switches to advisor mode and runs it", () => {
    expect(demoStateAt(4)).toMatchObject({ panel: "advisor", mode: "advisor", runAdvisor: true, popup: null });
  });
});
