/** Regression tests for issues found in code review. */

import { describe, expect, it } from "vitest";
import { advise, generateCandidates } from "../lib/advisor";
import { defaultValues } from "../lib/assumptions";
import type { Board, BoardEdge, BoardNode, PieceType } from "../lib/contract";
import { compare, simplePayback } from "../lib/finance";
import { PRESETS, TAIWAN_SCIENCE_PARK } from "../lib/presets";
import { checkConnection } from "../lib/rules";
import { NORMAL_CONDITIONS, simulateDay } from "../lib/simulation";
import { makeBoard, settings } from "./helpers";

const v = defaultValues();

function extend(board: Board, nodes: Array<[string, PieceType, boolean]>, pipes: Array<[string, string]>): Board {
  const ns: BoardNode[] = nodes.map(([id, type, existing], i) => ({ id, type, x: 10 + i, y: 10, existing }));
  const es: BoardEdge[] = pipes.map(([from, to], i) => ({ id: `x${i + 1}`, from, to }));
  return { nodes: [...board.nodes, ...ns], edges: [...board.edges, ...es] };
}

describe("code-review regressions", () => {
  it("H1: a new building with its normal plumbing is not a capex loss", () => {
    // A second fab with its own new conventional RO + UPW train.
    const board = extend(TAIWAN_SCIENCE_PARK, [["ro2", "ro", false], ["upw2", "upw", false], ["fab2", "fab", false]], [
      ["n1", "ro2"],
      ["ro2", "upw2"],
      ["upw2", "fab2"],
      ["fab2", "n5"],
    ]);
    const m = compare(board, v, settings()).metrics;

    expect(m.netAnnualSavings.value).toBeCloseTo(0, 2);
    expect(m.capex.value).toBeCloseTo(0, 6);
    expect(m.npv.value).toBeCloseTo(0, 2);
  });

  it("M1: leaving a building without water never shows up as savings", () => {
    const board = makeBoard([["m", "municipal"], ["o", "office"], ["fire", "fire"]], [["m", "o"]]);
    expect(compare(board, v, settings()).metrics.netAnnualSavings.value).toBeLessThan(0);
  });

  it("M2: advisor card payback matches the dashboard's definition (net savings)", () => {
    for (const preset of PRESETS) {
      for (const card of advise(preset.file.board, v, settings({ scenarioId: "drought2021" })).cards) {
        expect(card.paybackYears).toBe(simplePayback(card.capex, card.annualSavings));
      }
    }
  });

  it("M2b: storage is proposed for cooling that protects the user's own server halls, never for a neighbor", () => {
    const dc = PRESETS.find((p) => p.id === "datacenter")?.file.board as Board;
    expect(generateCandidates(dc, v).some((c) => c.id.startsWith("tank:"))).toBe(true);

    const withNeighbor = makeBoard([["m", "municipal"], ["n", "neighbor_dc"]], [["m", "n"]]);
    expect(generateCandidates(withNeighbor, v).some((c) => c.id.startsWith("tank:"))).toBe(false);
  });

  it("M3: wastewater fills recycling plants up to capacity and spills over", () => {
    const small = { ...v, "cap.wwt": 1000, "cap.recycle": 10000 };
    const board = makeBoard(
      [["m", "municipal"], ["ro", "ro"], ["upw", "upw"], ["fab", "fab"], ["wwt", "wwt"], ["rec", "recycle"]],
      [["m", "ro"], ["ro", "upw"], ["upw", "fab"], ["fab", "wwt"], ["fab", "rec"], ["wwt", "ro"], ["rec", "ro"]],
    );
    const day = simulateDay(board, small, NORMAL_CONDITIONS);

    expect(day.totals.recycledSupply).toBeCloseTo(1000 + 10000, 3);
    expect(Math.abs(day.totals.massBalanceError)).toBeLessThan(1e-6);
  });

  it("M4: the pipe that closes a loop is the one flagged, whatever the node order", () => {
    const forward = makeBoard([["m", "municipal"], ["a", "valve"], ["b", "valve"], ["c", "valve"]], [["m", "a"], ["a", "b"], ["b", "c"]]);
    const reversed: Board = { ...forward, nodes: [...forward.nodes].reverse() };

    for (const board of [forward, reversed]) {
      expect(checkConnection(board, "c", "a").ruleId).toBe("supply-loop");
    }
  });

  it("M5: stacked diamond networks with no supply solve quickly", () => {
    const nodes: Array<[string, PieceType]> = [["m", "municipal"]];
    const pipes: Array<[string, string]> = [];
    let prev = "m";
    for (let i = 0; i < 18; i++) {
      nodes.push([`l${i}`, "valve"], [`r${i}`, "valve"], [`j${i}`, "valve"]);
      pipes.push([prev, `l${i}`], [prev, `r${i}`], [`l${i}`, `j${i}`], [`r${i}`, `j${i}`]);
      prev = `j${i}`;
    }
    nodes.push(["o", "office"]);
    pipes.push([prev, "o"]);
    const board = makeBoard(nodes, pipes);

    const start = performance.now();
    const day = simulateDay(board, v, { ...NORMAL_CONDITIONS, disabled: new Set(["m"]) });
    expect(performance.now() - start).toBeLessThan(100);
    expect(day.nodes.o.status).toBe("offline");
  });

  it("efficiency pieces don't cut a neighbor's demand", () => {
    const board = makeBoard([["m", "municipal"], ["n", "neighbor_dc"], ["l", "leak"]], [["m", "n"]]);
    expect(simulateDay(board, v).totals.demand).toBe(v["demand.neighborDc"]);
  });
});
