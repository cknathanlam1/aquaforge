import { describe, expect, it } from "vitest";
import { defaultValues } from "../lib/assumptions";
import { addEdge, addNode } from "../lib/board";
import { DEMO_FAB_ID, DEMO_STEPS, demoNext, demoStart, demoStateAt } from "../lib/demo";
import { compare } from "../lib/finance";
import { evaluateRules } from "../lib/rules";
import { weakPoints } from "../lib/weakpoints";

const v = defaultValues();
const blocking = (s: ReturnType<typeof demoStateAt>) => evaluateRules(s.board).filter((r) => r.severity !== "info");

describe("guided demo narrative", () => {
  it("has the six steps in order", () => {
    expect(DEMO_STEPS.map((s) => s.title)).toEqual([
      "A fab with no water",
      "Try a river intake",
      "Swap in desalination",
      "Recycle the wastewater",
      "Check the assumptions",
      "Ask the AI advisor",
    ]);
  });

  it("(1) starts with a fab, no source and no pipes; the top weak point is 'no water source', with a fix", () => {
    const s = demoStateAt(0);
    expect(s.board.nodes.map((n) => n.type)).toEqual(["fab"]);
    expect(s.board.edges).toEqual([]);
    expect(s.showWeakPoints).toBe(true);

    const [first] = weakPoints(s.board, v, s.settings);
    expect(first).toMatchObject({ id: `offline:${DEMO_FAB_ID}`, severity: "high", title: "Fab building has no water source", lostPerHour: v["downtime.fab"] });
    expect(first.fix).toMatch(/resilient/);
    expect(first.fixPieces).toEqual(expect.arrayContaining(["seawater", "desal", "polish"]));
  });

  it("(1) every weak point says how to solve it", () => {
    for (const board of [demoStateAt(0).board, demoStateAt(2).board]) {
      for (const p of weakPoints(board, v, demoStart().settings)) {
        expect(p.fix.length, p.id).toBeGreaterThan(20);
        expect(p.fixPieces.length, p.id).toBeGreaterThan(0);
      }
    }
  });

  it("(2) the river → fab pipe stays on the board as a tier violation recommending Desal + Polishing", () => {
    const s = demoStateAt(1);
    const pipe = s.board.edges.find((e) => e.to === DEMO_FAB_ID);
    expect(pipe).toBeDefined();
    expect(s.popup).toMatchObject({ valid: false, ruleId: "tier-requirement", edgeId: pipe?.id, recommendedPieces: ["desal", "polish"] });
    expect(s.popup?.reasonText).toMatch(/Tier 1/);
  });

  it("(2) keeps the presenter's own hand-built river and pipe", () => {
    const start = demoStart();
    const river = addNode(start.board, "river", { x: 1, y: 2 });
    const handBuilt = { ...start, board: addEdge(river.board, river.id, DEMO_FAB_ID).board };
    const s = demoNext(handBuilt, 1);
    expect(s.board.nodes.filter((n) => n.type === "river").map((n) => n.id)).toEqual([river.id]);
    expect(s.board.edges.filter((e) => e.to === DEMO_FAB_ID)).toHaveLength(1);
    expect(s.popup?.from).toBe(river.id);
  });

  it("(3) seawater desalination replaces the river: fab online, drought-proof, it pays, impact callout on", () => {
    const s = demoStateAt(2);
    const types = s.board.nodes.map((n) => n.type);
    expect(types).toEqual(expect.arrayContaining(["seawater", "desal", "polish", "brine"]));
    expect(types).not.toContain("river");
    expect(blocking(s)).toEqual([]);
    expect(s.impactCallout).toBe(true);

    const m = compare(s.board, v, s.settings).metrics;
    expect(m.tankersPerDay.value).toBe(0);
    expect(m.netAnnualSavings.value).toBeGreaterThan(0);
  });

  it("(4) recycling pipes add savings on top of desal", () => {
    const c = demoStateAt(2);
    const d = demoStateAt(3);
    expect(d.board.nodes.map((n) => n.type)).toEqual(expect.arrayContaining(["recycle", "ro"]));
    expect(blocking(d)).toEqual([]);
    expect(d.impactCallout).toBe(true);
    const mc = compare(c.board, v, c.settings).metrics;
    const md = compare(d.board, v, d.settings).metrics;
    expect(md.netAnnualSavings.value ?? 0).toBeGreaterThan(mc.netAnnualSavings.value ?? 0);
    // Recycled water replaces the second desal unit: one desal left, less capex, better NPV.
    expect(c.board.nodes.filter((n) => n.type === "desal")).toHaveLength(2);
    expect(d.board.nodes.filter((n) => n.type === "desal")).toHaveLength(1);
    expect(md.capex.value ?? 0).toBeLessThan(mc.capex.value ?? 0);
    expect(md.npv.value ?? 0).toBeGreaterThan(mc.npv.value ?? 0);
  });

  it("(5) assumptions step opens the assumptions panel without changing the board", () => {
    expect(demoStateAt(4).panel).toBe("assumptions");
    expect(demoStateAt(4).board).toEqual(demoStateAt(3).board);
  });

  it("(6) advisor step switches to advisor mode and runs it", () => {
    expect(demoStateAt(5)).toMatchObject({ panel: "advisor", mode: "advisor", runAdvisor: true, popup: null });
  });
});
