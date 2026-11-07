"use client";
import { memo } from "react";
import type { BoardNode, NodeResult, PieceInfo } from "@/lib/contract";
import { cellCenter, extrude, pts, shade, TILE_H, TILE_W, type BoardGeom } from "@/lib/ui/iso";
import { fmtCompact } from "@/lib/ui/format";
import { BOARD_COLORS as C, PIECE_ART, TIER_COLORS } from "@/lib/ui/pieceArt";

export interface PieceVisual {
  node: BoardNode;
  info: PieceInfo;
  result?: NodeResult;
  atRisk: boolean;
  selected: boolean;
  pending: boolean;
  focused: boolean;
  shaking: boolean;
  /** Highlighted by the current guided-demo step. */
  demoFocus: boolean;
  /** Flagged by engine.weakPoints() (guided step 1). */
  weak: "high" | "medium" | null;
  /** Guided step 2: glows red with a "!" marker; clicking it opens the constraint popup. */
  alert: boolean;
}

interface Badge { text: string; dot: string; bg: string }

function badgeFor(v: PieceVisual): Badge | null {
  const { node, info, result } = v;
  if (node.ghost) return { text: "AI suggests", dot: C.orange, bg: C.ghostTile };
  if (v.alert) return { text: "Click to connect to the fab", dot: C.red, bg: C.redTint };
  if (v.weak) return { text: v.weak === "high" ? "⚠ Weak point" : "⚠ Watch", dot: v.weak === "high" ? C.red : C.orange, bg: v.weak === "high" ? C.redTint : C.ghostTile };
  if (v.atRisk) return { text: "Supply at risk!", dot: C.red, bg: C.redTint };
  if (info.outputTier) {
    const flow = result && result.outflow > 0 ? ` · ${fmtCompact(result.outflow)} m³/d` : "";
    return { text: `T${info.outputTier}${flow}`, dot: TIER_COLORS[info.outputTier], bg: "#fff" };
  }
  if (info.requiredTier) {
    if (result?.status === "idle" || result?.status === "invalid" || result?.status === "offline") {
      return { text: `T${info.requiredTier} needed · no supply`, dot: C.red, bg: C.redTint };
    }
    const d = result?.demand;
    return { text: d ? `${fmtCompact(d)} m³/d` : `T${info.requiredTier} ok`, dot: TIER_COLORS[info.requiredTier], bg: result?.status === "partial" ? C.redTint : "#fff" };
  }
  return null;
}

interface Props {
  geom: BoardGeom;
  v: PieceVisual;
  /** Bodies are drawn depth-sorted; labels go in a second pass on top so nothing hides them. */
  layer: "body" | "labels";
  onPointerDown: (e: React.PointerEvent, node: BoardNode) => void;
  onKeyDown: (e: React.KeyboardEvent, node: BoardNode) => void;
  onFocus: (id: string | null) => void;
  onClick: (node: BoardNode) => void;
}

export const BoardPiece = memo(function BoardPiece({ geom, v, layer, onPointerDown, onKeyDown, onFocus, onClick }: Props) {
  const { node, info } = v;
  const art = PIECE_ART[node.type];
  const [cx, cy] = cellCenter(geom, node.x, node.y);
  const base = v.atRisk ? C.redPiece : art.color;
  const { blocks, top } = extrude(cx, cy, art.spec, base, node.ghost ? C.ghost : undefined);
  const badge = badgeFor(v);
  const labelW = info.name.length * 6.9 + 16;
  const badgeW = badge ? badge.text.length * 6.4 + 34 : 0;
  const badgeY = cy - top - TILE_H - 62;
  const ring = v.selected || v.pending || v.focused;
  const ringColor = v.pending ? C.orange : v.focused && !v.selected ? "#5980a6" : C.select;
  const status = v.result?.status;
  const label = `${info.name}${node.ghost ? " (AI suggestion)" : ""}${node.existing ? ", existing" : ""}${badge ? `, ${badge.text}` : ""}${status ? `, status ${status}` : ""}`;
  const cls = [v.shaking ? "anim-shake" : "", node.ghost ? "anim-glow" : "", v.alert ? "anim-alert" : ""].join(" ");

  if (layer === "labels") {
    return (
      <g className={v.shaking ? "anim-shake" : undefined} style={{ pointerEvents: "none" }} aria-hidden="true">
        <PieceLabels cx={cx} cy={cy} top={top} symBg={node.ghost ? C.ghostTile : shade(base, 0.7)} sym={art.sym} name={info.name} labelW={labelW} badge={badge} badgeW={badgeW} badgeY={badgeY} />
        {v.alert && <AlertMarker cx={cx + badgeW / 2 + 22} cy={badgeY + 11} onClick={() => onClick(node)} />}
      </g>
    );
  }

  return (
    <g
      data-pid={node.id}
      role="button"
      tabIndex={node.ghost ? -1 : 0}
      aria-label={label}
      aria-pressed={v.selected}
      className={cls}
      style={{ cursor: "pointer", outline: "none", opacity: node.ghost ? 0.92 : 1 }}
      onPointerDown={(e) => onPointerDown(e, node)}
      onClick={() => onClick(node)}
      onKeyDown={(e) => onKeyDown(e, node)}
      onFocus={() => onFocus(node.id)}
      onBlur={() => onFocus(null)}
    >
      {v.alert && (
        <polygon points={pts([[cx, cy - TILE_H - 8], [cx + TILE_W + 12, cy], [cx, cy + TILE_H + 8], [cx - TILE_W - 12, cy]])} fill={C.red} fillOpacity={0.18} stroke={C.red} strokeWidth={4} style={{ animation: "pulse 0.9s ease infinite" }} />
      )}
      {v.weak && (
        <polygon points={pts([[cx, cy - TILE_H - 8], [cx + TILE_W + 12, cy], [cx, cy + TILE_H + 8], [cx - TILE_W - 12, cy]])} fill={v.weak === "high" ? C.red : C.orange} fillOpacity={0.14} stroke={v.weak === "high" ? C.red : C.orange} strokeWidth={4} strokeDasharray="10 6" style={{ animation: "pulse 1.2s ease infinite" }} />
      )}
      {v.demoFocus && !ring && !v.weak && (
        <polygon points={pts([[cx, cy - TILE_H - 4], [cx + TILE_W + 6, cy], [cx, cy + TILE_H + 4], [cx - TILE_W - 6, cy]])} fill="none" stroke={C.orange} strokeWidth={4} strokeDasharray="8 6" style={{ animation: "pulse 1.2s ease infinite" }} />
      )}
      {ring && <polygon points={pts([[cx, cy - TILE_H - 2], [cx + TILE_W + 4, cy], [cx, cy + TILE_H + 2], [cx - TILE_W - 4, cy]])} fill="none" stroke={ringColor} strokeWidth={4} strokeDasharray="8 6" />}
      <polygon points={pts([[cx, cy - TILE_H + 6], [cx + TILE_W * 1.05, cy + 6], [cx, cy + TILE_H + 6], [cx - TILE_W * 1.05, cy + 6]])} fill={C.ink} opacity={0.12} />
      {blocks.map((b, i) => (
        <g key={i} stroke={node.ghost ? C.ghostStroke : C.ink} strokeWidth={3.5} strokeLinejoin="round">
          <polygon points={b.left} fill={b.fillLeft} />
          <polygon points={b.right} fill={b.fillRight} />
          <polygon points={b.top} fill={b.fillTop} />
        </g>
      ))}
    </g>
  );
});

/** Red "!" bubble above an alerted piece. Clickable even though the label layer ignores pointers. */
function AlertMarker({ cx, cy, onClick }: { cx: number; cy: number; onClick: () => void }) {
  return (
    <g className="anim-bob" style={{ pointerEvents: "auto", cursor: "pointer" }} onClick={onClick} role="presentation">
      <circle cx={cx} cy={cy} r={15} fill={C.red} stroke={C.ink} strokeWidth={3} />
      <text x={cx} y={cy + 7} textAnchor="middle" fill="#fff" style={{ font: "800 21px/1 var(--font-body)" }}>!</text>
    </g>
  );
}

interface LabelProps { cx: number; cy: number; top: number; symBg: string; sym: string; name: string; labelW: number; badge: Badge | null; badgeW: number; badgeY: number }

function PieceLabels({ cx, cy, top, symBg, sym, name, labelW, badge, badgeW, badgeY }: LabelProps) {
  return (
    <>
      <foreignObject x={cx - 16} y={cy - top - TILE_H - 34} width={32} height={30} style={{ overflow: "visible" }}>
        <div style={{ width: 32, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: symBg, border: `2.5px solid ${C.ink}`, borderRadius: 8, font: "700 20px/1 var(--font-body)", color: C.ink }}>
          {sym}
        </div>
      </foreignObject>
      <foreignObject x={cx - labelW / 2} y={cy + TILE_H + 4} width={labelW} height={20} style={{ overflow: "visible" }}>
        <div style={{ height: 20, background: "#fff", border: `2px solid ${C.ink}`, borderRadius: 10, textAlign: "center", font: "700 12.5px/16px var(--font-body)", whiteSpace: "nowrap", color: "#1d1f20" }}>
          {name}
        </div>
      </foreignObject>
      {badge && (
        <foreignObject x={cx - badgeW / 2} y={badgeY} width={badgeW} height={22} style={{ overflow: "visible" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, height: 22, padding: "0 8px", background: badge.bg, border: `2px solid ${C.ink}`, borderRadius: 11, font: "700 12px/1 var(--font-body)", whiteSpace: "nowrap", color: "#1d1f20" }}>
            <span style={{ flex: "none", width: 11, height: 11, borderRadius: "50%", background: badge.dot, border: `1.5px solid ${C.ink}` }} />
            {badge.text}
          </div>
        </foreignObject>
      )}
    </>
  );
}
