/** Preloaded demo scenarios. Preset pieces are existing facilities (no capex). */

import type { Board, BoardEdge, BoardNode, PieceType, ScenarioFile } from "./contract";
import { DEFAULT_SETTINGS } from "./contract";

type NodeSpec = [id: string, type: PieceType, x: number, y: number];

function board(nodes: NodeSpec[], pipes: Array<[string, string]>): Board {
  const ns: BoardNode[] = nodes.map(([id, type, x, y]) => ({ id, type, x, y, existing: true }));
  const es: BoardEdge[] = pipes.map(([from, to], i) => ({ id: `e${i + 1}`, from, to }));
  return { nodes: ns, edges: es };
}

function file(name: string, b: Board): ScenarioFile {
  return { version: 1, name, board: b, settings: { ...DEFAULT_SETTINGS }, assumptionOverrides: {} };
}

/** Taiwan Science Park: one fab on reservoir (municipal) water, conventional UPW train. */
export const TAIWAN_SCIENCE_PARK: Board = board(
  [
    ["n1", "municipal", 1, 1],
    ["n2", "ro", 3, 1],
    ["n3", "upw", 5, 1],
    ["n4", "fab", 5, 4],
    ["n5", "discharge", 2, 5],
  ],
  [
    ["n1", "n2"],
    ["n2", "n3"],
    ["n3", "n4"],
    ["n4", "n5"],
  ],
);

const SEMICONDUCTOR_FAB: Board = board(
  [
    ["n1", "municipal", 1, 1],
    ["n2", "ro", 3, 1],
    ["n3", "upw", 5, 1],
    ["n4", "fab", 5, 4],
    ["n5", "discharge", 2, 6],
    ["n6", "tower", 2, 3],
    ["n7", "office", 0, 4],
  ],
  [
    ["n1", "n2"],
    ["n2", "n3"],
    ["n3", "n4"],
    ["n4", "n5"],
    ["n1", "n6"],
    ["n1", "n7"],
    ["n6", "n5"],
  ],
);

const DATA_CENTER_CAMPUS: Board = board(
  [
    ["n1", "municipal", 1, 1],
    ["n2", "tower", 3, 2],
    ["n3", "server", 5, 3],
    ["n4", "ro", 1, 4],
    ["n5", "closed", 3, 5],
    ["n6", "server2", 5, 6],
    ["n7", "office", 0, 6],
    ["n8", "discharge", 6, 0],
  ],
  [
    ["n1", "n2"],
    ["n2", "n3"],
    ["n1", "n4"],
    ["n4", "n5"],
    ["n5", "n6"],
    ["n1", "n7"],
    ["n2", "n8"],
  ],
);

const FAB_PLUS_DC: Board = board(
  [
    ["n1", "municipal", 1, 1],
    ["n2", "ro", 3, 1],
    ["n3", "upw", 5, 1],
    ["n4", "fab", 6, 3],
    ["n5", "tower", 1, 4],
    ["n6", "server", 3, 5],
    ["n7", "discharge", 6, 6],
    ["n8", "office", 0, 6],
  ],
  [
    ["n1", "n2"],
    ["n2", "n3"],
    ["n3", "n4"],
    ["n1", "n5"],
    ["n5", "n6"],
    ["n4", "n7"],
    ["n5", "n7"],
    ["n1", "n8"],
  ],
);

export const PRESETS: Array<{ id: string; name: string; file: ScenarioFile }> = [
  { id: "taiwan", name: "Taiwan Science Park", file: file("Taiwan Science Park", TAIWAN_SCIENCE_PARK) },
  { id: "fab", name: "Semiconductor fab", file: file("Semiconductor fab", SEMICONDUCTOR_FAB) },
  { id: "datacenter", name: "Data center campus", file: file("Data center campus", DATA_CENTER_CAMPUS) },
  { id: "fab-dc", name: "Fab + data center", file: file("Fab + data center", FAB_PLUS_DC) },
];

export const DEFAULT_PRESET_ID = "taiwan";
