/**
 * The "do nothing" baseline is derived from the design, not stored: the same consumers,
 * each supplied the conventional way from municipal water, with existing (sunk) treatment
 * sized to demand. That keeps savings comparable when the user adds buildings or neighbors.
 *
 *   Tier ≤ 2 consumers: municipal → consumer
 *   Tier 3 consumers:   municipal → RO → consumer
 *   Tier 5 consumers:   municipal → RO → UPW plant → consumer
 * Cooling links to server halls are copied from the design. Efficiency pieces are not.
 */

import type { AssumptionValues } from "./assumptions";
import { activeBoard } from "./board";
import type { Board, BoardEdge, BoardNode, PieceType } from "./contract";
import { PIECES } from "./pieces";
import { analyzeBoard, requiredTier } from "./rules";
import { consumerDemand } from "./simulation";

function recovery(type: PieceType, v: AssumptionValues): number {
  const key = PIECES[type].treatment?.recoveryKey;
  return key ? Math.max(1e-6, v[key]) : 1;
}

function capacity(type: PieceType, v: AssumptionValues): number {
  const key = PIECES[type].treatment?.capacityKey;
  return key ? Math.max(1, v[key]) : Infinity;
}

export function buildBaseline(input: Board, v: AssumptionValues): Board {
  const design = activeBoard(input);
  const analysis = analyzeBoard(design);
  const nodes: BoardNode[] = [];
  const edges: BoardEdge[] = [];
  let seq = 0;
  const node = (type: PieceType, existing: boolean): BoardNode => {
    const n: BoardNode = { id: `b${++seq}`, type, x: seq % 16, y: Math.floor(seq / 16), existing };
    nodes.push(n);
    return n;
  };
  const edge = (from: string, to: string) => edges.push({ id: `be${edges.length + 1}`, from, to });

  const consumers = design.nodes.filter((n) => PIECES[n.type].role === "consumer");
  const servers = design.nodes.filter((n) => PIECES[n.type].role === "server");
  if (consumers.length === 0 && servers.length === 0) return { nodes: [], edges: [] };

  const municipal = node("municipal", true);
  const idMap = new Map<string, string>();
  for (const c of [...consumers, ...servers]) idMap.set(c.id, node(c.type, c.existing).id);

  const demandOf = (list: BoardNode[]) => list.reduce((sum, c) => sum + consumerDemand(c, design, v), 0);

  // Conventional trains for existing consumers are sunk; a NEW consumer's train would be
  // built in the do-nothing world too, so it carries capex there (fair incremental capex).
  for (const existing of [true, false]) {
    const groups: Record<"t2" | "t3" | "t5", BoardNode[]> = { t2: [], t3: [], t5: [] };
    for (const c of consumers.filter((x) => x.existing === existing)) {
      const need = requiredTier(c.type) ?? 1;
      groups[need >= 4 ? "t5" : need === 3 ? "t3" : "t2"].push(c);
    }

    for (const c of groups.t2) edge(municipal.id, idMap.get(c.id) as string);

    if (groups.t3.length) {
      const roUnits = Math.max(1, Math.ceil(demandOf(groups.t3) / capacity("ro", v)));
      for (let i = 0; i < roUnits; i++) {
        const ro = node("ro", existing);
        edge(municipal.id, ro.id);
        for (const c of groups.t3) edge(ro.id, idMap.get(c.id) as string);
      }
    }

    if (groups.t5.length) {
      const upwOut = demandOf(groups.t5);
      const upwUnits = Math.max(1, Math.ceil(upwOut / capacity("upw", v)));
      const roUnits = Math.max(1, Math.ceil(upwOut / recovery("upw", v) / capacity("ro", v)));
      const ros = Array.from({ length: roUnits }, () => node("ro", existing));
      const upws = Array.from({ length: upwUnits }, () => node("upw", existing));
      for (const ro of ros) {
        edge(municipal.id, ro.id);
        for (const u of upws) edge(ro.id, u.id);
      }
      for (const u of upws) for (const c of groups.t5) edge(u.id, idMap.get(c.id) as string);
    }
  }

  // Copy cooling links (cooling piece → server hall).
  for (const e of design.edges) {
    if (analysis.edges[e.id]?.kind !== "cooling") continue;
    const from = idMap.get(e.from);
    const to = idMap.get(e.to);
    if (from && to) edge(from, to);
  }

  return { nodes, edges };
}
