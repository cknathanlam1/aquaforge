/** Lucide icon paths (ISC license, lucide.dev) inlined at stroke 1.5 per the Industry design system. */
const PATHS = {
  info: ["M12 16v-4", "M12 8h.01", "circle:12,12,10"],
  x: ["M18 6 6 18", "m6 6 12 12"],
  download: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "m7 10 5 5 5-5", "M12 15V3"],
  upload: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "m17 8-5-5-5 5", "M12 3v12"],
  link: ["M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71", "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"],
  rotate: ["M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", "M3 3v5h5"],
  play: ["polygon:6,3 20,12 6,21"],
  pause: ["rect:14,4,4,16", "rect:6,4,4,16"],
  sliders: ["M21 4h-7", "M10 4H3", "M21 12h-9", "M8 12H3", "M21 20h-5", "M12 20H3", "M14 2v4", "M8 10v4", "M16 18v4"],
  sparkles: ["M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.13-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.13a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.13 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.13a.5.5 0 0 1-.96 0z"],
  chevronLeft: ["m15 18-6-6 6-6"],
  chevronRight: ["m9 18 6-6-6-6"],
  chevronDown: ["m6 9 6 6 6-6"],
  arrowLeft: ["m12 19-7-7 7-7", "M19 12H5"],
  minus: ["M5 12h14"],
  plus: ["M5 12h14", "M12 5v14"],
  search: ["circle:11,11,8", "m21 21-4.3-4.3"],
  undo: ["M3 7v6h6", "M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"],
  check: ["M20 6 9 17l-5-5"],
  alert: ["m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3", "M12 9v4", "M12 17h.01"],
  truck: ["M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2", "M15 18H9", "M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14", "circle:17,18,2", "circle:7,18,2"],
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

function Shape({ d }: { d: string }) {
  const [kind, args] = d.includes(":") ? d.split(":") : ["path", d];
  const n = args.split(",").map(Number);
  if (kind === "circle") return <circle cx={n[0]} cy={n[1]} r={n[2]} />;
  if (kind === "rect") return <rect x={n[0]} y={n[1]} width={n[2]} height={n[3]} rx={1} />;
  if (kind === "polygon") return <polygon points={args} />;
  return <path d={d} />;
}

export function Icon({ name, size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={className}>
      {PATHS[name].map((d) => <Shape key={d} d={d} />)}
    </svg>
  );
}

export function Corners() {
  return (
    <>
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
    </>
  );
}
