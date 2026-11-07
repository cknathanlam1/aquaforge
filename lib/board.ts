/** Immutable board operations. Every function returns a new Board. */

import type { Board, BoardEdge, BoardNode, PieceType } from "./contract";

const MAX_GRID = 16;

function nextId(ids: string[], prefix: string): string {
  let max = 0;
  for (const id of ids) {
    if (!id.startsWith(prefix)) continue;
    const n = Number(id.slice(prefix.length));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return `${prefix}${max + 1}`;
}

export function activeNodes(board: Board): BoardNode[] {
  return board.nodes.filter((n) => !n.ghost);
}

/** The board the engine sees: ghosts and their pipes removed. */
export function activeBoard(board: Board): Board {
  const nodes = activeNodes(board);
  const ids = new Set(nodes.map((n) => n.id));
  return { nodes, edges: board.edges.filter((e) => ids.has(e.from) && ids.has(e.to)) };
}

export function isCellFree(board: Board, x: number, y: number): boolean {
  return !board.nodes.some((n) => n.x === x && n.y === y);
}

/** Nearest free cell to (x, y), searching rings outward inside the grid. */
export function freeCellNear(board: Board, x: number, y: number): { x: number; y: number } {
  const cx = Math.max(0, Math.min(MAX_GRID - 1, Math.round(x)));
  const cy = Math.max(0, Math.min(MAX_GRID - 1, Math.round(y)));
  for (let r = 0; r < MAX_GRID; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= MAX_GRID || ny >= MAX_GRID) continue;
        if (isCellFree(board, nx, ny)) return { x: nx, y: ny };
      }
    }
  }
  return { x: cx, y: cy };
}

export interface AddNodeOptions {
  existing?: boolean;
  ghost?: boolean;
}

export function addNode(
  board: Board,
  type: PieceType,
  at: { x: number; y: number },
  opts: AddNodeOptions = {},
): { board: Board; id: string } {
  const id = nextId(board.nodes.map((n) => n.id), "n");
  const cell = isCellFree(board, at.x, at.y) ? at : freeCellNear(board, at.x, at.y);
  const node: BoardNode = { id, type, x: cell.x, y: cell.y, existing: opts.existing ?? false };
  if (opts.ghost) node.ghost = true;
  return { board: { ...board, nodes: [...board.nodes, node] }, id };
}

export function removeNode(board: Board, id: string): Board {
  return {
    nodes: board.nodes.filter((n) => n.id !== id),
    edges: board.edges.filter((e) => e.from !== id && e.to !== id),
  };
}

export function hasEdge(board: Board, from: string, to: string): boolean {
  return board.edges.some((e) => e.from === from && e.to === to);
}

export function addEdge(board: Board, from: string, to: string): { board: Board; id: string } {
  const existing = board.edges.find((e) => e.from === from && e.to === to);
  if (existing) return { board, id: existing.id };
  const id = nextId(board.edges.map((e) => e.id), "e");
  const edge: BoardEdge = { id, from, to };
  return { board: { ...board, edges: [...board.edges, edge] }, id };
}

export function removeEdge(board: Board, id: string): Board {
  return { ...board, edges: board.edges.filter((e) => e.id !== id) };
}

export function nodeById(board: Board, id: string): BoardNode | undefined {
  return board.nodes.find((n) => n.id === id);
}

export function moveNode(board: Board, id: string, x: number, y: number): Board {
  if (!isCellFree(board, x, y)) return board;
  return { ...board, nodes: board.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)) };
}

/** Accept ghost nodes (AI suggestions) so the engine counts them. */
export function acceptGhosts(board: Board, ids?: string[]): Board {
  const pick = ids ? new Set(ids) : null;
  return {
    ...board,
    nodes: board.nodes.map((n) => (n.ghost && (!pick || pick.has(n.id)) ? { ...n, ghost: false } : n)),
  };
}
