"use client";
import type { Comparison, Metric } from "@/lib/contract";
import { useNature } from "@/lib/store";
import { useCatalog, useComparison, useFmt } from "../hooks";
import { InfoButton } from "../ui/InfoButton";
import { brineMetric, dischargeMetric, offlineMetric, reusedMetric } from "./offline";

interface Row { label: string; before: string; after: string; better: boolean | null; metrics: Metric[] }

/**
 * Demo steps 3-4: an orange callout under the hero comparing the previous step with now.
 * Every value is an engine number (Comparison metrics or NodeResult.lostPerHour).
 */
export function ImpactCallout() {
  const show = useNature((s) => s.impactCallout && s.guided);
  const before = useNature((s) => s.calloutBefore);
  const board = useNature((s) => s.board);
  const after = useComparison();
  const catalog = useCatalog();
  const fmt = useFmt();
  if (!show || !before) return null;

  const offB = offlineMetric(before, board, catalog);
  const offA = offlineMetric(after, board, catalog);
  const m = (c: Comparison) => c.metrics;
  const v = (x: Metric) => fmt.value(x.value, x.unit);
  const cmp = (a: number | null, b: number | null, higherIsBetter: boolean) => (a === null || b === null || a === b ? null : higherIsBetter ? b > a : b < a);
  // Water and operations rows only appear when they changed, keeping the callout compact.
  const opt = (label: string, b: Metric, a: Metric, higherIsBetter: boolean): Row[] =>
    v(b) === v(a) ? [] : [{ label, before: v(b), after: v(a), better: cmp(b.value, a.value, higherIsBetter), metrics: [a] }];
  const rows: Row[] = [
    ...((offB.value ?? 0) > 0 || (offA.value ?? 0) > 0 ? [{
      label: "Production",
      before: (offB.value ?? 0) > 0 ? `offline, ${fmt.money(offB.value ?? 0)}/hour lost` : "online",
      after: (offA.value ?? 0) > 0 ? `offline, ${fmt.money(offA.value ?? 0)}/hour lost` : (offB.value ?? 0) > 0 ? "back online" : "online",
      better: cmp(offB.value, offA.value, false),
      metrics: [offB, offA],
    }] : []),
    { label: "Net annual savings", before: v(m(before).netAnnualSavings), after: v(m(after).netAnnualSavings), better: cmp(m(before).netAnnualSavings.value, m(after).netAnnualSavings.value, true), metrics: [m(after).netAnnualSavings] },
    { label: "Risk-adjusted savings", before: v(m(before).riskAdjustedSavings), after: v(m(after).riskAdjustedSavings), better: cmp(m(before).riskAdjustedSavings.value, m(after).riskAdjustedSavings.value, true), metrics: [m(after).riskAdjustedSavings] },
    { label: "Capex", before: v(m(before).capex), after: v(m(after).capex), better: null, metrics: [m(after).capex] },
    { label: "Payback", before: v(m(before).payback), after: v(m(after).payback), better: null, metrics: [m(after).payback] },
    { label: "NPV", before: v(m(before).npv), after: v(m(after).npv), better: cmp(m(before).npv.value, m(after).npv.value, true), metrics: [m(after).npv] },
    ...opt("Water withdrawn", m(before).waterWithdrawn, m(after).waterWithdrawn, false),
    ...opt("Reused water", reusedMetric(before), reusedMetric(after), true),
    ...opt("Discharge", dischargeMetric(before), dischargeMetric(after), false),
    ...opt("Treatment energy", m(before).treatmentEnergy, m(after).treatmentEnergy, false),
    ...opt("Brine", brineMetric(before), brineMetric(after), false),
    ...opt("Tankers per drought day", m(before).tankersPerDay, m(after).tankersPerDay, false),
  ];

  return (
    <section aria-label="What just changed" className="anim-pop relative border-[2.5px] border-[var(--orange)] bg-[var(--orange-tint)] px-3 py-2.5 shadow-[0_4px_0_#22323f33]">
      <span aria-hidden="true" className="absolute -top-[11px] left-8 h-0 w-0 border-x-[10px] border-b-[10px] border-x-transparent border-b-[var(--orange)]" />
      <div className="kicker mb-1" style={{ color: "var(--orange-deep)" }}>What just changed</div>
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="text-left text-[10.5px] tracking-[0.08em] text-[var(--orange-text)] uppercase">
            <th className="pb-0.5 font-semibold" />
            <th className="pb-0.5 font-semibold">Before</th>
            <th className="pb-0.5 font-semibold">Now</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-dashed border-[var(--orange-line)] align-top">
              <td className="py-1 pr-1.5 font-semibold">{r.label}</td>
              <td className="py-1 pr-1.5 text-[var(--color-neutral-700)]">{r.before}</td>
              <td className="py-1 font-bold" style={{ color: r.better === null ? undefined : r.better ? "var(--green-deep)" : "var(--red-deep)" }}>{r.after}</td>
              <td className="py-0.5 pl-1"><InfoButton metrics={r.metrics} title={r.label} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
