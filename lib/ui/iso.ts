/** Isometric board geometry, ported from the wireframe (proj, shade, block extrusion). */
import type { Block } from "./pieceArt";

export const TILE_W = 56;
export const TILE_H = 28;
const ORIGIN_Y = 130;

export type Pt = readonly [number, number];

export interface BoardGeom {
  n: number;
  ox: number;
  oy: number;
  width: number;
  height: number;
}

export function boardGeom(n: number): BoardGeom {
  return { n, ox: n * TILE_W + 30, oy: ORIGIN_Y, width: 2 * n * TILE_W + 60, height: n * 2 * TILE_H + 190 };
}

export function proj(g: BoardGeom, gx: number, gy: number): Pt {
  return [g.ox + (gx - gy) * TILE_W, g.oy + (gx + gy) * TILE_H];
}

export function cellCenter(g: BoardGeom, x: number, y: number): Pt {
  return proj(g, x + 0.5, y + 0.5);
}

export function tileAt(g: BoardGeom, px: number, py: number): Pt | null {
  const u = (px - g.ox) / TILE_W;
  const v = (py - g.oy) / TILE_H;
  const x = Math.floor((u + v) / 2);
  const y = Math.floor((v - u) / 2);
  return x >= 0 && y >= 0 && x < g.n && y < g.n ? [x, y] : null;
}

export function pts(list: ReadonlyArray<Pt>): string {
  return list.map((q) => `${q[0]},${q[1]}`).join(" ");
}

/** Lighten (k>0) or darken (k<0) a #rrggbb color. */
export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const t = k > 0 ? 255 : 0;
  const a = Math.abs(k);
  const mix = (c: number) => Math.round(c + (t - c) * a);
  const r = mix(n >> 16);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

export interface BlockPolys {
  top: string;
  left: string;
  right: string;
  fillTop: string;
  fillLeft: string;
  fillRight: string;
}

/** Extrude a piece's blocks at screen center (cx, cy). Returns polygons and the stack height. */
export function extrude(cx: number, cy: number, spec: readonly Block[], base: string, override?: string): { blocks: BlockPolys[]; top: number } {
  let top = 0;
  const blocks = spec.map(([s, h, z = 0, dx = 0, dy = 0, c2]) => {
    const w = TILE_W * s;
    const d = TILE_H * s;
    const x = cx + dx;
    const y = cy + dy - z;
    const color = override ?? c2 ?? base;
    top = Math.max(top, z + h - dy);
    return {
      top: pts([[x, y - d - h], [x + w, y - h], [x, y + d - h], [x - w, y - h]]),
      left: pts([[x - w, y - h], [x, y + d - h], [x, y + d], [x - w, y]]),
      right: pts([[x + w, y - h], [x, y + d - h], [x, y + d], [x + w, y]]),
      fillTop: shade(color, 0.38),
      fillLeft: color,
      fillRight: shade(color, -0.22),
    };
  });
  return { blocks, top };
}

/** L-shaped pipe path between two cells, bending at (a.x, b.y). */
export function pipePath(g: BoardGeom, a: { x: number; y: number }, b: { x: number; y: number }): { d: string; mid: Pt } {
  const p = cellCenter(g, a.x, a.y);
  const q = cellCenter(g, b.x, b.y);
  const c = proj(g, a.x + 0.5, b.y + 0.5);
  return { d: `M${p[0]} ${p[1]} L${c[0]} ${c[1]} L${q[0]} ${q[1]}`, mid: c };
}
