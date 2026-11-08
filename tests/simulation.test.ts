import { describe, expect, it } from "vitest";
import { defaultValues } from "../lib/assumptions";
import { neighborBoard, resilienceBoard } from "./fixtures";
import { PRESETS, TAIWAN_CONVENTIONAL } from "../lib/presets";
import { droughtConditions, scenarioParams } from "../lib/scenarios";
import { NORMAL_CONDITIONS, simulateDay } from "../lib/simulation";
import { makeBoard, settings } from "./helpers";

const v = defaultValues();

function expectMassBalance(withdrawn: number, error: number): void {
  expect(Math.abs(error)).toBeLessThanOrEqual(Math.max(1e-6, withdrawn * 1e-6));
}

describe("water balance", () => {
  it("one fab on RO + UPW withdraws demand ÷ (RO recovery × UPW recovery)", () => {
    const day = simulateDay(TAIWAN_CONVENTIONAL, v);
    const expected = 20000 / (0.95 * 0.75);

    expect(day.totals.withdrawn).toBeCloseTo(expected, 6);
    expect(day.totals.delivered).toBeCloseTo(20000, 6);
    expect(day.totals.consumptive).toBeCloseTo(20000 * 0.2, 6);
    expect(day.nodes.n4.status).toBe("ok");
  });

  it.each([
    // Taiwan Science Park opens fab-only (no source), so it has nothing to balance.
    ...PRESETS.filter((p) => p.id !== "taiwan").map((p) => [p.name, p.file.board] as const),
    ["Taiwan fab, conventional supply", TAIWAN_CONVENTIONAL] as const,
    ["recycle + desal + tank", resilienceBoard()] as const,
    ["neighbor shares the loop", neighborBoard()] as const,
  ])("conserves mass: %s", (_name, board) => {
    const day = simulateDay(board, v);
    const { withdrawn, consumptive, discharge, brine, massBalanceError } = day.totals;

    expect(withdrawn).toBeGreaterThan(0);
    expect(massBalanceError).toBeCloseTo(withdrawn - consumptive - discharge - brine, 6);
    expectMassBalance(withdrawn, massBalanceError);
  });

  it("conserves mass on a drought day with trucking", () => {
    const s = settings({ scenarioId: "drought2021" });
    const params = scenarioParams(v, s);
    const normal = simulateDay(neighborBoard(), v);
    const day = simulateDay(neighborBoard(), v, droughtConditions(normal, params, s, v));
    expectMassBalance(day.totals.withdrawn, day.totals.massBalanceError);
  });

  it("recycling replaces municipal water and shows up as recycled share", () => {
    const before = simulateDay(TAIWAN_CONVENTIONAL, v);
    const after = simulateDay(resilienceBoard(), v);

    // Limited by plant capacity or by the fab's wastewater (demand × (1 − consumptive) × recovery).
    const wastewaterLimit = 20000 * (1 - v["consumptive.fab"]) * v["recovery.recycle"];
    expect(after.totals.recycledSupply).toBeCloseTo(Math.min(v["cap.recycle"], wastewaterLimit), 6);
    expect(after.totals.withdrawn).toBeLessThan(before.totals.withdrawn - 9000);
    expect(after.totals.recycledPct).toBeGreaterThan(0.25);
  });

  it("flags a disconnected consumer as offline with its lost production per hour", () => {
    const board = makeBoard([["m", "municipal"], ["fab", "fab"]], []);
    const day = simulateDay(board, v, NORMAL_CONDITIONS);

    expect(day.nodes.fab).toMatchObject({ status: "offline", unmet: 20000, lostPerHour: v["downtime.fab"] });
  });

  it("an invalid pipe carries no water", () => {
    const board = makeBoard([["m", "municipal"], ["fab", "fab"]], [["m", "fab"]]);
    const day = simulateDay(board, v);

    expect(day.edges.e1).toMatchObject({ valid: false, flow: 0 });
    expect(day.nodes.fab.status).toBe("offline");
  });

  it("server halls go offline without cooling and recover with it", () => {
    const noCooling = makeBoard([["m", "municipal"], ["t", "tower"], ["s", "server"]], [["m", "t"]]);
    const cooled = makeBoard([["m", "municipal"], ["t", "tower"], ["s", "server"]], [["m", "t"], ["t", "s"]]);

    expect(simulateDay(noCooling, v).nodes.s).toMatchObject({ status: "offline", lostPerHour: v["downtime.datacenter"] });
    expect(simulateDay(cooled, v).nodes.s).toMatchObject({ status: "ok", lostPerHour: 0 });
  });

  it("site-wide efficiency pieces cut demand", () => {
    const base = makeBoard([["m", "municipal"], ["o", "office"]], [["m", "o"]]);
    const withLeak = { ...base, nodes: [...base.nodes, { id: "l", type: "leak" as const, x: 5, y: 5, existing: false }] };

    expect(simulateDay(withLeak, v).totals.demand).toBeCloseTo(v["demand.office"] * (1 - v["eff.leak"]), 9);
  });
});
