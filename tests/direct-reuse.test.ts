import { describe, expect, it } from "vitest";
import { defaultValues } from "../lib/assumptions";
import { checkConnection, evaluateRules } from "../lib/rules";
import { simulateDay } from "../lib/simulation";
import { makeBoard } from "./helpers";

const v = defaultValues();

/** Seawater → Harmony (+brine) → data center and concrete plant. */
function park(withReusePipe: boolean) {
  const pipes: Array<[string, string]> = [["sea", "h"], ["h", "b"], ["h", "dc"], ["h", "cc"]];
  if (withReusePipe) pipes.push(["dc", "cc"]);
  return makeBoard([["sea", "seawater"], ["h", "harmony"], ["b", "brine"], ["dc", "datacenter"], ["cc", "concrete"]], pipes);
}

describe("direct (untreated) reuse between buildings", () => {
  it("a data center's used water can pipe straight into the concrete plant, but not into an office or fab", () => {
    const board = makeBoard([["dc", "datacenter"], ["cc", "concrete"], ["o", "office"], ["fab", "fab"]], []);
    expect(checkConnection(board, "dc", "cc").valid).toBe(true);
    expect(checkConnection(board, "dc", "o").valid).toBe(false);
    expect(checkConnection(board, "dc", "fab").valid).toBe(false);
  });

  it("used water fills the concrete plant's demand first; fresh supply covers only the rest", () => {
    const day = simulateDay(park(true), v);
    const dcUsed = v["demand.datacenter"] * (1 - v["consumptive.datacenter"]);
    const reused = Math.min(v["demand.concrete"], dcUsed);
    expect(day.nodes.cc.delivered).toBeCloseTo(v["demand.concrete"], 6);
    expect(day.edges.e5.flow).toBeCloseTo(reused, 6);
    expect(day.nodes.h.outflow).toBeCloseTo(v["demand.datacenter"] + v["demand.concrete"] - reused, 6);
    expect(day.totals.recycledSupply).toBeCloseTo(reused, 6);
  });

  it("conserves mass: withdrawn = consumptive + discharge + brine", () => {
    for (const withPipe of [false, true]) {
      const t = simulateDay(park(withPipe), v).totals;
      expect(Math.abs(t.massBalanceError)).toBeLessThan(1e-6);
    }
  });

  it("cuts withdrawal and discharge versus no reuse pipe", () => {
    const a = simulateDay(park(false), v).totals;
    const b = simulateDay(park(true), v).totals;
    expect(b.withdrawn).toBeLessThan(a.withdrawn);
    expect(b.discharge).toBeLessThan(a.discharge);
  });

  it("a concrete plant fed only by used water is online, not flagged offline", () => {
    const board = makeBoard(
      [["sea", "seawater"], ["h", "harmony"], ["b", "brine"], ["dc", "datacenter"], ["cc", "concrete"]],
      [["sea", "h"], ["h", "b"], ["h", "dc"], ["dc", "cc"]],
    );
    expect(evaluateRules(board).filter((r) => r.ruleId === "consumer-offline")).toEqual([]);
    const day = simulateDay(board, v);
    expect(day.nodes.cc.status).toBe("ok");
    expect(Math.abs(day.totals.massBalanceError)).toBeLessThan(1e-6);
  });

  it("takes no more than its demand; the rest of the used water still drains", () => {
    const small = { ...v, "demand.concrete": 100 };
    const day = simulateDay(park(true), small);
    expect(day.edges.e5.flow).toBeCloseTo(100, 6);
    expect(Math.abs(day.totals.massBalanceError)).toBeLessThan(1e-6);
  });
});
