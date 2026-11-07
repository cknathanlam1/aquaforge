"use client";
import { useEffect, useRef } from "react";
import type { TierStep } from "@/lib/contract";
import { useNature } from "@/lib/store";
import { useCatalog } from "./hooks";
import { Corners } from "./ui/Icon";

const STEP_STYLE: Record<TierStep["status"], { bg: string; border: string; style: string; note: string; noteColor: string }> = {
  have: { bg: "var(--green-tint)", border: "var(--ink)", style: "solid", note: "have it", noteColor: "var(--green-deep)" },
  missing: { bg: "var(--orange-tint)", border: "var(--orange)", style: "dashed", note: "MISSING", noteColor: "var(--orange-deep)" },
  target: { bg: "var(--white)", border: "var(--ink)", style: "solid", note: "target", noteColor: "var(--muted)" },
};

/** Modal shown when EngineApi.checkConnection rejects a pipe. */
export function ConstraintPopup() {
  const popup = useNature((s) => s.popup);
  const why = useNature((s) => s.popupWhy);
  const { closePopup, togglePopupWhy, acceptRecommendation } = useNature.getState();
  const catalog = useCatalog();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!popup) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closePopup(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [popup, closePopup]);

  if (!popup) return null;
  const recs = popup.recommendedPieces.map((t) => catalog[t]).filter(Boolean);
  const hasRec = recs.length > 0;
  const title = popup.severity === "error" ? "Not so fast!" : "Heads up";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1d1f2059]">
      <div ref={ref} role="alertdialog" aria-modal="true" aria-labelledby="cp-title" aria-describedby="cp-body" className="blueprint anim-pop w-[600px] max-w-[94vw] border-[2.5px] border-[var(--ink)] bg-white shadow-[0_10px_0_#22323f44]">
        <Corners />
        <div className="max-h-[90vh] overflow-y-auto px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="h-[34px] w-[34px] flex-none rounded-full border-[2.5px] border-[var(--ink)] bg-[var(--red)] text-center text-[20px] leading-[29px] font-bold text-white" aria-hidden="true">✕</span>
          <h2 id="cp-title" className="heading m-0 text-[32px] uppercase tracking-[0.02em]">{title}</h2>
        </div>
        <p id="cp-body" className="mt-3 mb-1 text-[16px] leading-[1.5]">{popup.message}</p>
        {popup.tierChain.length > 0 && (
          <>
            <div className="kicker mt-3.5 mb-1.5" style={{ fontSize: 12 }}>Tier chain</div>
            <ol className="m-0 flex list-none flex-wrap items-stretch gap-y-2 p-0" aria-label="Tier chain">
              {popup.tierChain.map((s, i) => {
                const st = STEP_STYLE[s.status];
                return (
                  <li key={`${s.label}-${i}`} className="flex items-center">
                    {i > 0 && <span className="px-1.5 text-[22px] font-bold" aria-hidden="true">›</span>}
                    <div className="min-w-[104px] px-2.5 py-2 text-center" style={{ border: `2.5px ${st.style} ${st.border}`, background: st.bg }}>
                      <div className="text-[15px] font-bold">{s.label}</div>
                      <div className="text-[12px] font-semibold">{s.status === "target" ? `Needs Tier ${s.tier}` : s.tier ? `Tier ${s.tier}` : "—"}</div>
                      <div className="text-[11px] font-bold" style={{ color: st.noteColor }}>{st.note}</div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
        {hasRec && (
          <div className="mt-3.5 border-2 border-[var(--orange)] bg-[var(--orange-tint)] px-3 py-2.5 text-[15px]">
            <b>Recommended:</b> {recs.map((p) => `${p.name.replace(" (EDI+UV)", "")}${p.outputTier ? ` (Tier ${p.outputTier})` : ""}`).join(" + ")}
          </div>
        )}
        {why && <div className="mt-3 border-[1.5px] border-[var(--ink)] bg-[var(--note-bg)] p-3 text-[14.5px] leading-[1.5]">{popup.reasonText}</div>}
        <div className="mt-[18px] flex flex-wrap gap-2.5">
          {hasRec && (
            <button type="button" className="nbtn nbtn-orange" style={{ fontSize: 16, padding: "11px 18px", borderWidth: 2.5, boxShadow: "0 4px 0 var(--ink)" }} onClick={acceptRecommendation}>
              Add recommended pieces
            </button>
          )}
          <button type="button" className="nbtn" style={{ fontSize: 16, padding: "11px 18px", borderWidth: 2, fontWeight: 700 }} aria-expanded={why} onClick={togglePopupWhy}>Why?</button>
          <button type="button" className="nbtn nbtn-link ml-auto" style={{ fontSize: 15 }} onClick={closePopup}>Got it</button>
        </div>
        </div>
      </div>
    </div>
  );
}
