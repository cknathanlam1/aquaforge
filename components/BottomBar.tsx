"use client";
import { useNature, type Mode } from "@/lib/store";
import { DEMO_STEPS } from "@/lib/ui/demo";

const MODES: Array<[Mode, string]> = [["build", "Build it myself"], ["advisor", "AI Advisor"]];

export function BottomBar() {
  const mode = useNature((s) => s.mode);
  const step = useNature((s) => s.demoStep);
  const { setMode, goToStep } = useNature.getState();
  return (
    <footer className="flex h-[54px] flex-none items-center gap-4 border-t border-[var(--color-neutral-300)] bg-white px-3">
      <div className="seg" role="group" aria-label="Mode">
        {MODES.map(([id, name]) => {
          const on = mode === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => setMode(id)}
              className="nbtn"
              style={{ fontSize: 16, fontWeight: 700, padding: "8px 18px", borderWidth: 2, marginLeft: id === "build" ? 0 : -2, ...(on && id === "advisor" ? { background: "var(--orange)", color: "var(--color-text)" } : {}) }}
            >
              {name}
            </button>
          );
        })}
      </div>
      <nav className="ml-auto flex items-center gap-1.5" aria-label="Demo steps">
        <span className="kicker mr-1" style={{ fontSize: 12 }}>Demo steps</span>
        {DEMO_STEPS.map((s, i) => (
          <button key={s.short} type="button" className="nbtn nbtn-sm" aria-current={step === i ? "step" : undefined} style={step === i ? { background: "var(--orange-tint)", borderColor: "var(--orange)" } : undefined} onClick={() => goToStep(i)} title={s.title}>
            {s.short}
          </button>
        ))}
      </nav>
    </footer>
  );
}
