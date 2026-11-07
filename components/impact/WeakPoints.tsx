"use client";
import type { WeakPoint } from "@/lib/contract";
import { useNature } from "@/lib/store";
import { SCENARIO_LABELS } from "@/lib/contract";
import { useFmt, useWeakPoints } from "../hooks";
import { Corners } from "../ui/Icon";

/** Engine-ranked weak points (guided step 1). Click an item to focus its piece on the board. */
export function WeakPoints() {
  const points = useWeakPoints();
  const fmt = useFmt();
  if (points.length === 0) return null;
  return (
    <section className="blueprint bp-card is-highlight" style={{ borderColor: "var(--red)" }} aria-label="Weak points">
      <Corners />
      <div className="kicker mb-1.5" style={{ color: "var(--red-deep)" }}>Weak points · {SCENARIO_LABELS.drought2021}</div>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {points.map((w) => <WeakPointItem key={w.id} w={w} money={fmt.money} />)}
      </ul>
    </section>
  );
}

function focusPiece(w: WeakPoint): void {
  const id = w.nodeIds[0];
  if (!id) return;
  useNature.getState().select(id);
  document.querySelector<SVGGElement>(`[data-pid="${id}"]`)?.focus();
}

function WeakPointItem({ w, money }: { w: WeakPoint; money: (v: number) => string }) {
  const high = w.severity === "high";
  return (
    <li>
      <button
        type="button"
        onClick={() => focusPiece(w)}
        disabled={w.nodeIds.length === 0}
        className="flex w-full cursor-pointer items-start gap-2 border-[1.5px] border-[var(--ink)] px-2 py-1.5 text-left hover:brightness-95 disabled:cursor-default"
        style={{ background: high ? "var(--red-tint)" : "var(--orange-tint)" }}
      >
        <span className="mt-[3px] h-[10px] w-[10px] flex-none rounded-full border-[1.5px] border-[var(--ink)]" style={{ background: high ? "var(--red)" : "var(--orange)" }} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] leading-tight font-bold">{w.title}</span>
          <span className="block text-[11.5px] leading-[1.25] text-[var(--color-neutral-700)]">{w.detail}</span>
        </span>
        {w.annualImpact !== null && <b className="text-[13px] whitespace-nowrap text-[var(--red-deep)]">{money(w.annualImpact)}/yr</b>}
      </button>
    </li>
  );
}
