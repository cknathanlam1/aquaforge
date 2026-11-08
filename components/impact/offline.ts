import type { Board, Comparison, Metric, PieceInfo, PieceType } from "@/lib/contract";

/** Brine produced on a normal day, straight from the engine's simulation totals. */
export function brineMetric(c: Comparison): Metric {
  const t = c.design.normalDay.totals;
  return {
    key: "brine",
    label: "Brine to dispose",
    value: t.brine,
    unit: "m3/day",
    formula: "Brine = Σ (desalination feed × that plant's brine fraction), normal day",
    inputs: [
      { symbol: "B", label: "Brine (your design)", value: t.brine, unit: "m3/day", assumptionKey: "desal.brineFraction" },
      { symbol: "B_base", label: "Brine (do nothing)", value: c.baseline.normalDay.totals.brine, unit: "m3/day" },
    ],
  };
}

/**
 * Lost production while buildings are offline, as a Metric so the info icon can show its work.
 * Built only from engine numbers: the sum of NodeResult.lostPerHour on the design's normal day.
 */
export function offlineMetric(c: Comparison, board: Board, catalog: Record<PieceType, PieceInfo>): Metric {
  const byId = new Map(board.nodes.map((n) => [n.id, n]));
  const parts = Object.values(c.design.normalDay.nodes)
    .filter((r) => (r.lostPerHour ?? 0) > 0)
    .map((r) => {
      const node = byId.get(r.id);
      const name = node ? catalog[node.type]?.name ?? node.type : r.id;
      return { symbol: "L", label: `${name} (${r.status}), lost per hour`, value: r.lostPerHour ?? 0, unit: "usd" };
    });
  return {
    key: "productionOffline",
    label: "Production offline",
    value: parts.reduce((sum, p) => sum + p.value, 0),
    unit: "usd",
    formula: "Lost production per hour = Σ lost $/hour of every building that is offline or short of water",
    inputs: parts,
    note: "Per hour, not per year. Each building's rate comes from its downtime assumption, scaled by the share of demand not delivered.",
  };
}
