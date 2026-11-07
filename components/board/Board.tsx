"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoardNode, EdgeResult, PieceType } from "@/lib/contract";
import { useNature } from "@/lib/store";
import { boardGeom, cellCenter, pipePath, proj, pts, tileAt, type BoardGeom, type Pt } from "@/lib/ui/iso";
import { BOARD_COLORS as C, TIER_COLORS } from "@/lib/ui/pieceArt";
import { useCatalog, useComparison, useWeakPoints } from "../hooks";
import { DRAG_MIME } from "../Palette";
import { BoardOverlays } from "./BoardOverlays";
import { BoardPiece, type PieceVisual } from "./BoardPiece";
import { BoardPipe, type PipeVisual } from "./BoardPipe";

const DRAG_THRESHOLD_PX = 5;
const SLAB_DEPTH = 16;
const MIN_FLOW_SECONDS = 0.5;
const MAX_FLOW_SECONDS = 2.4;

function flowSeconds(flow: number): number {
  return Math.max(MIN_FLOW_SECONDS, MAX_FLOW_SECONDS - Math.log10(flow + 1) * 0.4);
}

function pipeStyle(r: EdgeResult | undefined): Pick<PipeVisual, "color" | "dash"> {
  if (!r) return { color: "#7cc6ea" };
  if (!r.valid) return { color: C.red, dash: "10 8" };
  if (r.kind === "cooling") return { color: C.cooling, dash: "2 10" };
  if (r.kind === "brine") return { color: C.brine };
  if (r.kind === "wastewater") return { color: C.wastewater, dash: "14 6" };
  if (r.kind === "efficiency") return { color: C.efficiency };
  return { color: r.tier ? TIER_COLORS[r.tier] : "#7cc6ea" };
}

function useStaticSlab(geom: BoardGeom) {
  return useMemo(() => {
    const n = geom.n;
    const P = (x: number, y: number) => proj(geom, x, y);
    const down = (q: Pt): Pt => [q[0], q[1] + SLAB_DEPTH];
    let grid = "";
    for (let i = 0; i <= n; i++) {
      const a = P(i, 0), b = P(i, n), c = P(0, i), d = P(n, i);
      grid += `M${a[0]} ${a[1]}L${b[0]} ${b[1]}M${c[0]} ${c[1]}L${d[0]} ${d[1]}`;
    }
    const tiles: Array<{ x: number; y: number; pts: string }> = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) tiles.push({ x: i, y: j, pts: pts([P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)]) });
    return {
      grid,
      tiles,
      diamond: pts([P(0, 0), P(n, 0), P(n, n), P(0, n)]),
      left: pts([P(0, n), P(n, n), down(P(n, n)), down(P(0, n))]),
      right: pts([P(n, 0), P(n, n), down(P(n, n)), down(P(n, 0))]),
    };
  }, [geom]);
}

export function Board() {
  const board = useNature((s) => s.board);
  const size = useNature((s) => s.boardSize);
  const tool = useNature((s) => s.tool);
  const selected = useNature((s) => s.selected);
  const pending = useNature((s) => s.pending);
  const badPipe = useNature((s) => s.badPipe);
  const shakeId = useNature((s) => s.shakeId);
  const alertId = useNature((s) => s.alertId);
  const flashIds = useNature((s) => s.flash);
  const zoom = useNature((s) => s.zoom);
  const pan = useNature((s) => s.pan);
  const playing = useNature((s) => s.playing);
  const advisor = useNature((s) => s.advisor);
  const previewCard = useNature((s) => s.previewCard);
  const accepted = useNature((s) => s.acceptedCards);
  const mode = useNature((s) => s.mode);
  const demoFocus = useNature((s) => s.demoFocus);
  const store = useNature.getState;
  const catalog = useCatalog();
  const weakPoints = useWeakPoints();
  const weakByNode = useMemo(() => {
    const m = new Map<string, "high" | "medium">();
    for (const w of weakPoints) for (const id of w.nodeIds) if (m.get(id) !== "high") m.set(id, w.severity);
    return m;
  }, [weakPoints]);
  const comparison = useComparison();
  const geom = useMemo(() => boardGeom(size), [size]);
  const slab = useStaticSlab(geom);

  const gRef = useRef<SVGGElement>(null);
  const moved = useRef(false);
  const [rubber, setRubber] = useState<Pt | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const svgPt = useCallback((clientX: number, clientY: number): Pt => {
    const g = gRef.current;
    const m = g?.getScreenCTM();
    if (!g || !m) return [0, 0];
    const q = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return [q.x, q.y];
  }, []);

  // Keep keyboard focus on a piece after an arrow-key move re-sorts it in the DOM.
  const refocusId = useRef<string | null>(null);
  useEffect(() => {
    const id = refocusId.current;
    if (!id) return;
    refocusId.current = null;
    const el = gRef.current?.querySelector<SVGGElement>(`[data-pid="${id}"]`);
    if (el && document.activeElement !== el) el.focus();
  }, [board]);

  const ghosts: BoardNode[] = useMemo(() => {
    if (mode !== "advisor" || !advisor) return [];
    const card = previewCard ? (previewCard === "plan" ? advisor.plan : advisor.cards.find((c) => c.id === previewCard)) : accepted.includes("plan") ? null : advisor.plan;
    if (!card) return [];
    const known = new Set(board.nodes.map((n) => n.id));
    const taken = (x: number, y: number) => board.nodes.some((n) => n.x === x && n.y === y);
    return card.board.nodes.filter((n) => !known.has(n.id) && !taken(n.x, n.y)).map((n) => ({ ...n, ghost: true }));
  }, [mode, advisor, previewCard, accepted, board.nodes]);

  const stressNodes = comparison.design.stressDay?.nodes;
  const visuals: PieceVisual[] = useMemo(() => {
    const all = [...board.nodes, ...ghosts].sort((a, b) => a.x + a.y - (b.x + b.y));
    return all.map((node) => ({
      node,
      info: catalog[node.type],
      result: comparison.design.normalDay.nodes[node.id],
      atRisk: node.type === "municipal" && stressNodes?.[node.id]?.status === "partial",
      selected: selected === node.id,
      pending: pending === node.id,
      focused: focusedId === node.id,
      demoFocus: demoFocus.includes(node.id),
      weak: weakByNode.get(node.id) ?? null,
      shaking: shakeId === node.id,
      alert: alertId === node.id,
    }));
  }, [board.nodes, ghosts, catalog, comparison, stressNodes, selected, pending, focusedId, shakeId, alertId, demoFocus, weakByNode]);

  const pipes: PipeVisual[] = useMemo(() => {
    const byId = new Map(board.nodes.map((n) => [n.id, n]));
    const list: PipeVisual[] = [];
    for (const e of board.edges) {
      const a = byId.get(e.from), b = byId.get(e.to);
      if (!a || !b) continue;
      const r = comparison.design.normalDay.edges[e.id];
      const flow = r?.flow ?? 0;
      list.push({ key: e.id, d: pipePath(geom, a, b).d, ...pipeStyle(r), flow: r?.valid !== false && flow > 0, speed: flowSeconds(flow), width: 8, flash: flashIds.includes(e.id) });
    }
    if (badPipe) {
      const a = byId.get(badPipe.from), b = byId.get(badPipe.to);
      if (a && b) {
        const { d, mid } = pipePath(geom, a, b);
        list.push({ key: "bad", d, color: C.red, flow: false, speed: 1, width: 8, flash: false, bad: { mx: mid[0], my: mid[1] } });
      }
    }
    if (rubber && pending) {
      const a = byId.get(pending);
      if (a) {
        const c = cellCenter(geom, a.x, a.y);
        list.push({ key: "rubber", d: `M${c[0]} ${c[1]} L${rubber[0]} ${rubber[1]}`, color: C.orange, flow: false, speed: 1, width: 8, flash: false, rubber: true });
      }
    }
    return list;
  }, [board, comparison, geom, flashIds, badPipe, rubber, pending]);

  const onSvgPointerDown = (e: React.PointerEvent) => {
    moved.current = false;
    const sx = e.clientX, sy = e.clientY, p0 = { ...store().pan };
    const k = (e.currentTarget as SVGSVGElement).getScreenCTM()?.a || 1;
    const mv = (ev: PointerEvent) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!moved.current && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      moved.current = true;
      store().setPan({ x: p0.x + dx / k, y: p0.y + dy / k });
    };
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
  };

  const onPiecePointerDown = useCallback((e: React.PointerEvent, node: BoardNode) => {
    e.stopPropagation();
    moved.current = false;
    const st = store();
    if (st.tool === "delete" || node.ghost) return;
    const mode0 = st.tool;
    const start = svgPt(e.clientX, e.clientY);
    const c = cellCenter(geom, node.x, node.y);
    const off: Pt = [start[0] - c[0], start[1] - c[1]];
    const sx = e.clientX, sy = e.clientY;
    const mv = (ev: PointerEvent) => {
      if (!moved.current && Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_THRESHOLD_PX) return;
      moved.current = true;
      const q = svgPt(ev.clientX, ev.clientY);
      if (mode0 === "pipe") {
        if (store().pending !== node.id) useNature.setState({ pending: node.id });
        setRubber(q);
        return;
      }
      const t = tileAt(geom, q[0] - off[0], q[1] - off[1]);
      if (t) store().movePiece(node.id, t[0], t[1]);
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", up);
      if (moved.current && mode0 === "pipe") {
        setRubber(null);
        const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest("[data-pid]");
        const target = el?.getAttribute("data-pid");
        if (target && target !== node.id) store().connect(node.id, target);
        else useNature.setState({ pending: null });
      }
    };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
  }, [geom, svgPt, store]);

  const onPieceClick = useCallback((node: BoardNode) => {
    if (moved.current) { moved.current = false; return; }
    if (node.ghost) {
      const st = store();
      if (st.previewCard) st.acceptCard(st.previewCard);
      else if (st.advisor?.plan) st.acceptCard("plan");
      return;
    }
    store().clickPiece(node.id);
  }, [store]);

  const onPieceKey = useCallback((e: React.KeyboardEvent, node: BoardNode) => {
    const st = store();
    const arrows: Record<string, Pt> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); st.clickPiece(node.id); return; }
    if (arrows[e.key] && st.tool === "select") {
      e.preventDefault();
      const [dx, dy] = arrows[e.key];
      refocusId.current = node.id;
      st.movePiece(node.id, node.x + dx, node.y + dy);
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); st.removePiece(node.id); return; }
    if (e.key === "Escape") useNature.setState({ selected: null, pending: null });
  }, [store]);

  const onTileClick = (x: number, y: number) => {
    if (moved.current) { moved.current = false; return; }
    const st = store();
    if (st.tool === "select" && st.selected) {
      st.movePiece(st.selected, x, y);
      st.select(null);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    const type = e.dataTransfer.getData(DRAG_MIME) as PieceType;
    if (!type || !catalog[type]) return;
    e.preventDefault();
    const t = tileAt(geom, ...svgPt(e.clientX, e.clientY));
    store().addPiece(type, t ?? undefined);
  };

  const transform = `translate(${pan.x} ${pan.y}) translate(${geom.width / 2} ${geom.height / 2}) scale(${zoom}) translate(${-geom.width / 2} ${-geom.height / 2})`;

  return (
    <div
      className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden bg-[var(--paper)]"
      onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG_MIME)) e.preventDefault(); }}
      onDrop={onDrop}
    >
      <svg
        viewBox={`0 0 ${geom.width} ${geom.height}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-full w-full touch-none"
        onPointerDown={onSvgPointerDown}
        onWheel={(e) => store().setZoom(store().zoom * (e.deltaY < 0 ? 1.1 : 0.9))}
        role="application"
        aria-label={`Campus board, ${board.nodes.length} pieces. Tab to a piece; Enter selects or connects; arrow keys move; Delete removes.`}
      >
        <g ref={gRef} transform={transform}>
          <polygon points={slab.left} fill={C.slabLeft} stroke={C.ink} strokeWidth={3} strokeLinejoin="round" />
          <polygon points={slab.right} fill={C.slabRight} stroke={C.ink} strokeWidth={3} strokeLinejoin="round" />
          <polygon points={slab.diamond} fill={C.slabTop} stroke={C.ink} strokeWidth={3} strokeLinejoin="round" />
          <path d={slab.grid} stroke={C.grid} strokeWidth={1.5} fill="none" />
          {tool === "select" && selected && slab.tiles.map((t) => (
            <polygon key={`${t.x}-${t.y}`} points={t.pts} fill="transparent" style={{ cursor: "pointer" }} onClick={() => onTileClick(t.x, t.y)} />
          ))}
          {pipes.map((p) => <BoardPipe key={p.key} p={p} playing={playing} />)}
          {visuals.map((v) => (
            <BoardPiece key={v.node.id} geom={geom} v={v} layer="body" onPointerDown={onPiecePointerDown} onKeyDown={onPieceKey} onFocus={setFocusedId} onClick={onPieceClick} />
          ))}
          {visuals.map((v) => (
            <BoardPiece key={`l-${v.node.id}`} geom={geom} v={v} layer="labels" onPointerDown={onPiecePointerDown} onKeyDown={onPieceKey} onFocus={setFocusedId} onClick={onPieceClick} />
          ))}
        </g>
      </svg>
      <BoardOverlays />
    </div>
  );
}
