"use client";
import { useMemo } from "react";
import { TIER_NAMES, type PieceInfo } from "@/lib/contract";
import { useNature, type RightTab } from "@/lib/store";
import { useCatalog, useComparison } from "../hooks";
import { MetricWork } from "../ShowWork";
import { Icon } from "../ui/Icon";
import { Dashboard } from "./Dashboard";
import { ScenarioToggles } from "./ScenarioToggles";

const TABS: Array<[RightTab, string]> = [["impact", "Impact"], ["rules", "Rules & assumptions"]];

function Detail() {
  const key = useNature((s) => s.detailKey);
  const { openDetail, openDrawer } = useNature.getState();
  const c = useComparison();
  if (!key) return null;
  return (
    <div className="flex flex-col gap-2.5">
      <button type="button" className="nbtn nbtn-sm self-start" onClick={() => openDetail(null)}><Icon name="arrowLeft" size={14} /> Dashboard</button>
      <MetricWork metric={c.metrics[key]} />
      <button type="button" className="nbtn nbtn-sm" onClick={() => openDrawer()}>Edit assumptions →</button>
    </div>
  );
}

function ruleLine(p: PieceInfo): string {
  return `${p.name} needs Tier ${p.requiredTier} (${TIER_NAMES[p.requiredTier!]}) or better.`;
}

function RulesTab() {
  const catalog = useCatalog();
  const c = useComparison();
  const overrideCount = useNature((s) => Object.keys(s.overrides).length);
  const openDrawer = useNature((s) => s.openDrawer);
  const lines = useMemo(() => Object.values(catalog).filter((p) => p.requiredTier).map(ruleLine), [catalog]);
  return (
    <div className="flex flex-col gap-3">
      <div className="kicker">Scenario toggles</div>
      <ScenarioToggles />
      <button type="button" className="nbtn" onClick={() => openDrawer()}>
        <Icon name="sliders" /> Edit every assumption{overrideCount ? ` (${overrideCount} changed)` : ""}
      </button>
      <div className="kicker mt-1">Board check ({c.rules.length})</div>
      {c.rules.length === 0 ? (
        <p className="m-0 text-[13px] text-[var(--green-deep)]">All connections valid.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {c.rules.map((r, i) => (
            <li key={`${r.ruleId}-${i}`} className="border-l-4 bg-[var(--note-bg)] px-2 py-1.5 text-[13px] leading-[1.35]" style={{ borderColor: r.severity === "error" ? "var(--red)" : "var(--yellow)" }}>{r.message}</li>
          ))}
        </ul>
      )}
      <div className="kicker mt-1">Constraint rules</div>
      <ol className="m-0 flex flex-col gap-1 pl-[18px] text-[13px] leading-[1.4]">
        {lines.map((l) => <li key={l}>{l}</li>)}
        <li>A desalination plant needs a brine disposal piece.</li>
        <li>Cooling systems feed server halls; server halls take no water pipe directly.</li>
      </ol>
    </div>
  );
}

export function ImpactPanel() {
  const tab = useNature((s) => s.rightTab);
  const detail = useNature((s) => s.detailKey);
  const setRightTab = useNature((s) => s.setRightTab);
  return (
    <aside className="scroll-thin flex w-[340px] flex-none flex-col gap-2.5 overflow-auto border-l border-[var(--color-neutral-300)] bg-white p-3.5" aria-label="Impact">
      <div className="seg w-full" role="tablist">
        {TABS.map(([id, name]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`nbtn flex-1 font-bold ${tab === id ? "is-on" : ""}`} onClick={() => setRightTab(id)}>{name}</button>
        ))}
      </div>
      {tab === "impact" && (detail ? <Detail /> : <Dashboard />)}
      {tab === "rules" && <RulesTab />}
    </aside>
  );
}
