"use client";
import { memo } from "react";
import { BOARD_COLORS as C } from "@/lib/ui/pieceArt";

export interface PipeVisual {
  key: string;
  d: string;
  color: string;
  dash?: string;
  flow: boolean;
  /** Seconds per dash cycle (faster with more m³/day). */
  speed: number;
  width: number;
  flash: boolean;
  bad?: { mx: number; my: number };
  rubber?: boolean;
}

/** One pipe: ink casing, tier-colored core, animated white droplet dash; red shaking X when rejected. */
export const BoardPipe = memo(function BoardPipe({ p, playing }: { p: PipeVisual; playing: boolean }) {
  const common = { fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (p.bad) {
    const { mx: x, my: y } = p.bad;
    return (
      <g style={{ pointerEvents: "none" }}>
        <path d={p.d} stroke={C.ink} strokeWidth={14} {...common} />
        <g style={{ animation: "pulse .4s ease infinite" }}>
          <path d={p.d} stroke={C.red} strokeWidth={12} strokeDasharray="10 8" {...common} />
        </g>
        <circle cx={x} cy={y} r={14} fill={C.red} stroke={C.ink} strokeWidth={3} />
        <path d={`M${x - 6} ${y - 6} L${x + 6} ${y + 6} M${x + 6} ${y - 6} L${x - 6} ${y + 6}`} stroke="#fff" strokeWidth={4} strokeLinecap="round" />
      </g>
    );
  }
  if (p.rubber) {
    return <path d={p.d} stroke={C.orange} strokeWidth={8} strokeDasharray="12 8" style={{ pointerEvents: "none" }} {...common} />;
  }
  return (
    <g style={{ pointerEvents: "none" }}>
      <path d={p.d} stroke={C.ink} strokeWidth={p.width + 6} {...common} />
      <path d={p.d} stroke={p.color} strokeWidth={p.width} strokeDasharray={p.dash} {...common} />
      {p.flow && (
        <path
          d={p.d}
          stroke="#ffffff"
          strokeWidth={4}
          strokeDasharray="1 15"
          {...common}
          style={{
            animationName: "flow",
            animationDuration: `${p.speed.toFixed(2)}s`,
            animationTimingFunction: "linear",
            animationIterationCount: "infinite",
            animationPlayState: playing ? "running" : "paused",
          }}
        />
      )}
      {p.flash && <path d={p.d} stroke={C.green} strokeWidth={18} {...common} style={{ animation: "pulse .5s ease 3" }} />}
    </g>
  );
});
