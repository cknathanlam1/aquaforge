import { describe, expect, it } from "vitest";
import { defaultValues } from "../lib/assumptions";
import { neighborBoard, resilienceBoard } from "./fixtures";
import { compare, dailySurcharge, npv, simplePayback } from "../lib/finance";
import { TAIWAN_CONVENTIONAL } from "../lib/presets";
import { m3ToTonnes, tonnesToM3, twdToUsd, usdToTwd } from "../lib/units";
import { settings } from "./helpers";

const v = defaultValues();

describe("payback and NPV fixtures (hand-calculated)", () => {
  it("payback = capex ÷ savings", () => {
    expect(simplePayback(10_000_000, 2_000_000)).toBe(5);
  });

  it("no payback when savings are zero or negative", () => {
    expect(simplePayback(10_000_000, 0)).toBeNull();
    expect(simplePayback(10_000_000, -1)).toBeNull();
  });

  it("NPV at 8% over 10 years", () => {
    // Annuity factor (1 − 1.08^−10) ÷ 0.08 = 6.710081; 1,000,000 × 6.710081 − 5,000,000.
    expect(npv(1_000_000, 0.08, 10, 5_000_000)).toBeCloseTo(1_710_081.4, 0);
  });

  it("negative NPV is reported, not hidden", () => {
    expect(npv(100_000, 0.08, 10, 5_000_000)).toBeLessThan(0);
  });
});

describe("surcharge", () => {
  it("charges only consumption above 9,000 m³/month, and only in the Nov–Apr season", () => {
    const perDay = 1000; // 30,416.7 m³/month → 21,416.7 above threshold
    const monthly = (perDay * 365) / 12;
    const expected = (((monthly - 9000) * v["policy.surchargeRate"]) / (365 / 12)) * (181 / 365);
    expect(dailySurcharge(perDay, v, 1)).toBeCloseTo(expected, 9);
    expect(dailySurcharge(200, v, 1)).toBe(0);
  });
});

describe("design vs do-nothing baseline", () => {
  it("the Taiwan preset is its own baseline: zero savings, zero capex", () => {
    const c = compare(TAIWAN_CONVENTIONAL, v, settings());
    expect(c.metrics.netAnnualSavings.value).toBeCloseTo(0, 2);
    expect(c.metrics.capex.value).toBe(0);
  });

  it("a 2021-type drought costs the do-nothing baseline more than a normal year", () => {
    const c = compare(TAIWAN_CONVENTIONAL, v, settings({ scenarioId: "drought2021" }));
    expect(c.metrics.costOfDoingNothing.value).toBeGreaterThan(0);
    expect(c.metrics.tankersPerDay.value).toBeGreaterThan(0);
  });

  it("risk-adjusted savings = net savings + avoided expected disruption", () => {
    const c = compare(resilienceBoard(), v, settings({ scenarioId: "drought2021" }));
    const avoided = c.baseline.expectedDisruptionCost - c.design.expectedDisruptionCost;
    expect(c.metrics.riskAdjustedSavings.value).toBeCloseTo((c.metrics.netAnnualSavings.value ?? 0) + avoided, 2);
  });

  it("payback and NPV metrics match the pure formulas", () => {
    const c = compare(resilienceBoard(), v, settings({ scenarioId: "drought2021" }));
    const capex = c.metrics.capex.value ?? 0;
    const net = c.metrics.netAnnualSavings.value ?? 0;
    expect(c.metrics.payback.value).toBe(simplePayback(capex, net));
    expect(c.metrics.npv.value).toBeCloseTo(npv(net, 0.08, 10, capex), 2);
  });

  it("every metric shows its formula and inputs", () => {
    const c = compare(resilienceBoard(), v, settings({ scenarioId: "drought2021" }));
    for (const m of Object.values(c.metrics)) {
      expect(m.formula.length).toBeGreaterThan(5);
      expect(Array.isArray(m.inputs)).toBe(true);
    }
  });
});

describe("unit conversions", () => {
  it("USD ↔ NT$ round-trips", () => {
    expect(twdToUsd(usdToTwd(1234.56, 32), 32)).toBeCloseTo(1234.56, 9);
  });

  it("m³ ↔ t round-trips (1 m³ of water = 1 t)", () => {
    expect(m3ToTonnes(20000)).toBe(20000);
    expect(tonnesToM3(m3ToTonnes(156000))).toBe(156000);
  });

  it("rejects a non-positive exchange rate", () => {
    expect(() => twdToUsd(100, 0)).toThrow();
  });
});
