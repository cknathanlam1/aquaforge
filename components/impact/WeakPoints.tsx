"use client";
import { useState } from "react";
import { SCENARIO_LABELS, type PieceInfo, type PieceType, type WeakPoint } from "@/lib/contract";
import { useNature } from "@/lib/store";
import { PIECE_ART } from "@/lib/ui/pieceArt";
import { useCatalog, useFmt, useWeakPoints } from "../hooks";
import { Corners, Icon } from "../ui/Icon";

/**
 * Engine-ranked weak points (guided step 1). Clicking one focuses its piece and expands the fix;
 * each fix chip drops that piece next to the weak point's first node.
 */
export function WeakPoints() {
  const points = useWeakPoints();
  const fmt = useFmt();
  const catalog = useCatalog();
  const [open, setOpen] = useState<string | null>(null);
  if (points.length === 0) return null;
  return (
    <section className="blueprint bp-card is-highlight" style={{ borderColor: "var(--red)" }} aria-label="Weak points">
      <Corners />
      <div className="kicker mb-1.5" style={{ color: "var(--red-deep)" }}>Weak points · {SCENARIO_LABELS.drought2021}</div>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {points.map((w) => (
          <WeakPointItem key={w.id} w={w} money={fmt.money} catalog={catalog} expanded={open === w.id} onToggle={() => setOpen(open === w.id ? null : w.id)} />
        ))}
      </ul>
      <p className="m-0 mt-1.5 text-[11.5px] text-[var(--color-neutral-600)]">Click a weak point for the fix.</p>
    </section>
  );
}

function focusPiece(id: string | undefined): void {
  if (!id) return;
  useNature.getState().select(id);
  document.querySelector<SVGGElement>(`[data-pid="${id}"]`)?.focus({ preventScroll: true });
}

interface ItemProps {
  w: WeakPoint;
  money: (v: number) => string;
  catalog: Record<PieceType, PieceInfo>;
  expanded: boolean;
  onToggle: () => void;
}

function WeakPointItem({ w, money, catalog, expanded, onToggle }: ItemProps) {
  const high = w.severity === "high";
  const addPieceNear = useNature((s) => s.addPieceNear);
  const addPiece = useNature((s) => s.addPiece);
  const anchor = w.nodeIds[0];
  const impact = w.annualImpact !== null ? `${money(w.annualImpact)}/yr` : w.lostPerHour ? `${money(w.lostPerHour)}/hour lost` : null;

  return (
    <li className="border-[1.5px] border-[var(--ink)]" style={{ background: high ? "var(--red-tint)" : "var(--orange-tint)" }}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => { onToggle(); focusPiece(anchor); }}
        className="flex w-full cursor-pointer items-start gap-2 border-0 bg-transparent px-2 py-1.5 text-left hover:brightness-95"
      >
        <span className="mt-[3px] h-[10px] w-[10px] flex-none rounded-full border-[1.5px] border-[var(--ink)]" style={{ background: high ? "var(--red)" : "var(--orange)" }} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] leading-tight font-bold">{w.title}</span>
          <span className="block text-[11.5px] leading-[1.25] text-[var(--color-neutral-700)]">{w.detail}</span>
        </span>
        <span className="flex flex-col items-end gap-0.5">
          {impact && <b className="text-[13px] whitespace-nowrap text-[var(--red-deep)]">{impact}</b>}
          <Icon name={expanded ? "chevronDown" : "chevronRight"} size={14} />
        </span>
      </button>
      {expanded && (
        <div className="border-t border-dashed border-[var(--ink)] bg-white px-2 py-1.5">
          <div className="text-[10.5px] font-bold tracking-[0.1em] text-[var(--green-deep)] uppercase">How to fix it</div>
          <p className="m-0 text-[12.5px] leading-[1.35]">{w.fix}</p>
          {w.fixPieces.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1" role="group" aria-label="Add a fix piece">
              {w.fixPieces.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="nbtn nbtn-sm"
                  style={{ padding: "3px 7px", fontSize: 12 }}
                  title={anchor ? `Add next to the affected piece` : "Add to the board"}
                  onClick={() => (anchor ? addPieceNear(t, anchor) : addPiece(t))}
                >
                  <span aria-hidden="true">{PIECE_ART[t].sym}</span> + {catalog[t]?.name ?? t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
