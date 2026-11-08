"use client";
import { useRef } from "react";
import { SCENARIO_LABELS, type ScenarioId } from "@/lib/contract";
import { useNature } from "@/lib/store";
import { engine } from "@/lib/ui/engine";
import { downloadScenario, encodeScenarioHash, readScenarioUpload } from "@/lib/ui/scenarioFile";
import { useValues } from "./hooks";
import { Icon } from "./ui/Icon";

const SCENARIOS = Object.keys(SCENARIO_LABELS) as ScenarioId[];
const PRESETS = engine.presets();

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export function Header() {
  const presetId = useNature((s) => s.presetId);
  const scenarioName = useNature((s) => s.scenarioName);
  const settings = useNature((s) => s.settings);
  const currency = useNature((s) => s.currency);
  const overrideCount = useNature((s) => Object.keys(s.overrides).length);
  const { loadPreset, setScenario, setCutLevel, setCurrency, startGuided, openDrawer, loadFile, toScenarioFile, notify, resetBoard } = useNature.getState();
  const values = useValues();
  const fileRef = useRef<HTMLInputElement>(null);

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    const res = await readScenarioUpload(f);
    if (res.ok) {
      loadFile(res.file);
      notify(`Loaded “${res.file.name}”.`);
    } else notify(res.error, "error");
    if (fileRef.current) fileRef.current.value = "";
  };

  const onShare = async () => {
    try {
      const hash = await encodeScenarioHash(toScenarioFile());
      const url = `${location.origin}${location.pathname}#${hash}`;
      history.replaceState(null, "", `#${hash}`);
      await navigator.clipboard.writeText(url);
      notify("Share link copied to clipboard.");
    } catch {
      notify("Link is in the address bar (clipboard unavailable).");
    }
  };

  return (
    <header className="flex h-[54px] flex-none items-center gap-2.5 border-b border-[var(--color-neutral-300)] bg-white px-3">
      <div className="flex items-baseline gap-2">
        <span className="heading text-[26px] uppercase tracking-[0.02em]">AquaForge</span>
      </div>
      <label className="flex items-center gap-1.5 text-[13px] text-[var(--color-neutral-700)]">
        <span className="sr-only">Project</span>
        <select
          aria-label="Demo scenario"
          className="ninput max-w-[176px] py-[5px] font-semibold"
          value={presetId}
          onChange={(e) => loadPreset(e.target.value)}
        >
          {presetId === "custom" && <option value="custom">{scenarioName}</option>}
          {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>

      <div className="flex items-center gap-1.5" role="group" aria-label="Scenario">
        <div className="seg">
          {SCENARIOS.map((id) => (
            <button key={id} type="button" className="nbtn nbtn-sm" aria-pressed={settings.scenarioId === id} onClick={() => setScenario(id)}>
              {SCENARIO_LABELS[id]}
            </button>
          ))}
        </div>
        {settings.scenarioId === "drought2021" && (
          <div className="seg" role="group" aria-label="Mandated cut">
            <button type="button" className="nbtn nbtn-sm" aria-pressed={settings.cutLevel === "initial"} onClick={() => setCutLevel("initial")} title="Initial mandated cut">
              {pct(values["scenario.drought2021.cut"])} cut
            </button>
            <button type="button" className="nbtn nbtn-sm" aria-pressed={settings.cutLevel === "escalated"} onClick={() => setCutLevel("escalated")} title="Escalated mandated cut">
              {pct(values["scenario.drought2021.cutEscalated"])}
            </button>
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <div className="seg" role="group" aria-label="Currency">
          <button type="button" className="nbtn nbtn-sm" aria-pressed={currency === "USD"} onClick={() => setCurrency("USD")}>USD</button>
          <button type="button" className="nbtn nbtn-sm" aria-pressed={currency === "TWD"} onClick={() => setCurrency("TWD")}>NT$</button>
        </div>
        <button type="button" className="nbtn nbtn-sm nbtn-orange" onClick={startGuided}>
          <Icon name="play" size={14} /> Guided demo
        </button>
        <button type="button" className="nbtn nbtn-sm" onClick={() => openDrawer()}>
          <Icon name="sliders" size={15} /> Assumptions{overrideCount > 0 ? ` (${overrideCount})` : ""}
        </button>
        <div className="seg">
          <button type="button" className="nbtn nbtn-icon" aria-label="Import scenario JSON" title="Import scenario JSON" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" />
          </button>
          <button type="button" className="nbtn nbtn-icon" aria-label="Export scenario JSON" title="Export scenario JSON" onClick={() => downloadScenario(toScenarioFile())}>
            <Icon name="download" />
          </button>
          <button type="button" className="nbtn nbtn-icon" aria-label="Copy share link" title="Copy share link" onClick={onShare}>
            <Icon name="link" />
          </button>
        </div>
        <button
          type="button"
          className="nbtn nbtn-sm"
          title="Reset the board to the loaded project and default scenario settings (keeps assumption edits)"
          onClick={() => {
            if (location.hash) history.replaceState(null, "", location.pathname);
            resetBoard();
          }}
        >
          <Icon name="rotate" size={15} /> Reset
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onImport(e.target.files?.[0])} />
      </div>
    </header>
  );
}
