"use client";
import { TIER_NAMES, type Tier } from "@/lib/contract";
import { useNature, type Tool } from "@/lib/store";
import { MAX_BOARD_SIZE, MIN_BOARD_SIZE } from "@/lib/ui/placement";
import { TIER_COLORS } from "@/lib/ui/pieceArt";
import { useComparison } from "../hooks";
import { Icon } from "../ui/Icon";
import { GuidedNarration } from "../GuidedNarration";

const TOOLS: Array<[Tool, string]> = [["select", "Select"], ["pipe", "Pipe"], ["delete", "Delete"]];
const TIERS: Tier[] = [1, 2, 3, 4, 5];
const SIZES = Array.from({ length: (MAX_BOARD_SIZE - MIN_BOARD_SIZE) / 2 + 1 }, (_, i) => MIN_BOARD_SIZE + i * 2);
const MAX_ALERTS = 3;

interface Alert { key: string; bg: string; dot: string; icon: string; text: string }

function useAlerts(): Alert[] {
  const comparison = useComparison();
  const scenarioId = useNature((s) => s.settings.scenarioId);
  const out: Alert[] = [];
  const stress = comparison.design.stressDay;
  if (scenarioId !== "normal" && stress && Object.values(stress.nodes).some((n) => n.status === "partial")) {
    out.push({ key: "stress", bg: "var(--red-tint)", dot: "var(--red)", icon: "!", text: "Municipal supply is cut in this scenario. Try desal, recycling or a Nearby plant." });
  }
  for (const r of comparison.rules) {
    const err = r.severity === "error";
    out.push({ key: `${r.ruleId}-${r.nodeId ?? r.edgeId ?? ""}`, bg: err ? "var(--red-tint)" : r.severity === "warning" ? "var(--yellow-tint)" : "var(--blue-tint)", dot: err ? "var(--red)" : r.severity === "warning" ? "var(--yellow)" : "var(--blue)", icon: err ? "!" : r.severity === "warning" ? "!" : "i", text: r.message });
  }
  if (out.length === 0) out.push({ key: "ok", bg: "var(--green-tint)", dot: "var(--green)", icon: "✓", text: "All connections valid. Nice system!" });
  return out.slice(0, MAX_ALERTS);
}

export function BoardOverlays() {
  const tool = useNature((s) => s.tool);
  const pending = useNature((s) => s.pending);
  const leftOpen = useNature((s) => s.leftOpen);
  const zoom = useNature((s) => s.zoom);
  const playing = useNature((s) => s.playing);
  const size = useNature((s) => s.boardSize);
  const { setTool, toggleLeft, setZoom, resetView, togglePlay, setBoardSize } = useNature.getState();
  const alerts = useAlerts();
  const hint = tool === "select" ? "Click a piece, then a tile to move it. Or drag it." : tool === "pipe" ? (pending ? "Now click the piece to connect to." : "Click a source, then the piece it should feed.") : "Click a piece to remove it.";

  return (
    <>
      <div className="absolute top-3 left-3 flex flex-col gap-1.5">
        <div>
          <button type="button" className="nbtn" style={{ borderWidth: 2 }} onClick={toggleLeft} aria-expanded={leftOpen}>
            <Icon name={leftOpen ? "chevronLeft" : "chevronRight"} /> {leftOpen ? "Hide panel" : "Pieces"}
          </button>
        </div>
        <div className="seg" role="group" aria-label="Board tool">
          {TOOLS.map(([id, name]) => (
            <button key={id} type="button" className="nbtn" style={{ borderWidth: 2, marginLeft: id === "select" ? 0 : -2 }} aria-pressed={tool === id} onClick={() => setTool(id)}>{name}</button>
          ))}
        </div>
        <div className="max-w-[250px] border border-[var(--color-neutral-300)] bg-white/85 px-2 py-1 text-[12.5px] text-[var(--color-neutral-700)]" aria-live="polite">{hint}</div>
      </div>

      <div className="absolute top-3 right-3 flex w-[290px] flex-col gap-1.5" aria-live="polite">
        {alerts.map((a) => (
          <div key={a.key} className="flex items-start gap-2 border-2 border-[var(--ink)] px-2.5 py-[7px] text-[13px] leading-[1.3] shadow-[0_3px_0_#22323f33]" style={{ background: a.bg }}>
            <span className="h-[18px] w-[18px] flex-none rounded-full text-center text-[12px] leading-[18px] font-bold text-white" style={{ background: a.dot }} aria-hidden="true">{a.icon}</span>
            <span>{a.text}</span>
          </div>
        ))}
      </div>

      <div className="absolute bottom-3 left-3 flex max-w-[300px] flex-wrap items-center gap-x-1.5 gap-y-0.5 border-[1.5px] border-[var(--ink)] bg-white/90 px-2 py-1.5">
        <span className="font-[family-name:var(--font-heading)] text-[12px] font-bold tracking-[0.1em]">WATER TIERS</span>
        {TIERS.map((t) => (
          <span key={t} className="flex items-center gap-1 text-[12px]">
            <i className="block h-2 w-3.5 border-[1.5px] border-[var(--ink)]" style={{ background: TIER_COLORS[t] }} />T{t} {TIER_NAMES[t].split("/")[0]}
          </span>
        ))}
      </div>

      <div className="absolute right-3 bottom-3 flex items-center gap-2">
        <button type="button" className="nbtn nbtn-icon" style={{ borderWidth: 2 }} onClick={togglePlay} aria-label={playing ? "Pause water flow" : "Play water flow"} title={playing ? "Pause flow" : "Play flow"}>
          <Icon name={playing ? "pause" : "play"} />
        </button>
        <label className="flex items-center gap-1 text-[12px]">
          <span className="sr-only">Map size</span>
          <select className="ninput py-[5px] text-[13px] font-semibold" style={{ borderWidth: 2 }} value={size} onChange={(e) => setBoardSize(Number(e.target.value))} aria-label="Map size">
            {!SIZES.includes(size) && <option value={size}>{size} × {size}</option>}
            {SIZES.map((n) => <option key={n} value={n}>{n} × {n}</option>)}
          </select>
        </label>
        <div className="flex border-2 border-[var(--ink)] bg-white">
          <button type="button" className="h-[32px] w-9 cursor-pointer border-0 bg-white text-[18px] font-bold hover:bg-[var(--hover-tint)]" onClick={() => setZoom(zoom / 1.2)} aria-label="Zoom out">−</button>
          <button type="button" className="w-16 cursor-pointer border-0 border-x-[1.5px] border-[var(--ink)] bg-white text-[13px] font-semibold hover:bg-[var(--hover-tint)]" onClick={resetView} aria-label="Reset zoom and pan">{Math.round(zoom * 100)}%</button>
          <button type="button" className="h-[32px] w-9 cursor-pointer border-0 bg-white text-[18px] font-bold hover:bg-[var(--hover-tint)]" onClick={() => setZoom(zoom * 1.2)} aria-label="Zoom in">+</button>
        </div>
      </div>
      <GuidedNarration />
    </>
  );
}
