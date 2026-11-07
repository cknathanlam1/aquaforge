"use client";
import { useEffect, useRef } from "react";
import { DEFAULT_ASSUMPTIONS, STATUS_LABEL } from "@/lib/assumptions";
import type { Metric } from "@/lib/contract";
import { useNature } from "@/lib/store";
import { useFmt } from "./hooks";
import { Corners, Icon } from "./ui/Icon";

export function StatusBadge({ status }: { status: "sourced" | "illustrative" }) {
  return <span className={status === "sourced" ? "badge-sourced" : "badge-ill"}>{STATUS_LABEL[status]}</span>;
}

/** "Show your work": the metric's formula plus every input, linked to its assumption. */
export function MetricWork({ metric, big = true }: { metric: Metric; big?: boolean }) {
  const fmt = useFmt();
  const openDrawer = useNature((s) => s.openDrawer);
  return (
    <div className="flex flex-col gap-2">
      <div>
        <div className="kicker">{metric.label}</div>
        <div className={`heading leading-none ${big ? "text-[38px]" : "text-[26px]"}`}>{fmt.value(metric.value, metric.unit)}</div>
      </div>
      <div className="border-[1.5px] border-[var(--ink)] bg-[var(--note-bg)] px-2.5 py-2 text-[14px] font-semibold leading-[1.35]">
        <span className="mr-1 text-[11px] font-bold tracking-[0.1em] text-[var(--color-neutral-600)] uppercase">Formula</span>
        <div>{metric.formula}</div>
      </div>
      {metric.inputs.length > 0 && (
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-[10.5px] tracking-[0.08em] text-[var(--color-neutral-600)] uppercase">
              <th className="border-b border-[var(--color-divider)] py-1 pr-1 font-semibold">Input</th>
              <th className="border-b border-[var(--color-divider)] py-1 text-right font-semibold">Value</th>
            </tr>
          </thead>
          <tbody>
            {metric.inputs.map((inp, i) => {
              const a = inp.assumptionKey ? DEFAULT_ASSUMPTIONS[inp.assumptionKey] : null;
              return (
                <tr key={`${inp.symbol}-${i}`} className="align-top">
                  <td className="border-b border-dashed border-[#cfd5da] py-1.5 pr-2">
                    <div><code className="mr-1 text-[12px] text-[var(--color-accent-700)]">{inp.symbol}</code>{inp.label}</div>
                    {inp.assumptionKey && a && (
                      <button type="button" className="mt-0.5 flex cursor-pointer flex-wrap items-center gap-1 border-0 bg-transparent p-0 text-left text-[11.5px] text-[var(--color-accent-700)] underline-offset-2 hover:underline" onClick={() => openDrawer(inp.assumptionKey)}>
                        <Icon name="sliders" size={12} /> {a.label} <span className="text-[var(--color-neutral-600)]">({inp.assumptionKey})</span>
                        <StatusBadge status={a.status} />
                      </button>
                    )}
                  </td>
                  <td className="border-b border-dashed border-[#cfd5da] py-1.5 text-right font-bold whitespace-nowrap">{fmt.value(inp.value, inp.unit)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {metric.note && <p className="m-0 border border-[var(--note-line)] bg-[var(--note-bg)] p-2 text-[12.5px] leading-[1.4]">{metric.note}</p>}
    </div>
  );
}

/** Modal used by every info icon. */
export function ShowWorkDialog() {
  const sw = useNature((s) => s.showWork);
  const close = useNature((s) => s.closeShowWork);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sw) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [sw, close]);
  if (!sw) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1d1f2059]" onClick={close}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={`Show your work: ${sw.title}`}
        tabIndex={-1}
        className="blueprint anim-pop w-[520px] max-w-[94vw] border-[2.5px] border-[var(--ink)] bg-white shadow-[0_10px_0_#22323f44]"
        onClick={(e) => e.stopPropagation()}
      >
        <Corners />
        <div className="max-h-[86vh] overflow-y-auto p-5">
        <div className="mb-2 flex items-center gap-2">
          <span className="kicker" style={{ color: "var(--color-accent-700)" }}>Show your work</span>
          <button type="button" className="nbtn nbtn-icon ml-auto" aria-label="Close" onClick={close}><Icon name="x" /></button>
        </div>
        <div className="flex flex-col gap-5">
          {sw.metrics.map((m) => <MetricWork key={m.key} metric={m} big={sw.metrics.length === 1} />)}
        </div>
        </div>
      </div>
    </div>
  );
}
