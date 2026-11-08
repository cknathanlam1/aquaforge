"use client";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ASSUMPTION_KEYS, DEFAULT_ASSUMPTIONS, type AssumptionGroup, type AssumptionKey } from "@/lib/assumptions";
import { useNature } from "@/lib/store";
import { DesalCompare } from "./DesalCompare";
import { ScenarioToggles } from "./impact/ScenarioToggles";
import { StatusBadge } from "./ShowWork";
import { Icon } from "./ui/Icon";

const GROUPS: AssumptionGroup[] = [...new Set(ASSUMPTION_KEYS.map((k) => DEFAULT_ASSUMPTIONS[k].group))];

const Row = memo(function Row({ k, value, focused }: { k: AssumptionKey; value: number | undefined; focused: boolean }) {
  const a = DEFAULT_ASSUMPTIONS[k];
  const setOverride = useNature((s) => s.setOverride);
  const current = value ?? a.value;
  const [draft, setDraft] = useState(String(current));
  const [prevCurrent, setPrevCurrent] = useState(current);
  if (prevCurrent !== current) { setPrevCurrent(current); setDraft(String(current)); }
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (focused) { ref.current?.scrollIntoView({ block: "center" }); ref.current?.querySelector("input")?.focus(); } }, [focused]);
  const changed = value !== undefined && value !== a.value;

  const commit = (text: string) => {
    setDraft(text);
    const v = Number(text);
    if (text.trim() !== "" && Number.isFinite(v)) setOverride(k, v === a.value ? null : v);
  };

  return (
    <div ref={ref} className={`grid grid-cols-[1fr_auto] items-start gap-x-2 gap-y-0.5 border-b border-dashed border-[#cfd5da] py-2 ${focused ? "bg-[var(--orange-tint)]" : ""}`}>
      <label htmlFor={`a-${k}`} className="text-[13px] leading-[1.25]">
        <b className="font-semibold">{a.label}</b>
        <span className="block text-[11px] text-[var(--color-neutral-600)]">{k}</span>
      </label>
      <div className="flex items-center gap-1">
        <input
          id={`a-${k}`}
          type="number"
          step="any"
          className="ninput w-[104px] text-right font-semibold"
          style={changed ? { background: "var(--orange-tint)" } : undefined}
          value={draft}
          onChange={(e) => commit(e.target.value)}
          aria-describedby={`a-${k}-src`}
        />
        <button type="button" className="nbtn nbtn-icon h-[30px] w-[30px]" aria-label={`Reset ${a.label} to default`} title={`Reset to default (${a.value})`} disabled={!changed} onClick={() => setOverride(k, null)}>
          <Icon name="undo" size={14} />
        </button>
      </div>
      <div id={`a-${k}-src`} className="col-span-2 flex flex-wrap items-center gap-1.5 text-[11.5px] text-[var(--color-neutral-700)]">
        <span className="font-semibold">{a.unit}</span>
        <StatusBadge status={a.status} />
        {changed && <span className="text-[var(--orange-text)]">default {a.value}</span>}
      </div>
      {a.status === "sourced" && <div className="col-span-2 text-[11.5px] leading-[1.3] text-[var(--color-neutral-700)]">{a.source}</div>}
      {"note" in a && a.note && <div className="col-span-2 text-[11.5px] leading-[1.3] text-[var(--color-neutral-600)] italic">{a.note}</div>}
    </div>
  );
});

export function AssumptionsDrawer() {
  const open = useNature((s) => s.drawerOpen);
  const focus = useNature((s) => s.drawerFocus);
  const overrides = useNature((s) => s.overrides);
  const { closeDrawer, resetOverrides } = useNature.getState();
  const [query, setQuery] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const changedCount = Object.keys(overrides).length;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    if (!focus) panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeDrawer(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [open, focus, closeDrawer]);

  const q = query.trim().toLowerCase();
  const byGroup = useMemo(() => GROUPS.map((g) => ({
    group: g,
    keys: ASSUMPTION_KEYS.filter((k) => DEFAULT_ASSUMPTIONS[k].group === g && (!q || k.toLowerCase().includes(q) || DEFAULT_ASSUMPTIONS[k].label.toLowerCase().includes(q))),
  })).filter((x) => x.keys.length > 0), [q]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[55] flex justify-end bg-[#1d1f2040]" onClick={closeDrawer}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Assumptions"
        tabIndex={-1}
        className="flex h-full w-[480px] max-w-[96vw] flex-col border-l-[2.5px] border-[var(--ink)] bg-white"
        style={{ animation: "slidein .18s ease" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-none flex-col gap-2 border-b border-[var(--color-neutral-300)] p-3.5">
          <div className="flex items-center gap-2">
            <h2 className="heading m-0 text-[24px] uppercase">Assumptions</h2>
            <span className="text-[12px] text-[var(--color-neutral-600)]">{ASSUMPTION_KEYS.length} values · {changedCount} changed</span>
            <button type="button" className="nbtn nbtn-icon ml-auto" aria-label="Close assumptions" onClick={closeDrawer}><Icon name="x" /></button>
          </div>
          <div className="flex gap-2">
            <label className="relative flex-1">
              <span className="sr-only">Filter assumptions</span>
              <input className="ninput w-full pl-7" placeholder="Filter, e.g. desal or price" value={query} onChange={(e) => setQuery(e.target.value)} />
              <span className="pointer-events-none absolute top-2 left-2 text-[var(--color-neutral-600)]"><Icon name="search" size={15} /></span>
            </label>
            <button type="button" className="nbtn nbtn-sm" disabled={changedCount === 0} onClick={resetOverrides}>Reset all</button>
          </div>
        </div>
        <div className="scroll-thin flex-1 overflow-auto px-3.5 pb-6">
          <section className="py-3">
            <div className="kicker mb-1.5">Scenario toggles</div>
            <ScenarioToggles />
          </section>
          {!q && <DesalCompare />}
          {byGroup.map(({ group, keys }) => (
            <section key={group} className="pt-2">
              <h3 className="kicker sticky top-0 z-[1] m-0 border-b-[1.5px] border-[var(--ink)] bg-white py-1.5" style={{ color: "var(--color-text)" }}>{group}</h3>
              {keys.map((k) => <Row key={k} k={k} value={overrides[k]} focused={focus === k} />)}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
