/** Unit and currency conversions. 1 m³ of water = 1 metric ton. */

export type Currency = "USD" | "TWD";

export const TONNES_PER_M3 = 1;
export const DAYS_PER_YEAR = 365;
export const DAYS_PER_MONTH = DAYS_PER_YEAR / 12;
export const HOURS_PER_DAY = 24;

export function m3ToTonnes(m3: number): number {
  return m3 * TONNES_PER_M3;
}

export function tonnesToM3(tonnes: number): number {
  return tonnes / TONNES_PER_M3;
}

export function usdToTwd(usd: number, twdPerUsd: number): number {
  return usd * twdPerUsd;
}

export function twdToUsd(twd: number, twdPerUsd: number): number {
  if (twdPerUsd <= 0) throw new Error("Exchange rate must be positive");
  return twd / twdPerUsd;
}

export function convertFromUsd(usd: number, currency: Currency, twdPerUsd: number): number {
  return currency === "USD" ? usd : usdToTwd(usd, twdPerUsd);
}

const SUFFIXES: Array<[number, string]> = [
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "k"],
];

export function compactNumber(value: number, digits = 1): string {
  const abs = Math.abs(value);
  for (const [scale, suffix] of SUFFIXES) {
    if (abs >= scale) return `${(value / scale).toFixed(digits)}${suffix}`;
  }
  return value.toFixed(abs < 10 && abs !== 0 ? 2 : 0);
}

export function formatMoney(usd: number, currency: Currency, twdPerUsd: number, digits = 1): string {
  if (!Number.isFinite(usd)) return "n/a";
  const amount = convertFromUsd(usd, currency, twdPerUsd);
  const sign = amount < 0 ? "-" : "";
  const symbol = currency === "USD" ? "$" : "NT$";
  return `${sign}${symbol}${compactNumber(Math.abs(amount), digits)}`;
}

export function formatM3(m3: number): string {
  return `${Math.round(m3).toLocaleString("en-US")} m³`;
}

export function formatPct(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}
