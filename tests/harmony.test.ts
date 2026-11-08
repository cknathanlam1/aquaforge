import { describe, expect, it } from "vitest";
import { DEFAULT_ASSUMPTIONS, defaultValues } from "../lib/assumptions";
import { generateCandidates } from "../lib/advisor";
import { checkConnection, evaluateRules } from "../lib/rules";
import { simulateDay } from "../lib/simulation";
import { harmonySwapBoard, suggestions } from "../lib/suggestions";
import { makeBoard, settings } from "./helpers";

const v = defaultValues();

describe("Harmony desalination", () => {
  it("has its own inputs, separate from regular desal", () => {
    for (const key of ["harmony.energy", "harmony.brineFraction", "varcost.harmony", "cap.harmony", "capex.harmony", "om.harmony"] as const) {
      expect(DEFAULT_ASSUMPTIONS[key].group).toBe("Harmony desalination");
    }
    expect(v["harmony.energy"]).toBeLessThan(v["energy.desal"]);
    expect(v["harmony.brineFraction"]).toBeLessThan(v["desal.brineFraction"]);
    expect(v["varcost.harmony"]).toBeLessThan(v["varcost.desal"]);
  });

  it("only reaches Tier 3: fine for a data center, not for a fab or a UPW plant", () => {
    const board = makeBoard([["sea", "seawater"], ["h", "harmony"], ["dc", "datacenter"], ["fab", "fab"], ["upw", "upw"]], [["sea", "h"]]);
    expect(checkConnection(board, "h", "dc").valid).toBe(true);
    expect(checkConnection(board, "h", "fab").valid).toBe(false);
    expect(checkConnection(board, "h", "upw").valid).toBe(false);
  });

  it("needs brine disposal, like regular desal", () => {
    const board = makeBoard([["sea", "seawater"], ["h", "harmony"], ["dc", "datacenter"]], [["sea", "h"], ["h", "dc"]]);
    expect(evaluateRules(board).find((r) => r.ruleId === "desal-brine")?.message).toBe("Harmony desalination needs brine disposal");
  });

  it("uses less energy and makes less brine per m³ than regular desal (mass balance holds)", () => {
    const regular = makeBoard([["sea", "seawater"], ["d", "desal"], ["b", "brine"], ["dc", "datacenter"]], [["sea", "d"], ["d", "b"], ["d", "dc"]]);
    const harmony = harmonySwapBoard(regular, "d");
    expect(harmony).not.toBeNull();
    const a = simulateDay(regular, v);
    const b = simulateDay(harmony!, v);
    expect(b.totals.delivered).toBeCloseTo(a.totals.delivered, 6);
    expect(b.totals.energyKwh).toBeLessThan(a.totals.energyKwh);
    expect(b.totals.brine).toBeLessThan(a.totals.brine);
    expect(Math.abs(b.totals.massBalanceError)).toBeLessThan(1e-6);
  });

  it("is never suggested where Tier 4+ is needed downstream", () => {
    const fabLine = makeBoard(
      [["sea", "seawater"], ["d", "desal"], ["b", "brine"], ["p", "polish"], ["fab", "fab"]],
      [["sea", "d"], ["d", "b"], ["d", "p"], ["p", "fab"]],
    );
    expect(harmonySwapBoard(fabLine, "d")).toBeNull();
    expect(suggestions(fabLine, v, settings({ scenarioId: "drought2021" }))).toEqual([]);
    expect(generateCandidates(fabLine, v).some((c) => c.id.startsWith("harmony:"))).toBe(false);
  });

  it("the advisor can propose the swap for a data center", () => {
    const regular = makeBoard([["sea", "seawater"], ["d", "desal"], ["b", "brine"], ["dc", "datacenter"]], [["sea", "d"], ["d", "b"], ["d", "dc"]]);
    expect(generateCandidates(regular, v).some((c) => c.id === "harmony:d")).toBe(true);
  });
});
