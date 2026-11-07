"use client";
import { useMemo } from "react";
import { withOverrides, type AssumptionValues } from "@/lib/assumptions";
import type { Board, Comparison, Metric, PieceInfo, PieceType, ScenarioSettings } from "@/lib/contract";
import { useNature } from "@/lib/store";
import { engine } from "@/lib/ui/engine";
import { fmtHeadline, fmtMoney, fmtValue, type FormatCtx } from "@/lib/ui/format";

export function useValues(): AssumptionValues {
  const overrides = useNature((s) => s.overrides);
  return useMemo(() => withOverrides(overrides), [overrides]);
}

/** Last comparison that computed cleanly, so an engine exception never blanks the whole UI. */
const cache: { lastGood: Comparison | null; lastError: string } = { lastGood: null, lastError: "" };

function safeCompare(board: Board, values: AssumptionValues, settings: ScenarioSettings): Comparison {
  try {
    cache.lastGood = engine.compare(board, values, settings);
    cache.lastError = "";
    return cache.lastGood;
  } catch (err: unknown) {
    if (!cache.lastGood) throw err;
    const msg = `Engine error, showing last good numbers: ${err instanceof Error ? err.message : "unknown"}`;
    if (msg !== cache.lastError) {
      cache.lastError = msg;
      queueMicrotask(() => useNature.getState().notify(msg, "error"));
    }
    return cache.lastGood;
  }
}

export function useComparison(): Comparison {
  const board = useNature((s) => s.board);
  const settings = useNature((s) => s.settings);
  const values = useValues();
  return useMemo(() => safeCompare(board, values, settings), [board, values, settings]);
}

const CATALOG: Record<PieceType, PieceInfo> = Object.fromEntries(engine.pieceCatalog().map((p) => [p.type, p])) as Record<PieceType, PieceInfo>;

export function useCatalog(): Record<PieceType, PieceInfo> {
  return CATALOG;
}

export interface Fmt {
  ctx: FormatCtx;
  money: (usd: number, opts?: { compact?: boolean; signed?: boolean }) => string;
  value: (v: number | null, unit: string) => string;
  headline: (m: Metric) => string;
}

export function useFmt(): Fmt {
  const currency = useNature((s) => s.currency);
  const values = useValues();
  return useMemo(() => {
    const ctx: FormatCtx = { currency, fx: values["fx.twdPerUsd"] };
    return {
      ctx,
      money: (usd, opts) => fmtMoney(usd, ctx, opts),
      value: (v, unit) => fmtValue(v, unit, ctx),
      headline: (m) => fmtHeadline(m, ctx),
    };
  }, [currency, values]);
}
