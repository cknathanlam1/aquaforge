import { describe, expect, it } from "vitest";
import { defaultValues } from "../lib/assumptions";
import { TAIWAN_CONVENTIONAL } from "../lib/presets";
import { permittedWithdrawal, runScenario, truckingPlan } from "../lib/scenarios";
import { settings } from "./helpers";

const v = defaultValues();

describe("trucking fallback", () => {
  it("tankers/day = shortfall ÷ 20 m³, cost = tankers × trip cost (hand-calculated)", () => {
    // 2,000 m³ shortfall ÷ 20 m³ = 100 tankers; 100 × $1,000 = $100,000/day.
    expect(truckingPlan(2000, v)).toEqual({ tankers: 100, cost: 100_000 });
  });

  it("rounds a partial tanker up", () => {
    // 2,010 m³ needs 100.5 tankers → 101 trips.
    expect(truckingPlan(2010, v)).toEqual({ tankers: 101, cost: 101_000 });
  });

  it("needs no tankers without a shortfall", () => {
    expect(truckingPlan(0, v)).toEqual({ tankers: 0, cost: 0 });
  });
});

describe("mandated cuts", () => {
  it.each([
    [0.11, 8900],
    [0.15, 8500],
  ])("a %s cut on 10,000 m³/day permits %s m³/day", (cut, permitted) => {
    expect(permittedWithdrawal(10000, cut)).toBeCloseTo(permitted, 9);
  });

  it.each([
    ["initial", 0.11],
    ["escalated", 0.15],
  ] as const)("2021 drought (%s) reduces municipal withdrawal by exactly %s", (cutLevel, cut) => {
    const run = runScenario(TAIWAN_CONVENTIONAL, v, settings({ scenarioId: "drought2021", cutLevel }));
    const normal = run.normalDay.sources[0];
    const stress = run.stressDay?.sources[0];

    expect(stress?.base).toBeCloseTo(normal.base * (1 - cut), 6);
    // The shortfall (normal draw × cut) is trucked in, up to 200 tankers × 20 m³ per day.
    const shortfall = normal.base * cut;
    const truckable = Math.min(shortfall, v["truck.maxPerDay"] * v["truck.capacity"]);
    expect(stress?.trucked).toBeCloseTo(truckable, 6);
    expect(run.stressDay?.totals.tankersPerDay).toBe(Math.ceil(truckable / 20 - 1e-9));
  });

  it("11% is fully covered by trucks; 15% exceeds the default tanker limit and the fab runs short", () => {
    const at11 = runScenario(TAIWAN_CONVENTIONAL, v, settings({ scenarioId: "drought2021", cutLevel: "initial" }));
    const at15 = runScenario(TAIWAN_CONVENTIONAL, v, settings({ scenarioId: "drought2021", cutLevel: "escalated" }));

    expect(at11.stressDay?.totals.unmet).toBeCloseTo(0, 6);
    expect(at15.stressDay?.totals.tankersPerDay).toBe(v["truck.maxPerDay"]);
    expect(at15.stressDay?.totals.unmet).toBeGreaterThan(0);
  });

  it("caps trucking at the site's tanker limit; the rest is unmet", () => {
    const tight = { ...v, "truck.maxPerDay": 50 };
    const run = runScenario(TAIWAN_CONVENTIONAL, tight, settings({ scenarioId: "drought2021" }));

    expect(run.stressDay?.totals.trucked).toBeCloseTo(50 * 20, 6);
    expect(run.stressDay?.totals.unmet).toBeGreaterThan(0);
  });

  it("a normal year has no drought days", () => {
    expect(runScenario(TAIWAN_CONVENTIONAL, v, settings()).stressDay).toBeNull();
  });
});
