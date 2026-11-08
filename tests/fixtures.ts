/**
 * Larger boards used across tests (formerly demo steps d and e):
 *  - resilienceBoard: Taiwan fab + seawater → filter → desal → polishing (with brine),
 *    a recycling loop back into RO, and a storage tank in front of the fab.
 *  - neighborBoard: the above plus an existing neighbor fab sharing the loop and a second recycler.
 */

import { addEdge, addNode, nodeById, removeEdge } from "../lib/board";
import type { Board } from "../lib/contract";
import { TAIWAN_CONVENTIONAL } from "../lib/presets";
import { applyRecommendation, checkConnection } from "../lib/rules";

function findType(board: Board, type: string): string {
  const id = board.nodes.find((n) => n.type === type)?.id;
  if (!id) throw new Error(`fixture: no ${type} on board`);
  return id;
}

function connect(board: Board, pairs: Array<[string, string]>): Board {
  return pairs.reduce((b, [from, to]) => addEdge(b, from, to).board, board);
}

export function resilienceBoard(): Board {
  const sea = addNode(TAIWAN_CONVENTIONAL, "seawater", { x: 0, y: 7 });
  const filter = addNode(sea.board, "filter", { x: 2, y: 7 });
  let board = addEdge(filter.board, sea.id, filter.id).board;
  board = applyRecommendation(board, checkConnection(board, filter.id, "n4"));

  const recycle = addNode(board, "recycle", { x: 3, y: 4 });
  board = connect(recycle.board, [["n4", recycle.id], [recycle.id, findType(board, "ro")]]);

  const upw = findType(board, "upw");
  const upwToFab = board.edges.find((e) => e.from === upw && e.to === "n4");
  if (upwToFab) {
    const fab = nodeById(board, "n4");
    const tank = addNode(removeEdge(board, upwToFab.id), "tank", { x: (fab?.x ?? 5) + 1, y: (fab?.y ?? 4) - 2 });
    board = connect(tank.board, [[upw, tank.id], [tank.id, "n4"]]);
  }
  return board;
}

export function neighborBoard(): Board {
  let board = resilienceBoard();
  const recycle = findType(board, "recycle");
  const nro = addNode(board, "ro", { x: 9, y: 1 }, { existing: true });
  const nupw = addNode(nro.board, "upw", { x: 11, y: 1 }, { existing: true });
  const nfab = addNode(nupw.board, "neighbor_fab", { x: 11, y: 4 }, { existing: true });
  const recycle2 = addNode(nfab.board, "recycle", { x: 9, y: 5 });
  board = connect(recycle2.board, [
    ["n1", nro.id],
    [nro.id, nupw.id],
    [nupw.id, nfab.id],
    [nfab.id, recycle],
    [nfab.id, recycle2.id],
    [recycle, nro.id],
    [recycle2.id, nro.id],
  ]);
  return board;
}
