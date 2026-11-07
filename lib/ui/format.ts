/** Display formatting. All money arrives in USD; NT$ is converted at display time with fx.twdPerUsd. */
import type { Metric, MetricUnit } from "@/lib/contract";

export type Currency = "USD" | "TWD";

export interface FormatCtx {
  currency: Currency;
  fx: number;
}

const MINUS = "−";

export function fmtNumber(n: number, digits = 0): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function fmtCompact(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? MINUS : "";
  if (a >= 1e9) return `${sign}${(a / 1e9).toFixed(a >= 1e10 ? 1 : 2)}B`;
  if (a >= 1e6) return `${sign}${(a / 1e6).toFixed(a >= 1e8 ? 0 : a >= 1e7 ? 1 : 2)}M`;
  if (a >= 1e4) return `${sign}${(a / 1e3).toFixed(a >= 1e5 ? 0 : 1)}k`;
  return `${sign}${fmtNumber(a)}`;
}

export function fmtMoney(usd: number, ctx: FormatCtx, opts: { compact?: boolean; signed?: boolean } = {}): string {
  const v = ctx.currency === "TWD" ? usd * ctx.fx : usd;
  const sym = ctx.currency === "TWD" ? "NT$" : "$";
  const a = Math.abs(v);
  const body = opts.compact === false ? fmtNumber(a) : fmtCompact(a);
  const sign = v < 0 ? MINUS : opts.signed && v > 0 ? "+" : "";
  return `${sign}${sym}${body}`;
}

export function fmtValue(value: number | null, unit: MetricUnit | string, ctx: FormatCtx): string {
  if (value === null || !Number.isFinite(value)) return "—";
  switch (unit) {
    case "usd":
      return fmtMoney(value, ctx);
    case "usd/yr":
      return `${fmtMoney(value, ctx)}/yr`;
    case "years":
      return `${value.toFixed(1)} yr`;
    case "m3/day":
      return `${fmtCompact(value)} m³/day`;
    case "pct":
      return `${value.toFixed(value < 10 ? 1 : 0)}%`;
    case "kWh/day":
      return `${fmtCompact(value)} kWh/day`;
    case "tankers/day":
      return `${fmtNumber(value)} tankers/day`;
    case "score":
      return `${Math.round(value)}/100`;
    case "fraction":
    case "fraction/yr":
      return fmtNumber(value, 3);
    default:
      return `${fmtNumber(value, Math.abs(value) < 10 ? 3 : 0)} ${unit}`;
  }
}

/** Big headline number for a metric (no unit suffix for money). */
export function fmtHeadline(m: Metric, ctx: FormatCtx): string {
  if (m.value === null) return "—";
  if (m.unit === "usd" || m.unit === "usd/yr") return fmtMoney(m.value, ctx);
  if (m.unit === "years") return `${m.value.toFixed(1)} yr`;
  if (m.unit === "pct") return `${Math.round(m.value)}%`;
  if (m.unit === "score") return String(Math.round(m.value));
  return fmtCompact(m.value);
}

export const UNIT_LABEL: Record<MetricUnit, string> = {
  usd: "",
  "usd/yr": "per year",
  years: "",
  "m3/day": "m³/day",
  pct: "",
  "kWh/day": "kWh/day",
  "tankers/day": "tankers/day",
  score: "out of 100",
};
