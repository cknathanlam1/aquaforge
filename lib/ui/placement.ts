/** Board placement helpers: free-cell search, id generation, auto-plumbing. UI-side, engine-agnostic. */
import type { Board, BoardEdge, BoardNode, PieceType, RuleResult } from "@/lib/contract";

export const MIN_BOARD_SIZE = 8;
export const MAX_BOARD_SIZE = 16;

type Cell = readonly [number, number];

const SEARCH_ORDER: readonly Cell[] = [
  [3, 3], [2, 3], [4, 3], [3, 5], [4, 5], [2, 6], [5, 5], [4, 4], [3, 6], [1, 6], [5, 0], [6, 0], [0, 2], [0, 4],
  [7, 3], [7, 5], [2, 0], [4, 0], [0, 0], [7, 7], [2, 2], [4, 6], [5, 6], [6, 6], [6, 1], [7, 1], [0, 6], [1, 2],
  [5, 4], [3, 4], [2, 5],
];

export const PREFERRED_CELL: Partial<Record<PieceType, Cell>> = {
  desal: [2, 3],
  brine: [3, 3],
  polish: [2, 5],
  recycle: [4, 3],
  closed: [5, 5],
  nearby: [6, 0],
  leak: [4, 0],
  meter: [5, 0],
  opt: [6, 6],
  tank: [4, 5],
  seawater: [0, 2],
  neighbor_fab: [1, 6],
  neighbor_dc: [6, 2],
};

export function boardSizeFor(board: Board, min = MIN_BOARD_SIZE): number {
  const maxCoord = board.nodes.reduce((m, n) => Math.max(m, n.x, n.y), 0);
  return Math.min(MAX_BOARD_SIZE, Math.max(min, maxCoord + 1));
}

export function findFreeCell(board: Board, n: number, pref?: Cell): Cell {
  const taken = (c: Cell) => board.nodes.some((p) => p.x === c[0] && p.y === c[1]);
  const ok = (c: Cell) => c[0] >= 0 && c[1] >= 0 && c[0] < n && c[1] < n && !taken(c);
  const candidates = pref ? [pref, ...SEARCH_ORDER] : SEARCH_ORDER;
  const hit = candidates.find(ok);
  if (hit) return hit;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (ok([i, j])) return [i, j];
  return [0, 0];
}

function nextId(ids: string[], prefix: string): string {
  const re = new RegExp(`^${prefix}(\\d+)$`);
  const max = ids.reduce((m, id) => {
    const hit = re.exec(id);
    return hit ? Math.max(m, Number(hit[1])) : m;
  }, 100);
  return `${prefix}${max + 1}`;
}

export const nextNodeId = (board: Board) => nextId(board.nodes.map((n) => n.id), "n");
export const nextEdgeId = (board: Board) => nextId(board.edges.map((e) => e.id), "e");

/** Nearest free cell to (x, y), searching outward ring by ring. */
export function findFreeCellNear(board: Board, n: number, x: number, y: number): Cell {
  const free = (c: Cell) => c[0] >= 0 && c[1] >= 0 && c[0] < n && c[1] < n && !board.nodes.some((p) => p.x === c[0] && p.y === c[1]);
  for (let r = 1; r < n; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const c: Cell = [x + dx, y + dy];
        if (free(c)) return c;
      }
    }
  }
  return findFreeCell(board, n);
}

export function addNode(board: Board, type: PieceType, n: number, cell?: Cell, opts?: Partial<BoardNode>): { board: Board; id: string } {
  const id = nextNodeId(board);
  const [x, y] = cell && !board.nodes.some((p) => p.x === cell[0] && p.y === cell[1]) ? cell : findFreeCell(board, n, PREFERRED_CELL[type]);
  const node: BoardNode = { id, type, x, y, existing: false, ...opts };
  return { board: { ...board, nodes: [...board.nodes, node] }, id };
}

export function addEdge(board: Board, from: string, to: string): { board: Board; id: string } {
  const id = nextEdgeId(board);
  const edge: BoardEdge = { id, from, to };
  return { board: { ...board, edges: [...board.edges, edge] }, id };
}

export function hasEdge(board: Board, from: string, to: string): boolean {
  return board.edges.some((e) => e.from === from && e.to === to);
}

/** Pipes the demo and "add recommended" flows try to lay automatically (from → to by piece type). */
const AUTO_PAIRS: ReadonlyArray<readonly [PieceType, PieceType]> = [
  ["seawater", "desal"],
  ["municipal", "desal"],
  ["desal", "brine"],
  ["ro", "brine"],
  ["desal", "tank"],
  ["tank", "polish"],
  ["desal", "polish"],
  ["upw", "fab"],
  ["polish", "fab"],
  ["polish", "neighbor_fab"],
  ["fab", "recycle"],
  ["neighbor_fab", "recycle"],
  ["recycle", "tower"],
  ["recycle", "closed"],
  ["closed", "server"],
  ["nearby", "tower"],
  ["well", "filter"],
];

type CheckFn = (board: Board, from: string, to: string) => RuleResult;

/**
 * Lay the standard pipes that touch any of `touching` (usually just-added nodes), keeping only
 * connections the engine says are valid. Never removes the user's own pipes.
 */
export function autoPipe(board: Board, touching: ReadonlySet<string>, check: CheckFn): { board: Board; added: string[] } {
  let next = board;
  const added: string[] = [];
  const live = (t: PieceType) => next.nodes.find((p) => p.type === t && !p.ghost);
  for (const [ta, tb] of AUTO_PAIRS) {
    const a = live(ta);
    const b = live(tb);
    if (!a || !b || a.id === b.id) continue;
    if (!touching.has(a.id) && !touching.has(b.id)) continue;
    if (hasEdge(next, a.id, b.id)) continue;
    if (ta === "municipal" && live("seawater")) continue;
    if (ta === "desal" && tb === "polish" && live("tank")) continue;
    if (!check(next, a.id, b.id).valid) continue;
    const res = addEdge(next, a.id, b.id);
    next = res.board;
    added.push(res.id);
  }
  return { board: next, added };
}

/** Add pieces by type (skipping types already on the board) and plumb them. */
export function addPieces(board: Board, types: PieceType[], check: CheckFn, n = boardSizeFor(board)): { board: Board; nodeIds: string[]; edgeIds: string[] } {
  let next = board;
  const nodeIds: string[] = [];
  for (const t of types) {
    if (next.nodes.some((p) => p.type === t && !p.ghost)) continue;
    const res = addNode(next, t, n);
    next = res.board;
    nodeIds.push(res.id);
  }
  const piped = autoPipe(next, new Set(nodeIds), check);
  return { board: piped.board, nodeIds, edgeIds: piped.added };
}

/** Merge pieces/pipes from `source` that aren't on `target` (by type), re-placing on cell collisions. */
export function mergeNewPieces(target: Board, source: Board, check: CheckFn): { board: Board; nodeIds: string[]; edgeIds: string[] } {
  const known = new Set(target.nodes.map((n) => n.id));
  // Every node the card added (ids absent from the live board). A card may legitimately add a
  // second piece of a type already on the board, so don't dedupe by type.
  const fresh = source.nodes.filter((n) => !known.has(n.id) && !n.ghost);
  let next = target;
  const n = boardSizeFor(target);
  const idMap = new Map<string, string>();
  for (const node of fresh) {
    const res = addNode(next, node.type, n, [node.x, node.y], { existing: false });
    next = res.board;
    idMap.set(node.id, res.id);
  }
  const resolve = (id: string) => idMap.get(id) ?? (known.has(id) ? id : null);
  for (const e of source.edges) {
    const from = resolve(e.from);
    const to = resolve(e.to);
    if (!from || !to || hasEdge(next, from, to)) continue;
    if (!idMap.has(e.from) && !idMap.has(e.to)) continue;
    if (!check(next, from, to).valid) continue;
    next = addEdge(next, from, to).board;
  }
  const nodeIds = [...idMap.values()];
  const piped = autoPipe(next, new Set(nodeIds), check);
  return { board: piped.board, nodeIds, edgeIds: piped.added };
}
