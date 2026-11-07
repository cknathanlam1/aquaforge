"use client";
import type { Metric } from "@/lib/contract";
import { useNature } from "@/lib/store";
import { useFmt } from "../hooks";
import { Corners } from "../ui/Icon";
import { InfoButton } from "../ui/InfoButton";
import { SubMetric, useHighlight } from "./MetricCard";

const ARC_LEN = 188.5;
const LOW = 35;
const HIGH = 65;

export function riskBand(v: number): { label: string; color: string } {
  if (v < LOW) return { label: "Low", color: "var(--green)" };
  if (v < HIGH) return { label: "Moderate", color: "#d49a00" };
  return { label: "High", color: "var(--red)" };
}

export function RiskGauge({ risk, disruption }: { risk: Metric; disruption: Metric }) {
  const fmt = useFmt();
  const openDetail = useNature((s) => s.openDetail);
  const [hl, ref] = useHighlight("supplyRisk");
  const v = Math.max(0, Math.min(100, risk.value ?? 0));
  const band = riskBand(v);
  return (
    <div ref={ref} className={`blueprint bp-card is-hit ${hl ? "is-highlight" : ""}`}>
      <Corners />
      <button type="button" className="card-hit" aria-label={`Supply risk ${fmt.headline(risk)} of 100, ${band.label}. Open details`} onClick={() => openDetail("supplyRisk")} />
      <div className="above flex items-center gap-3">
        <div className="relative h-[80px] w-[136px] flex-none">
          <div className="heading absolute right-0 bottom-1 left-0 text-center text-[32px] leading-none">{Math.round(v)}</div>
          <svg width="136" height="80" viewBox="0 0 150 88" aria-hidden="true">
            <path d="M 15 78 A 60 60 0 0 1 135 78" fill="none" stroke="#e3e8ec" strokeWidth={16} strokeLinecap="round" />
            <path d="M 15 78 A 60 60 0 0 1 135 78" fill="none" stroke={band.color} strokeWidth={16} strokeLinecap="round" strokeDasharray={`${(v / 100) * ARC_LEN} ${ARC_LEN}`} style={{ transition: "stroke-dasharray .6s, stroke .6s" }} />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-[12px] text-[var(--muted)]">Supply risk (0–100) <InfoButton metrics={[risk]} /></div>
          <div className="heading text-[22px]" style={{ color: band.color }}>{band.label}</div>
          <div className="text-[12px] leading-[1.3]"><SubMetric metric={disruption} prefix="Expected disruption: " /></div>
        </div>
      </div>
    </div>
  );
}
