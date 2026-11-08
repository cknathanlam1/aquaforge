"use client";
import { useState } from "react";
import type { PaletteGroup, PieceInfo } from "@/lib/contract";
import { useNature } from "@/lib/store";
import { shade } from "@/lib/ui/iso";
import { PALETTE_GROUPS, PIECE_ART, TIER_COLORS } from "@/lib/ui/pieceArt";
import { useCatalog } from "./hooks";

const NO_TIER = "#7d8890";

function tierTag(p: PieceInfo): { text: string; color: string } {
  if (p.outputTier) return { text: `T${p.outputTier}`, color: TIER_COLORS[p.outputTier] };
  if (p.requiredTier) return { text: `≥T${p.requiredTier}`, color: TIER_COLORS[p.requiredTier] };
  return { text: "—", color: NO_TIER };
}

export const DRAG_MIME = "application/x-aquaforge-piece";

export function Palette() {
  const catalog = useCatalog();
  const tool = useNature((s) => s.tool);
  const { addPiece, setTool } = useNature.getState();
  const [open, setOpen] = useState<Record<PaletteGroup, boolean>>({ src: true, trt: true, fab: false, dc: false, eff: false, con: true, nbr: false });
  const pieces = Object.values(catalog);

  return (
    <div>
      <div className="kicker px-3.5 pt-3.5 pb-1.5">Piece palette</div>
      {PALETTE_GROUPS.map(([group, label]) => {
        const isOpen = open[group];
        const items = pieces.filter((p) => p.group === group);
        return (
          <div key={group}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen({ ...open, [group]: !isOpen })}
              className="flex w-full cursor-pointer items-center justify-between border-0 border-t border-[var(--color-neutral-300)] bg-[var(--cat-bg)] px-3.5 py-2 text-left font-[family-name:var(--font-heading)] text-[15px] font-bold tracking-[0.08em] hover:bg-[var(--hover-tint)]"
            >
              <span>{label}</span>
              <span aria-hidden="true">{isOpen ? "▾" : "▸"}</span>
            </button>
            {isOpen && (
              <ul className="m-0 list-none px-2 pt-1 pb-2">
                {group === "con" && (
                  <li>
                    <PaletteRow name="Pipe (connect two pieces)" sym="╱" symBg="#e3f3fa" tag={{ text: "tool", color: NO_TIER }} pressed={tool === "pipe"} onClick={() => setTool(tool === "pipe" ? "select" : "pipe")} />
                  </li>
                )}
                {items.map((p) => {
                  const art = PIECE_ART[p.type];
                  return (
                    <li key={p.type}>
                      <PaletteRow
                        name={p.name}
                        title={p.description}
                        sym={art.sym}
                        symBg={shade(art.color, 0.6)}
                        tag={tierTag(p)}
                        onClick={() => addPiece(p.type)}
                        onDragStart={(e) => { e.dataTransfer.setData(DRAG_MIME, p.type); e.dataTransfer.effectAllowed = "copy"; }}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
      <p className="m-0 border-t border-[var(--color-neutral-300)] px-3.5 py-2.5 text-[12.5px] text-[var(--color-neutral-600)]">
        Click a piece to drop it on the board, or drag it onto a tile. Use <b>Pipe</b> to connect two pieces.
      </p>
    </div>
  );
}

interface RowProps {
  name: string;
  title?: string;
  sym: string;
  symBg: string;
  tag: { text: string; color: string };
  pressed?: boolean;
  onClick: () => void;
  onDragStart?: (e: React.DragEvent) => void;
}

function PaletteRow({ name, title, sym, symBg, tag, pressed, onClick, onDragStart }: RowProps) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={pressed}
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-2.5 border-[1.5px] px-1.5 py-[5px] text-left text-[14px] font-medium hover:border-[var(--ink)] hover:bg-[var(--hover-tint)] ${pressed ? "border-[var(--ink)] bg-[var(--hover-tint)]" : "border-transparent bg-transparent"}`}
    >
      <span className="flex h-[30px] w-[30px] flex-none items-center justify-center border-[1.5px] border-[var(--ink)] text-[18px] font-bold text-[var(--ink)]" style={{ background: symBg }} aria-hidden="true">
        {sym}
      </span>
      <span className="flex-1 leading-[1.15]">{name}</span>
      <span className="tag" style={{ background: tag.color }}>{tag.text}</span>
    </button>
  );
}
