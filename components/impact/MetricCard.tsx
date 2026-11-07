"use client";
import { useEffect, useRef, type ReactNode } from "react";
import type { Metric } from "@/lib/contract";
import { useNature } from "@/lib/store";
import { DEMO_STEPS, type MetricKey } from "@/lib/ui/demo";
import { useFmt } from "../hooks";
import { Corners } from "../ui/Icon";
import { InfoButton } from "../ui/InfoButton";

/** True when the guided demo is highlighting this metric. Scrolls it into view once. */
export function useHighlight(key: MetricKey): [boolean, React.RefObject<HTMLDivElement | null>] {
  const step = useNature((s) => s.demoStep);
  const guided = useNature((s) => s.guided);
  const weakShown = useNature((s) => s.showWeakPoints);
  const on = guided && step !== null && DEMO_STEPS[step].highlight === key;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // The weak-points list sits at the top of the panel; don't scroll it away.
    if (on && !weakShown) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [on, weakShown]);
  return [on, ref];
}

interface CardProps {
  metricKey: MetricKey;
  metric: Metric;
  sub?: ReactNode;
  valueColor?: string;
  big?: boolean;
  className?: string;
  children?: ReactNode;
}

/** Blueprint card: the whole card opens the detail view; the info icon opens "show your work". */
export function MetricCard({ metricKey, metric, sub, valueColor, big, className, children }: CardProps) {
  const fmt = useFmt();
  const openDetail = useNature((s) => s.openDetail);
  const [hl, ref] = useHighlight(metricKey);
  return (
    <div ref={ref} className={`blueprint bp-card is-hit ${hl ? "is-highlight" : ""} ${className ?? ""}`}>
      <Corners />
      <button type="button" className="card-hit" aria-label={`${metric.label}: ${fmt.value(metric.value, metric.unit)}. Open details`} onClick={() => openDetail(metricKey)} />
      <div className="above">
        <div className="flex items-center justify-between gap-1 text-[12px] text-[var(--muted)]">
          <span>{metric.label}</span>
          <InfoButton metrics={[metric]} />
        </div>
        <div className={`heading leading-[1.05] ${big ? "text-[34px]" : "text-[26px]"}`} style={{ color: valueColor }}>{fmt.headline(metric)}</div>
        {sub && <div className="text-[12px] leading-[1.3]">{sub}</div>}
        {children}
      </div>
    </div>
  );
}

/** Secondary number inside a card, with its own info icon. */
export function SubMetric({ metric, prefix, color }: { metric: Metric; prefix?: string; color?: string }) {
  const fmt = useFmt();
  return (
    <span className="inline-flex items-center gap-0.5">
      <span style={{ color }}>{prefix ?? `${metric.label}: `}<b>{fmt.value(metric.value, metric.unit)}</b></span>
      <InfoButton metrics={[metric]} />
    </span>
  );
}
