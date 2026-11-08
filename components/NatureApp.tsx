"use client";
import { useEffect } from "react";
import { useNature } from "@/lib/store";
import { ENGINE_IS_MOCK } from "@/lib/ui/engine";
import { decodeScenarioHash } from "@/lib/ui/scenarioFile";
import { AdvisorPanel } from "./AdvisorPanel";
import { AssumptionsDrawer } from "./AssumptionsDrawer";
import { Board } from "./board/Board";
import { BottomBar } from "./BottomBar";
import { ConstraintPopup } from "./ConstraintPopup";
import { SuggestionPopup } from "./SuggestionPopup";
import { Header } from "./Header";
import { ImpactPanel } from "./impact/ImpactPanel";
import { Palette } from "./Palette";
import { ShowWorkDialog } from "./ShowWork";

function Toast() {
  const toast = useNature((s) => s.toast);
  if (!toast) return null;
  return (
    <div role="status" className="anim-pop fixed top-[64px] left-1/2 z-[70] -translate-x-1/2 border-2 border-[var(--ink)] px-3 py-2 text-[14px] font-semibold shadow-[0_4px_0_#22323f33]" style={{ background: toast.kind === "error" ? "var(--red-tint)" : "var(--green-tint)" }}>
      {toast.text}
    </div>
  );
}

function useHashLoad() {
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const res = await decodeScenarioHash(window.location.hash);
      if (cancelled || !res) return;
      const st = useNature.getState();
      if (res.ok) { st.loadFile(res.file); st.notify(`Loaded shared scenario “${res.file.name}”.`); }
      else st.notify(res.error, "error");
    };
    void load();
    const onHash = () => void load();
    window.addEventListener("hashchange", onHash);
    return () => { cancelled = true; window.removeEventListener("hashchange", onHash); };
  }, []);
}

export function NatureApp() {
  const mode = useNature((s) => s.mode);
  const leftOpen = useNature((s) => s.leftOpen);
  useHashLoad();

  return (
    <div className="flex h-screen min-w-[1280px] flex-col overflow-hidden bg-[var(--color-bg)] text-[var(--color-text)]">
      <Header />
      <main className="flex min-h-0 flex-1">
        <aside
          aria-label={mode === "build" ? "Piece palette" : "AI Advisor"}
          className="scroll-thin flex-none overflow-x-hidden overflow-y-auto bg-white transition-[width] duration-200"
          style={{ width: leftOpen ? 256 : 0, borderRight: leftOpen ? "1px solid var(--color-neutral-300)" : 0 }}
          hidden={!leftOpen}
        >
          <div className="w-[256px]">{mode === "build" ? <Palette /> : <AdvisorPanel />}</div>
        </aside>
        <Board />
        <ImpactPanel />
      </main>
      <BottomBar />
      {ENGINE_IS_MOCK && (
        <div className="pointer-events-none fixed right-[352px] bottom-[60px] z-10 border border-[var(--orange-line)] bg-[var(--orange-tint)] px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--orange-text)]">
          MOCK ENGINE
        </div>
      )}
      <ConstraintPopup />
      <SuggestionPopup />
      <ShowWorkDialog />
      <AssumptionsDrawer />
      <Toast />
    </div>
  );
}
