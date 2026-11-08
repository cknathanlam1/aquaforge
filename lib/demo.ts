/**
 * Guided demo: a Taiwan data center campus, as pure board/settings transforms.
 *   1. A data center with no water: the engine flags it and recommends a source
 *   2. Add a regular desalination plant: it works, but the plant glows with a suggestion
 *   3. Switch to Harmony desalination: why (right-sized quality, energy, brine, membranes),
 *      with an impact callout on the dashboard
 *   4. Show the assumptions and settings behind every number (Harmony has its own inputs)
 *   5. Let the AI advisor recommend improvements
 *
 * Steps apply to the CURRENT state, so a presenter who builds the desal plant by hand in step 1
 * keeps that board. demoStateAt(i) replays from scratch (jumping, tests).
 */

import { addEdge, addNode, freeCellNear, nodeById } from "./board";
import type { Board, BoardNode, RuleResult, ScenarioSettings } from "./contract";
import { DEFAULT_SETTINGS } from "./contract";
import { TAIWAN_DATA_CENTER } from "./presets";

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
  /** Step 1: show the engine's weak-points list (engine.weakPoints). */
  showWeakPoints: boolean;
  /** Step 3: show a callout on the Impact panel summarizing what just changed. */
  impactCallout: boolean;
  /** Step 5: run engine.advise() on entry. */
  runAdvisor: boolean;
}

export type DemoStepId = "a" | "b" | "c" | "d" | "e";

export interface DemoStep {
  id: DemoStepId;
  title: string;
  narration: string;
  apply: (prev: DemoState) => DemoState;
}

/** The data center's id on the demo board. */
export const DEMO_DC_ID = "n1";

export function demoStart(): DemoState {
  return {
    board: TAIWAN_DATA_CENTER,
    settings: { ...DEFAULT_SETTINGS, scenarioId: "drought2021" },
    popup: null,
    focus: [DEMO_DC_ID],
    panel: "impact",
    mode: "build",
    showWeakPoints: true,
    impactCallout: false,
    runAdvisor: false,
  };
}

const CLEAR = { popup: null, showWeakPoints: false, impactCallout: false, runAdvisor: false, panel: "impact" as DemoPanel, mode: "build" as const };

function firstOfType(board: Board, type: string): BoardNode | undefined {
  return board.nodes.find((n) => n.type === type && !n.ghost);
}

function connect(board: Board, pairs: Array<[string, string]>): Board {
  return pairs.reduce((b, [from, to]) => addEdge(b, from, to).board, board);
}

/**
 * (2) Regular desalination: seawater intake → desal plant → data center, with brine disposal.
 * Reuses whatever the presenter already built.
 */
function addRegularDesal(prev: DemoState): DemoState {
  let board = prev.board;
  const dc = nodeById(board, DEMO_DC_ID);
  const at = (dx: number, dy: number) => freeCellNear(board, (dc?.x ?? 5) + dx, (dc?.y ?? 4) + dy);

  let desal = firstOfType(board, "desal") ?? firstOfType(board, "harmony");
  if (!desal) {
    const placed = addNode(board, "desal", at(-3, 0));
    board = placed.board;
    desal = nodeById(board, placed.id) as BoardNode;
  }
  let sea = firstOfType(board, "seawater");
  if (!sea) {
    const placed = addNode(board, "seawater", at(-5, 1));
    board = placed.board;
    sea = nodeById(board, placed.id) as BoardNode;
  }
  let brine = firstOfType(board, "brine");
  if (!brine) {
    const placed = addNode(board, "brine", at(-3, 2));
    board = placed.board;
    brine = nodeById(board, placed.id) as BoardNode;
  }
  board = connect(board, [
    [sea.id, desal.id],
    [desal.id, brine.id],
    [desal.id, DEMO_DC_ID],
  ]);
  return { ...prev, ...CLEAR, board, focus: [desal.id] };
}

/** (3) Swap every regular desal plant that only serves Tier ≤ 3 users for Harmony. */
function switchToHarmony(prev: DemoState): DemoState {
  const desals = prev.board.nodes.filter((n) => n.type === "desal" && !n.ghost).map((n) => n.id);
  const board: Board = { ...prev.board, nodes: prev.board.nodes.map((n) => (desals.includes(n.id) ? { ...n, type: "harmony", existing: false } : n)) };
  return { ...prev, ...CLEAR, board, focus: desals, impactCallout: true };
}

export const DEMO_STEPS: DemoStep[] = [
  {
    id: "a",
    title: "A data center with no water",
    narration: "A data center campus and no water source, so its cooling is down and every hour costs money. Add a source a drought can't cut. Try it: drop a Desalination plant from the palette, feed it from a Seawater intake, and pipe it to the data center.",
    apply: () => demoStart(),
  },
  {
    id: "b",
    title: "Add a regular desalination plant",
    narration: "Regular desalination gets the data center running. But the plant glows: AquaForge has a better option. Click it to see why.",
    apply: addRegularDesal,
  },
  {
    id: "c",
    title: "Switch to Harmony",
    narration: "Harmony's batch RO only reaches Tier 3, which is all a data center's cooling needs. In exchange it uses less energy, makes less brine and wears membranes less. See what that's worth on the right.",
    apply: switchToHarmony,
  },
  {
    id: "d",
    title: "Check the assumptions",
    narration: "Every number comes from an editable assumption, labeled sourced or illustrative. Harmony and regular desal have separate inputs: change one and the whole dashboard recomputes.",
    apply: (prev) => ({ ...prev, ...CLEAR, focus: [], panel: "assumptions" }),
  },
  {
    id: "e",
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
