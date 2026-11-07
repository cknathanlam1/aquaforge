"use client";
import type { Metric } from "@/lib/contract";
import { useNature } from "@/lib/store";
import { Icon } from "./Icon";

interface InfoButtonProps {
  metrics: Metric[];
  title?: string;
  className?: string;
}

/** The "show your work" trigger attached to every number. */
export function InfoButton({ metrics, title, className }: InfoButtonProps) {
  const open = useNature((s) => s.openShowWork);
  const label = title ?? metrics[0]?.label ?? "this number";
  return (
    <button type="button" className={`info-btn pe ${className ?? ""}`} aria-label={`Show your work: ${label}`} title="Show your work" onClick={(e) => { e.stopPropagation(); open(label, metrics); }}>
      <Icon name="info" size={15} />
    </button>
  );
}
