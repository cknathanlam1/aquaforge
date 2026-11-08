"use client";
import { useEffect, useMemo, useRef } from "react";
import type { Metric } from "@/lib/contract";
import { useNature } from "@/lib/store";
import { engine } from "@/lib/ui/engine";
import { useComparison, useFmt, useValues } from "./hooks";
import { brineMetric } from "./impact/offline";
import { Corners } from "./ui/Icon";
import { InfoButton } from "./ui/InfoButton";

const GREEN = "#17a37a";
const GREEN_TINT = "#e3f7ef";

interface Row { label: string; before: Metric; after: Metric; higherIsBetter: boolean }

/** Positive sibling of the constraint popup: a better option for a design that already works. */
export function SuggestionPopup() {
  const sug = useNature((s) => s.suggestion);
  const settings = useNature((s) => s.settings);
  const { acceptSuggestion, closeSuggestion } = useNature.getState();
  const values = useValues();
  const now = useComparison();
  const fmt = useFmt();
  const ref = useRef<HTMLDivElement>(null);
  // One extra evaluation, only while the popup is open: the "after" side of before → after.
  const after = useMemo(() => (sug ? engine.compare(sug.board, values, settings) : null), [sug, values, settings]);

  useEffect(() => {
    if (!sug) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeSuggestion(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [sug, closeSuggestion]);

  if (!sug || !after) return null;
  const rows: Row[] = [
    { label: "Net annual savings", before: now.metrics.netAnnualSavings, after: after.metrics.netAnnualSavings, higherIsBetter: true },
    { label: "Treatment energy", before: now.metrics.treatmentEnergy, after: after.metrics.treatmentEnergy, higherIsBetter: false },
    { label: "Brine to dispose", before: brineMetric(now), after: brineMetric(after), higherIsBetter: false },
    { label: "Capex", before: now.metrics.capex, after: after.metrics.capex, higherIsBetter: false },
  ];
  const color = (r: Row) => {
    const a = r.before.value, b = r.after.value;
    if (a === null || b === null || a === b) return undefined;
    return (r.higherIsBetter ? b > a : b < a) ? "var(--green-deep)" : "var(--red-deep)";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1d1f2059]">
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="sg-title" className="blueprint anim-pop w-[600px] max-w-[94vw] border-[2.5px] border-[var(--ink)] bg-white shadow-[0_10px_0_#22323f44]">
        <Corners />
        <div className="max-h-[90vh] overflow-y-auto px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="h-[34px] w-[34px] flex-none rounded-full border-[2.5px] border-[var(--ink)] text-center text-[20px] leading-[29px] font-bold text-white" style={{ background: GREEN }} aria-hidden="true">↑</span>
            <h2 id="sg-title" className="heading m-0 text-[30px] uppercase tracking-[0.02em]">{sug.title}</h2>
          </div>
          <p className="mt-2 mb-1 text-[14px] text-[var(--color-neutral-700)]">This design works. Here is a better one.</p>
          <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
            {sug.reasons.map((r) => (
              <li key={r} className="flex gap-2 text-[15px] leading-[1.4]"><span aria-hidden="true" style={{ color: GREEN }}>✓</span><span>{r}</span></li>
            ))}
          </ul>
          <div className="kicker mt-3.5 mb-1" style={{ fontSize: 12 }}>Before → after</div>
          <table className="w-full border-collapse text-[14px]" style={{ background: GREEN_TINT }}>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-dashed border-[#a8dcc6]">
                  <td className="px-2.5 py-1.5 font-semibold">{r.label}</td>
                  <td className="px-2 py-1.5 text-right text-[var(--color-neutral-700)]">{fmt.value(r.before.value, r.before.unit)}</td>
                  <td className="px-1 text-center" aria-hidden="true">→</td>
                  <td className="px-2 py-1.5 text-right font-bold" style={{ color: color(r) }}>{fmt.value(r.after.value, r.after.unit)}</td>
                  <td className="w-7 pr-1"><InfoButton metrics={[r.after]} title={r.label} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-[18px] flex flex-wrap gap-2.5">
            <button
              type="button"
              className="nbtn"
              style={{ fontSize: 16, padding: "11px 18px", borderWidth: 2.5, boxShadow: "0 4px 0 var(--ink)", background: GREEN, color: "#fff", fontWeight: 700 }}
              onClick={acceptSuggestion}
            >
              {sug.to === "harmony" ? "Switch to Harmony" : sug.title}
            </button>
            <button type="button" className="nbtn nbtn-link ml-auto" style={{ fontSize: 15 }} onClick={closeSuggestion}>Not now</button>
          </div>
        </div>
      </div>
    </div>
  );
}
