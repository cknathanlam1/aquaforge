/**
 * Guided demo: building a Taiwan industrial park, as pure board/settings transforms.
 *   1. A blank park
 *   2. Build the park: data center, manufacturing plant, ops center, fire tank, concrete plant
 *   3. Add a regular desalination plant: it works, but the plant glows with a suggestion
 *   4. Switch to Harmony: every tenant needs Tier 3 or less, so batch RO is enough
 *   5. Reuse the data center's water, untreated: data center → concrete & aggregate plant
 *   6. Show the assumptions and settings behind every number
 *   7. Let the AI advisor recommend improvements
 *
 * Steps apply to the CURRENT state, so anything the presenter builds by hand is kept.
 * demoStateAt(i) replays from scratch (jumping, tests). demoTrigger(i, board) tells the UI
 * when the presenter has done step i+1's action by hand, so it can advance.
 */

import { addEdge, addNode, freeCellNear } from "./board";
import type { Board, BoardNode, PieceType, RuleResult, ScenarioSettings } from "./contract";
import { DEFAULT_SETTINGS } from "./contract";
import { PIECES } from "./pieces";
import { BLANK_PARK, TAIWAN_INDUSTRIAL_PARK } from "./presets";
import { analyzeBoard } from "./rules";

export type DemoPanel = "impact" | "assumptions" | "advisor";

export interface DemoState {
  board: Board;
  settings: ScenarioSettings;
  /** A constraint result the step is about, if any (opened only when its glowing piece is clicked). */
  popup: RuleResult | null;
  /** Node ids the UI should highlight. */
  focus: string[];
  /** Which right/side panel the step should show. */
  panel: DemoPanel;
  /** Bottom mode toggle. */
  mode: "build" | "advisor";
  /** Show the engine's weak-points list (engine.weakPoints). */
  showWeakPoints: boolean;
  /** Show a callout on the Impact panel summarizing what just changed. */
  impactCallout: boolean;
  /** Run engine.advise() on entry. */
  runAdvisor: boolean;
}

export type DemoStepId = "a" | "b" | "c" | "d" | "e" | "f" | "g";

export interface DemoStep {
  id: DemoStepId;
  title: string;
  narration: string;
  apply: (prev: DemoState) => DemoState;
}

/** The tenants the demo builds, in order. All need Tier 3 or less. */
export const DEMO_PARK_TENANTS: PieceType[] = TAIWAN_INDUSTRIAL_PARK.nodes.map((n) => n.type);

export function demoStart(): DemoState {
  return {
    board: BLANK_PARK,
    settings: { ...DEFAULT_SETTINGS, scenarioId: "drought2021" },
    popup: null,
    focus: [],
    panel: "impact",
    mode: "build",
    showWeakPoints: false,
    impactCallout: false,
    runAdvisor: false,
  };
}

const CLEAR = { popup: null, showWeakPoints: false, impactCallout: false, runAdvisor: false, panel: "impact" as DemoPanel, mode: "build" as const };

function firstOfType(board: Board, type: PieceType): BoardNode | undefined {
  return board.nodes.find((n) => n.type === type && !n.ghost);
}

function consumers(board: Board): BoardNode[] {
  return board.nodes.filter((n) => !n.ghost && PIECES[n.type].role === "consumer");
}

function connect(board: Board, pairs: Array<[string, string]>): Board {
  return pairs.reduce((b, [from, to]) => addEdge(b, from, to).board, board);
}

function place(board: Board, type: PieceType, x: number, y: number): { board: Board; node: BoardNode } {
  const existing = firstOfType(board, type);
  if (existing) return { board, node: existing };
  const placed = addNode(board, type, freeCellNear(board, x, y));
  return { board: placed.board, node: placed.board.nodes.find((n) => n.id === placed.id) as BoardNode };
}

/** (2) Add the park's tenants (any the presenter already placed are kept). */
function buildPark(prev: DemoState): DemoState {
  let board = prev.board;
  for (const tenant of TAIWAN_INDUSTRIAL_PARK.nodes) board = place(board, tenant.type, tenant.x, tenant.y).board;
  return { ...prev, ...CLEAR, board, focus: consumers(board).map((n) => n.id), showWeakPoints: true };
}

/** (3) Seawater intake → regular desal (+ brine disposal) → every tenant that has no supply yet. */
function addRegularDesal(prev: DemoState): DemoState {
  let board = prev.board;
  const plant = firstOfType(board, "desal") ?? firstOfType(board, "harmony");
  const desal = plant ? { board, node: plant } : place(board, "desal", 2, 3);
  board = desal.board;
  const sea = place(board, "seawater", 0, 3);
  board = sea.board;
  const brine = place(board, "brine", 1, 5);
  board = brine.board;
  const fed = new Set(board.edges.filter((e) => e.from === desal.node.id).map((e) => e.to));
  const pairs: Array<[string, string]> = [
    [sea.node.id, desal.node.id],
    [desal.node.id, brine.node.id],
    ...consumers(board).filter((c) => !fed.has(c.id)).map((c): [string, string] => [desal.node.id, c.id]),
  ];
  board = connect(board, pairs);
  return { ...prev, ...CLEAR, board, focus: [desal.node.id] };
}

/** (4) Swap every regular desal plant for Harmony (the park needs Tier 3 at most). */
function switchToHarmony(prev: DemoState): DemoState {
  const desals = prev.board.nodes.filter((n) => n.type === "desal" && !n.ghost).map((n) => n.id);
  const board: Board = { ...prev.board, nodes: prev.board.nodes.map((n) => (desals.includes(n.id) ? { ...n, type: "harmony", existing: false } : n)) };
  return { ...prev, ...CLEAR, board, focus: desals, impactCallout: true };
}

/**
 * (5) The data center's used cooling water (blowdown) goes straight to the concrete & aggregate
 * plant for dust suppression and washdown: no treatment, just a pipe. Precedent: power plants
 * reuse cooling-tower blowdown for dust control (Plata et al. 2022).
 */
function reuseDataCenterWater(prev: DemoState): DemoState {
  const dc = firstOfType(prev.board, "datacenter");
  const concrete = firstOfType(prev.board, "concrete");
  if (!dc || !concrete) return { ...prev, ...CLEAR, impactCallout: true };
  const board = connect(prev.board, [[dc.id, concrete.id]]);
  return { ...prev, ...CLEAR, board, focus: [dc.id, concrete.id], impactCallout: true };
}

export const DEMO_STEPS: DemoStep[] = [
  {
    id: "a",
    title: "A blank industrial park",
    narration: "An empty plot in a Taiwan science park, with no buildings and no water. Let's build it.",
    apply: () => demoStart(),
  },
  {
    id: "b",
    title: "Build the park",
    narration: "Tenants move in: a data center campus, a manufacturing plant, an ops center, a fire suppression tank and a concrete & aggregate plant. None of them has water yet, so the engine flags each one and what it costs.",
    apply: buildPark,
  },
  {
    id: "c",
    title: "Add a regular desalination plant",
    narration: "Supply the park from the sea, which a drought can't cut: a seawater intake, a regular desalination plant and brine disposal. Everything comes online, but the plant glows: AquaForge has a better option. Click it to see why.",
    apply: addRegularDesal,
  },
  {
    id: "d",
    title: "Switch to Harmony",
    narration: "Every tenant here needs Tier 3 or less. Harmony's batch RO stops at Tier 3, and in exchange it uses less energy, makes less brine and wears membranes less. See what that's worth on the right.",
    apply: switchToHarmony,
  },
  {
    id: "e",
    title: "Reuse the data center's water",
    narration: "The data center's used cooling water is too salty to drink but fine for keeping dust down. Pipe it straight to the concrete & aggregate plant: no treatment, just a pipe. The park buys less desalinated water and discharges less.",
    apply: reuseDataCenterWater,
  },
  {
    id: "f",
    title: "Check the assumptions",
    narration: "Every number comes from an editable assumption, labeled sourced or illustrative. Harmony and regular desal have separate inputs: change one and the whole dashboard recomputes.",
    apply: (prev) => ({ ...prev, ...CLEAR, focus: [], panel: "assumptions" }),
  },
  {
    id: "g",
    title: "Ask the AI advisor",
    narration: "The advisor tries the additions that could help, drops any that break a rule, and ranks the rest by risk-adjusted NPV.",
    apply: (prev) => ({ ...prev, ...CLEAR, focus: [], panel: "advisor", mode: "advisor", runAdvisor: true }),
  },
];

/** Run steps from scratch up to stepIndex (used when jumping to a step). */
export function demoStateAt(stepIndex: number): DemoState {
  let state = demoStart();
  for (let i = 0; i <= Math.min(stepIndex, DEMO_STEPS.length - 1); i++) state = DEMO_STEPS[i].apply(state);
  return state;
}

/** Advance one step from the live state (keeps what the presenter built by hand). */
export function demoNext(current: DemoState, stepIndex: number): DemoState {
  const step = DEMO_STEPS[Math.min(stepIndex, DEMO_STEPS.length - 1)];
  return step.apply(current);
}

/**
 * True when, during step `stepIndex`, the presenter has done the NEXT step's action by hand,
 * so the UI should advance with demoNext(live, stepIndex + 1):
 *   step 1 (blank):  a data center is on the board
 *   step 2 (park):   a desal plant supplies a tenant through a valid pipe
 *   step 4 (Harmony): the data center's used water is piped to the concrete plant (or a reuse plant)
 */
export function demoTrigger(stepIndex: number, board: Board): boolean {
  if (stepIndex === 0) return Boolean(firstOfType(board, "datacenter"));
  const analysis = analyzeBoard(board);
  const validFrom = (id: string) => (analysis.validOut[id] ?? []).map((e) => board.nodes.find((n) => n.id === e.to)).filter((n): n is BoardNode => Boolean(n));
  if (stepIndex === 1) {
    return board.nodes.some((n) => n.type === "desal" && validFrom(n.id).some((t) => PIECES[t.type].role === "consumer"));
  }
  if (stepIndex === 3) {
    const dc = firstOfType(board, "datacenter");
    return Boolean(dc && validFrom(dc.id).some((t) => t.type === "concrete" || PIECES[t.type].role === "reuse"));
  }
  return false;
}
