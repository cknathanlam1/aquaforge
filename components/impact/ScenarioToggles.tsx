"use client";
import { useNature } from "@/lib/store";

const TOGGLES = [
  ["truckingEnabled", "Trucked water", "Shortfalls are covered by tanker trucks, up to the daily cap."],
  ["surchargeEnabled", "Municipal surcharge", "Surcharge on municipal use above the monthly threshold."],
  ["couplingEnabled", "Energy-water coupling", "Drought days raise electricity prices and derate desal and recycling."],
] as const;

export function ScenarioToggles() {
  const settings = useNature((s) => s.settings);
  const toggle = useNature((s) => s.toggleSetting);
  return (
    <div className="flex flex-col gap-1.5">
      {TOGGLES.map(([key, label, help]) => (
        <label key={key} className="flex cursor-pointer items-start gap-2 text-[13px] leading-[1.3]">
          <input type="checkbox" className="mt-0.5 h-4 w-4 flex-none accent-[var(--ink)]" checked={settings[key]} onChange={() => toggle(key)} />
          <span><b>{label}</b><span className="block text-[12px] text-[var(--color-neutral-600)]">{help}</span></span>
        </label>
      ))}
    </div>
  );
}
