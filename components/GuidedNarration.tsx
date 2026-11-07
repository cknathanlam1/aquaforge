"use client";
import { useNature } from "@/lib/store";
import { DEMO_STEPS } from "@/lib/ui/demo";
import { useComparison, useFmt } from "./hooks";
import { Corners } from "./ui/Icon";
import { InfoButton } from "./ui/InfoButton";

const LEFT_PANEL_W = 256;
const RIGHT_PANEL_W = 340;
const DRAWER_W = 480;

/** Floating narration card for the Guided demo, centered over the visible board area. */
export function GuidedNarration() {
  const guided = useNature((s) => s.guided);
  const step = useNature((s) => s.demoStep);
  const popupOpen = useNature((s) => s.popup !== null);
  const drawerOpen = useNature((s) => s.drawerOpen);
  const leftOpen = useNature((s) => s.leftOpen);
  const { goToStep, exitGuided } = useNature.getState();
  const comparison = useComparison();
  const fmt = useFmt();
  if (!guided || step === null || popupOpen) return null;
  const s = DEMO_STEPS[step];
  const metric = s.highlight ? comparison.metrics[s.highlight] : null;
  const last = step === DEMO_STEPS.length - 1;
  const leftEdge = leftOpen ? LEFT_PANEL_W : 0;
  const rightEdge = drawerOpen ? DRAWER_W : RIGHT_PANEL_W;

  return (
    <section
      aria-label="Guided demo"
      className="blueprint anim-pop fixed bottom-[64px] z-[58] w-[440px] -translate-x-1/2 border-2 border-[var(--ink)] bg-white p-3.5 shadow-[0_6px_0_#22323f33]"
      style={{ left: `calc((${leftEdge}px + 100vw - ${rightEdge}px) / 2)` }}
    >
      <Corners />
      <div className="kicker" style={{ color: "var(--orange-deep)" }}>Guided demo · step {step + 1} of {DEMO_STEPS.length}</div>
      <h2 className="heading m-0 mt-0.5 text-[22px] uppercase leading-tight">{s.title}</h2>
      <p className="m-0 mt-1 text-[14px] leading-[1.4]">{s.text}</p>
      {metric && (
        <div className="mt-2 flex items-center gap-2 border-[1.5px] border-[var(--orange)] bg-[var(--orange-tint)] px-2.5 py-1.5">
          <span className="text-[13px]">{metric.label}</span>
          <b className="heading ml-auto text-[24px] leading-none">{fmt.value(metric.value, metric.unit)}</b>
          <InfoButton metrics={[metric]} />
        </div>
      )}
      <div className="mt-2.5 flex items-center gap-2">
        <button type="button" className="nbtn nbtn-sm" disabled={step === 0} onClick={() => goToStep(step - 1)}>Back</button>
        {last ? (
          <button type="button" className="nbtn nbtn-sm nbtn-orange" onClick={exitGuided}>Finish</button>
        ) : (
          <button type="button" className="nbtn nbtn-sm nbtn-orange" onClick={() => goToStep(step + 1)}>Next: {DEMO_STEPS[step + 1].short.split(" · ")[1]}</button>
        )}
        <button type="button" className="nbtn nbtn-link nbtn-sm ml-auto" onClick={exitGuided}>Exit demo</button>
      </div>
    </section>
  );
}
