"use client";
import { useState } from "react";
import { DEFAULT_ASSUMPTIONS, type AssumptionKey } from "@/lib/assumptions";
import { useNature } from "@/lib/store";
import { StatusBadge } from "./ShowWork";

/** Regular desal and Harmony inputs side by side (the keys live in different drawer groups). */
const PAIRS: ReadonlyArray<readonly [string, AssumptionKey, AssumptionKey]> = [
  ["Energy", "energy.desal", "harmony.energy"],
  ["Brine fraction", "desal.brineFraction", "harmony.brineFraction"],
  ["Non-energy opex", "varcost.desal", "varcost.harmony"],
  ["Capacity", "cap.desal", "cap.harmony"],
  ["Capex", "capex.desal", "capex.harmony"],
  ["Fixed O&M", "om.desal", "om.harmony"],
];

function Cell({ k }: { k: AssumptionKey }) {
  const a = DEFAULT_ASSUMPTIONS[k];
  const override = useNature((s) => s.overrides[k]);
  const setOverride = useNature((s) => s.setOverride);
  const current = override ?? a.value;
  const [draft, setDraft] = useState(String(current));
  const [prev, setPrev] = useState(current);
  if (prev !== current) { setPrev(current); setDraft(String(current)); }
  const changed = override !== undefined && override !== a.value;
  return (
    <td className="px-1 py-1 align-top">
      <input
        type="number"
        step="any"
        aria-label={a.label}
        title={`${a.label} (${k})`}
        className="ninput w-full text-right font-semibold"
        style={changed ? { background: "var(--orange-tint)" } : undefined}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          const v = Number(e.target.value);
          if (e.target.value.trim() !== "" && Number.isFinite(v)) setOverride(k, v === a.value ? null : v);
        }}
      />
      <div className="mt-0.5 origin-left scale-90"><StatusBadge status={a.status} /></div>
    </td>
  );
}

export function DesalCompare() {
  return (
    <section className="py-3">
      <div className="kicker mb-1.5">Desalination: regular vs Harmony</div>
      <table className="w-full table-fixed border-collapse text-[12.5px]">
        <thead>
          <tr className="text-left text-[10.5px] tracking-[0.08em] text-[var(--color-neutral-600)] uppercase">
            <th className="w-[30%] pb-1 font-semibold" />
            <th className="px-1 pb-1 font-semibold">Regular desal</th>
            <th className="px-1 pb-1 font-semibold" style={{ color: "#17805f" }}>Harmony</th>
          </tr>
        </thead>
        <tbody>
          {PAIRS.map(([label, reg, har]) => (
            <tr key={label} className="border-t border-dashed border-[#cfd5da]">
              <td className="py-1.5 pr-1 align-top">
                <b className="font-semibold">{label}</b>
                <span className="block text-[11px] text-[var(--color-neutral-600)]">{DEFAULT_ASSUMPTIONS[reg].unit}</span>
              </td>
              <Cell k={reg} />
              <Cell k={har} />
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
