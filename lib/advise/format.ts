/**
 * Number formatting shared by the scripted explainer and the LLM prompt.
 * Every number either path shows to a user goes through one of these, so the
 * "only cite numbers present in the request" guarantee is checkable.
 */

import type { Metric, MetricUnit } from "../contract";

const MILLION = 1_000_000;
const THOUSAND = 1_000;

function trimZeros(text: string): string {
  return text.includes(".") ? text.replace(/\.?0+$/, "") : text;
}

/** "$1.25M", "$350K", "$740", "-$2.1M". */
export function formatUsd(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= MILLION) return `${sign}$${trimZeros((abs / MILLION).toFixed(2))}M`;
  if (abs >= THOUSAND) return `${sign}$${trimZeros((abs / THOUSAND).toFixed(1))}K`;
  return `${sign}$${Math.round(abs).toLocaleString("en-US")}`;
}

export function formatYears(value: number): string {
  const rounded = trimZeros(value.toFixed(1));
  return `${rounded} ${rounded === "1" ? "year" : "years"}`;
}

/** Engine percentages may arrive as 0-1 fractions or 0-100; both render as "42%". */
export function formatPct(value: number): string {
  const pct = Math.abs(value) <= 1 ? value * 100 : value;
  return `${trimZeros(pct.toFixed(1))}%`;
}

export function formatPlain(value: number, digits = 1): string {
  const rounded = Number(value.toFixed(digits));
  return rounded.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function formatValue(value: number | null, unit: MetricUnit | string): string {
  if (value === null || !Number.isFinite(value)) return "not computed";
  switch (unit) {
    case "usd":
      return formatUsd(value);
    case "usd/yr":
      return `${formatUsd(value)}/yr`;
    case "years":
      return formatYears(value);
    case "pct":
      return formatPct(value);
    case "m3/day":
      return `${formatPlain(value, 0)} m³/day`;
    case "kWh/day":
      return `${formatPlain(value, 0)} kWh/day`;
    case "tankers/day":
      return `${formatPlain(value, 1)} tankers/day`;
    case "score":
      return formatPlain(value, 2);
    default:
      return `${formatPlain(value, 2)} ${unit}`.trim();
  }
}

export function formatMetric(metric: Metric): string {
  return formatValue(metric.value, metric.unit);
}
