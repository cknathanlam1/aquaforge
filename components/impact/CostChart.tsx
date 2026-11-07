"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Comparison, CostBreakdown } from "@/lib/contract";
import { useFmt } from "../hooks";
import { Corners } from "../ui/Icon";
import { InfoButton } from "../ui/InfoButton";

const PARTS: Array<[keyof Omit<CostBreakdown, "total">, string]> = [
  ["water", "Water"],
  ["surcharge", "Surcharge"],
  ["trucking", "Trucking"],
  ["discharge", "Discharge"],
  ["brine", "Brine"],
  ["energy", "Energy"],
  ["variableOM", "Var. O&M"],
  ["fixedOM", "Fixed O&M"],
  ["shortage", "Lost prod."],
];

const BASE_COLOR = "#b9c0c6";
const YOU_COLOR = "#3b8fc4";
const INK = "#22323f";

/** Before/after annual cost by component (Recharts), replacing the wireframe's hand-drawn bars. */
export function CostChart({ comparison }: { comparison: Comparison }) {
  const fmt = useFmt();
  const base = comparison.baseline.annual;
  const you = comparison.design.annual;
  const rows = PARTS.filter(([k]) => Math.abs(base[k]) > 0 || Math.abs(you[k]) > 0).map(([k, name]) => ({ name, base: base[k], you: you[k] }));
  const m = comparison.metrics;

  return (
    <div className="blueprint bp-card">
      <Corners />
      <div className="mb-1 flex items-center justify-between text-[12px]">
        <b>Annual cost: do nothing vs. your design</b>
        <InfoButton metrics={[m.annualCost, m.netAnnualSavings]} title="Annual cost breakdown" />
      </div>
      <div className="flex justify-between text-[12px]">
        <span>Do nothing <b>{fmt.money(base.total)}</b></span>
        <span>You <b>{fmt.money(you.total)}</b></span>
      </div>
      <div className="h-[200px]" role="img" aria-label={`Annual cost by component. Do nothing ${fmt.money(base.total)}, your design ${fmt.money(you.total)}.`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 6, right: 8, bottom: 0, left: 0 }} barGap={1}>
            <CartesianGrid horizontal={false} stroke="#e3e8ec" />
            <XAxis type="number" tickFormatter={(v: number) => fmt.money(v)} tick={{ fontSize: 10, fill: "#555" }} stroke={INK} />
            <YAxis type="category" dataKey="name" width={66} tick={{ fontSize: 11, fill: "#1d1f20" }} stroke={INK} />
            <Tooltip formatter={(v) => fmt.money(Number(v))} contentStyle={{ border: `1.5px solid ${INK}`, borderRadius: 0, fontSize: 12 }} />
            <Legend iconType="square" wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="base" name="Do nothing" fill={BASE_COLOR} stroke={INK} strokeWidth={1} isAnimationActive={false} />
            <Bar dataKey="you" name="Your design" fill={YOU_COLOR} stroke={INK} strokeWidth={1} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
