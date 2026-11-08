/**
 * Visual tables for board pieces, keyed by PieceType. Ported from the Claude Design
 * wireframe (design/Water Sim.dc.html: COL, SYM, CODE, SPEC). Pure presentation data:
 * nothing here changes a dollar or m³ result.
 */
import type { PaletteGroup, PieceType, Tier } from "@/lib/contract";

/** One extruded block: [scale, height, z-lift, dx, dy, colorOverride]. */
export type Block = readonly [number, number, number?, number?, number?, string?];

export interface PieceArt {
  /** Short code shown in compact labels. */
  code: string;
  /** Glyph on the floating symbol tile. */
  sym: string;
  /** Base block color. */
  color: string;
  spec: readonly Block[];
}

export const TIER_COLORS: Record<Tier, string> = {
  1: "#a8896a",
  2: "#7cc6ea",
  3: "#2db8a3",
  4: "#2f78c9",
  5: "#1b2f6b",
};

export const PALETTE_GROUPS: ReadonlyArray<readonly [PaletteGroup, string]> = [
  ["src", "WATER SOURCES"],
  ["trt", "TREATMENT"],
  ["fab", "SEMICONDUCTOR FAB"],
  ["dc", "DATA CENTER CAMPUS"],
  ["eff", "EFFICIENCY"],
  ["con", "CONNECTORS"],
  ["nbr", "NEIGHBORS"],
];

export const PIECE_ART: Record<PieceType, PieceArt> = {
  municipal: { code: "CITY", sym: "⌁", color: "#6bb8dc", spec: [[0.9, 26, 0], [0.4, 16, 26, 0, 0, "#cfe9f5"]] },
  river: { code: "RIVER", sym: "≈", color: "#4fa8c9", spec: [[0.95, 12, 0], [0.35, 28, 12, -20, 6, "#4f8aa8"]] },
  well: { code: "WELL", sym: "◉", color: "#7a9fb5", spec: [[0.5, 22, 0], [0.25, 16, 22, 0, 0, "#7a7a7a"]] },
  rain: { code: "RAIN", sym: "∴", color: "#9fd3ea", spec: [[0.8, 22, 0], [0.55, 10, 22, 0, 0, "#bfe6f4"]] },
  seawater: { code: "SEA", sym: "≋", color: "#3f7fae", spec: [[0.9, 14, 0], [0.4, 22, 14, -16, 6, "#2f6a95"]] },
  desal: { code: "DESAL", sym: "◒", color: "#3d95c9", spec: [[1, 36, 0], [0.5, 30, 36, -14, 0], [0.22, 12, 0, 44, 22, "#9a7a58"]] },
  // Harmony: same plant silhouette as desal, in a green accent so it reads as the better option.
  harmony: { code: "HARMONY", sym: "◑", color: "#3fb58a", spec: [[1, 32, 0], [0.5, 26, 32, -14, 0, "#bff0dc"], [0.22, 12, 0, 44, 22, "#9a7a58"]] },
  nearby: { code: "SHARE", sym: "↻", color: "#7fb8d8", spec: [[0.9, 30, 0], [0.4, 22, 30, -18, 0], [0.3, 12, 30, 20, 8]] },

  filter: { code: "FILTER", sym: "▤", color: "#8fd4c6", spec: [[0.85, 26, 0], [0.5, 8, 26, 0, 0, "#e9f6f2"]] },
  softener: { code: "SOFT", sym: "⬡", color: "#5fc9b6", spec: [[0.45, 30, 0, -14, -6], [0.45, 30, 0, 14, 8]] },
  ro: { code: "RO", sym: "⧉", color: "#4cb5c9", spec: [[0.85, 28, 0], [0.25, 10, 28, -14, 0, "#dff3f7"], [0.25, 10, 28, 14, 0, "#dff3f7"]] },
  wwt: { code: "WWT", sym: "⟲", color: "#3fae9c", spec: [[1, 16, 0], [0.55, 12, 16, 0, 0, "#2c8f80"]] },
  recycle: { code: "RECYCLE", sym: "◈", color: "#2fb3a0", spec: [[0.9, 20, 0], [0.5, 20, 20, 0, 0], [0.25, 10, 40, 0, 0, "#7fe0d0"]] },
  polish: { code: "EDI+UV", sym: "✦", color: "#27a090", spec: [[0.7, 34, 0], [0.3, 10, 34, 0, 0, "#ffe27a"]] },
  brine: { code: "BRINE", sym: "▾", color: "#b59a7c", spec: [[0.9, 10, 0], [0.55, 6, 10, 0, 0, "#8a6a4a"]] },

  fab: { code: "FAB", sym: "▦", color: "#d9b48a", spec: [[1, 50, 0], [0.45, 26, 50, 0, 0, "#c9b39a"]] },
  clean: { code: "CLEAN", sym: "❖", color: "#ecd3b0", spec: [[1, 22, 0], [0.7, 10, 22, 0, 0, "#f4e6d0"]] },
  wet: { code: "WET", sym: "◌", color: "#c9a27a", spec: [[0.9, 26, 0], [0.3, 18, 26, -14, -4, "#9a7a58"]] },
  cmp: { code: "CMP", sym: "◎", color: "#b88d68", spec: [[0.9, 22, 0], [0.45, 10, 22, 0, 0, "#7a6a5a"]] },
  upw: { code: "UPW", sym: "✧", color: "#e3c08f", spec: [[0.9, 32, 0], [0.35, 26, 32, -18, 0, "#e8d3a8"], [0.35, 26, 32, 18, 0, "#e8d3a8"]] },
  chem: { code: "CHEM", sym: "▲", color: "#c7a79a", spec: [[0.4, 24, 0, -16, -6, "#c47a6a"], [0.4, 24, 0, 16, 6, "#c47a6a"]] },

  server: { code: "SERVER", sym: "▤", color: "#9bb0c4", spec: [[0.8, 40, 0]] },
  datacenter: { code: "DC", sym: "▥", color: "#8fa6bf", spec: [[1, 48, 0], [0.55, 8, 48, 0, 0, "#cfe0ee"]] },
  server2: { code: "SERVER+", sym: "▥", color: "#8aa0b8", spec: [[1, 56, 0]] },
  tower: { code: "COOLING", sym: "❋", color: "#8fb4cc", spec: [[0.85, 26, 0], [0.5, 24, 26, 0, 0, "#a9c8da"]] },
  chiller: { code: "CHILL", sym: "✱", color: "#a9c7d6", spec: [[0.9, 24, 0], [0.35, 14, 24, -18, 0, "#d9e8ef"], [0.35, 14, 24, 18, 0, "#d9e8ef"]] },
  evap: { code: "EVAP", sym: "∿", color: "#b9d3de", spec: [[0.9, 18, 0], [0.7, 10, 18, 0, 0, "#d6eef6"]] },
  closed: { code: "LIQUID", sym: "⟳", color: "#7fa8c0", spec: [[0.85, 26, 0], [0.3, 8, 26, -14, 0, "#4a7a98"], [0.3, 8, 26, 14, 0, "#4a7a98"]] },
  tank: { code: "TANK", sym: "◍", color: "#b7c9d6", spec: [[0.6, 34, 0], [0.35, 6, 34, 0, 0, "#e0ecf3"]] },
  gen: { code: "GEN", sym: "ϟ", color: "#b3a79a", spec: [[0.9, 16, 0], [0.35, 14, 16, -16, 0, "#d9a441"]] },
  ups: { code: "UPS", sym: "▭", color: "#a7b4a0", spec: [[0.85, 24, 0], [0.4, 6, 24, 0, 0, "#7fc08a"]] },
  sub: { code: "SUB", sym: "⌃", color: "#c4b27d", spec: [[0.8, 10, 0], [0.3, 26, 10, -14, -4, "#7a6a40"], [0.3, 26, 10, 14, 4, "#7a6a40"]] },
  net: { code: "NET", sym: "⌬", color: "#9aa6c4", spec: [[0.6, 28, 0], [0.12, 24, 28, 0, 0, "#555555"]] },
  fire: { code: "FIRE", sym: "✹", color: "#d6a29a", spec: [[0.6, 28, 0], [0.6, 6, 28, 0, 0, "#e07a5f"]] },
  gate: { code: "GATE", sym: "⌂", color: "#c9c0b0", spec: [[0.7, 18, 0], [0.8, 5, 18, 0, 0, "#8a8a80"]] },
  office: { code: "OPS", sym: "▣", color: "#d3d0c8", spec: [[0.8, 34, 0], [0.5, 10, 34, 0, 0, "#b8b4a8"]] },

  leak: { code: "LEAK", sym: "◇", color: "#a9d8cf", spec: [[0.35, 10, 0], [0.15, 16, 10, 0, 0, "#2e9e5b"]] },
  meter: { code: "METER", sym: "◔", color: "#b5dcc0", spec: [[0.4, 14, 0], [0.3, 4, 14, 0, 0, "#f0f0f0"]] },
  opt: { code: "OPT", sym: "✺", color: "#c9e3b5", spec: [[0.5, 12, 0], [0.3, 18, 12, 0, 0, "#7fb06a"]] },

  valve: { code: "VALVE", sym: "⋈", color: "#cfc7ba", spec: [[0.3, 12, 0], [0.5, 5, 12, 0, 0, "#e0a030"]] },
  pump: { code: "PUMP", sym: "⊚", color: "#bcb4a6", spec: [[0.6, 14, 0], [0.35, 10, 14, 0, 0, "#e0a030"]] },
  discharge: { code: "OUTFALL", sym: "↧", color: "#a39a8c", spec: [[0.6, 8, 0], [0.3, 10, 8, 0, 0, "#6d6457"]] },

  // Manufacturing plant: long sawtooth-roof hall with a stack.
  factory: { code: "MFG", sym: "⚙", color: "#c9a98a", spec: [[1, 26, 0], [0.45, 10, 26, -14, 0, "#b39478"], [0.45, 10, 26, 14, 0, "#b39478"], [0.15, 34, 0, 34, -16, "#8a7a6a"]] },
  // Concrete & aggregate plant: twin hoppers on legs beside a gravel stockpile.
  concrete: { code: "CONCRETE", sym: "▲", color: "#b9b4aa", spec: [[0.55, 10, 0, -18, 8, "#a39d92"], [0.3, 30, 10, 12, -8, "#cfcac0"], [0.3, 30, 10, 26, 2, "#cfcac0"], [0.4, 8, 0, -30, -10, "#9a8f7c"]] },
  neighbor_fab: { code: "NBR FAB", sym: "▦", color: "#cfa77c", spec: [[1, 44, 0], [0.4, 22, 44, 0, 0, "#b89a7a"]] },
  neighbor_dc: { code: "NBR DC", sym: "▥", color: "#90a7bd", spec: [[0.9, 44, 0]] },
};

/** Colors used by the board chrome (pipes, ghosts, warnings). */
export const BOARD_COLORS = {
  ink: "#22323f",
  slabTop: "#f3ecdf",
  slabLeft: "#c9b99f",
  slabRight: "#b8a78c",
  grid: "#ddd0ba",
  ghost: "#ffb866",
  ghostStroke: "#d9700c",
  ghostTile: "#fff0dc",
  orange: "#f08a24",
  red: "#d6453d",
  redTint: "#ffe9e7",
  redPiece: "#ee7a70",
  green: "#2e9e5b",
  select: "#3b8fc4",
  cooling: "#bfe3f2",
  brine: "#a58562",
  /** Used (untreated) water piped to a reuse destination: greyish brown. */
  wastewater: "#9a8466",
  efficiency: "#a9d8cf",
} as const;
