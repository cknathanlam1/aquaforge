import { describe, expect, it } from "vitest";
import { defaultValues } from "../lib/assumptions";
import { addEdge, addNode } from "../lib/board";
import { DEMO_PARK_TENANTS, DEMO_STEPS, demoNext, demoStart, demoStateAt, demoTrigger } from "../lib/demo";
import { compare } from "../lib/finance";
import { requiredTier, evaluateRules } from "../lib/rules";
import { simulateDay } from "../lib/simulation";
import { suggestions } from "../lib/suggestions";
import { weakPoints } from "../lib/weakpoints";

const v = defaultValues();
const blocking = (s: ReturnType<typeof demoStateAt>) => evaluateRules(s.board).filter((r) => r.severity !== "info");
const metrics = (i: number) => {
  const s = demoStateAt(i);
  return compare(s.board, v, s.settings);
};

describe("guided demo narrative (industrial park + Harmony)", () => {
  it("has the seven steps in order", () => {
    expect(DEMO_STEPS.map((s) => s.title)).toEqual([
      "A blank industrial park",
      "Build the park",
      "Add a regular desalination plant",
      "Switch to Harmony",
      "Reuse the data center's water",
      "Check the assumptions",
      "Ask the AI advisor",
    ]);
  });

  it("(1) starts completely blank", () => {
    const s = demoStateAt(0);
    expect(s.board).toEqual({ nodes: [], edges: [] });
    expect(weakPoints(s.board, v, s.settings)).toEqual([]);
  });

  it("(2) builds a park whose every tenant Harmony can supply (Tier 3 or less); all flagged with no water", () => {
    const s = demoStateAt(1);
    expect(s.board.nodes.map((n) => n.type)).toEqual(DEMO_PARK_TENANTS);
    expect(DEMO_PARK_TENANTS.length).toBeGreaterThanOrEqual(4);
    for (const t of DEMO_PARK_TENANTS) expect(requiredTier(t) ?? 1).toBeLessThanOrEqual(3);
    expect(s.showWeakPoints).toBe(true);
    const points = weakPoints(s.board, v, s.settings);
    expect(points.filter((p) => p.id.startsWith("offline:"))).toHaveLength(DEMO_PARK_TENANTS.length);
  });

  it("(3) one regular desal plant serves the whole park, and the engine suggests Harmony", () => {
    const s = demoStateAt(2);
    expect(blocking(s)).toEqual([]);
    expect(simulateDay(s.board, v).totals.unmet).toBeCloseTo(0, 6);
    const [sg] = suggestions(s.board, v, s.settings);
    expect(sg).toMatchObject({ from: "desal", to: "harmony" });
    expect(sg.annualSavings).toBeGreaterThan(0);
    expect(metrics(2).metrics.netAnnualSavings.value ?? 0).toBeGreaterThan(0);
  });

  it("(3) keeps a desal plant the presenter built and piped by hand", () => {
    const park = demoStateAt(1);
    const sea = addNode(park.board, "seawater", { x: 0, y: 2 });
    const desal = addNode(sea.board, "desal", { x: 1, y: 3 });
    const dc = park.board.nodes.find((n) => n.type === "datacenter")?.id as string;
    const board = addEdge(addEdge(desal.board, sea.id, desal.id).board, desal.id, dc).board;
    expect(demoTrigger(1, board)).toBe(true);
    const s = demoNext({ ...park, board }, 2);
    expect(s.board.nodes.filter((n) => n.type === "desal").map((n) => n.id)).toEqual([desal.id]);
    expect(blocking(s)).toEqual([]);
  });

  it("(4) Harmony beats regular desal on cost, energy and brine; no suggestion left", () => {
    const c = metrics(2);
    const d = metrics(3);
    expect(d.metrics.netAnnualSavings.value ?? 0).toBeGreaterThan(c.metrics.netAnnualSavings.value ?? 0);
    expect(d.design.normalDay.totals.energyKwh).toBeLessThan(c.design.normalDay.totals.energyKwh);
    expect(d.design.normalDay.totals.brine).toBeLessThan(c.design.normalDay.totals.brine);
    const s = demoStateAt(3);
    expect(s.impactCallout).toBe(true);
    expect(suggestions(s.board, v, s.settings)).toEqual([]);
  });

  it("(5) piping the data center's used water to the concrete plant saves money with no treatment and no capex", () => {
    const s = demoStateAt(4);
    expect(blocking(s)).toEqual([]);
    expect(s.board.nodes.map((n) => n.type)).not.toContain("wwt");
    const d = metrics(3);
    const e = metrics(4);
    expect(e.metrics.netAnnualSavings.value ?? 0).toBeGreaterThan(d.metrics.netAnnualSavings.value ?? 0);
    expect(e.metrics.capex.value).toBe(d.metrics.capex.value);
    expect(e.design.normalDay.totals.withdrawn).toBeLessThan(d.design.normalDay.totals.withdrawn);
    expect(e.design.normalDay.totals.discharge).toBeLessThan(d.design.normalDay.totals.discharge);
    expect(e.design.normalDay.totals.recycledSupply).toBeGreaterThan(0);
  });

  it("(5) the presenter's own data center → concrete pipe triggers the advance", () => {
    const s = demoStateAt(3);
    const dc = s.board.nodes.find((n) => n.type === "datacenter")?.id as string;
    const concrete = s.board.nodes.find((n) => n.type === "concrete")?.id as string;
    expect(demoTrigger(3, s.board)).toBe(false);
    expect(demoTrigger(3, addEdge(s.board, dc, concrete).board)).toBe(true);
  });

  it("(6) assumptions step opens the panel without changing the board", () => {
    expect(demoStateAt(5).panel).toBe("assumptions");
    expect(demoStateAt(5).board).toEqual(demoStateAt(4).board);
  });

  it("(7) advisor step switches to advisor mode and runs it", () => {
    expect(demoStateAt(6)).toMatchObject({ panel: "advisor", mode: "advisor", runAdvisor: true, popup: null });
  });

  it("step 1 → 2 triggers when the presenter drops a data center", () => {
    expect(demoTrigger(0, demoStart().board)).toBe(false);
    expect(demoTrigger(0, addNode(demoStart().board, "datacenter", { x: 4, y: 4 }).board)).toBe(true);
  });
});
