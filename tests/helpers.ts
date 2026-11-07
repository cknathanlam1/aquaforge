import type { Board, BoardEdge, BoardNode, PieceType, ScenarioSettings } from "../lib/contract";
import { DEFAULT_SETTINGS } from "../lib/contract";

/** Build a board from [id, type] nodes and [from, to] pipes. */
export function makeBoard(nodes: Array<[string, PieceType]>, pipes: Array<[string, string]>, existing = true): Board {
  const ns: BoardNode[] = nodes.map(([id, type], i) => ({ id, type, x: i, y: 0, existing }));
  const es: BoardEdge[] = pipes.map(([from, to], i) => ({ id: `e${i + 1}`, from, to }));
  return { nodes: ns, edges: es };
}

export function settings(overrides: Partial<ScenarioSettings> = {}): ScenarioSettings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}
