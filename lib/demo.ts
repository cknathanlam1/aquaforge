/**
 * Guided demo: the Taiwan Science Park narrative as pure board/settings transforms.
 *   1. A fab with no water: the engine flags it and recommends adding a source
 *   2. Try a river intake piped into the fab: the pipe glows red; clicking it explains why
 *   3. Swap in seawater desalination + ultrapure polishing: impact callout on the dashboard
 *   4. Recycle the wastewater: new pipes that drive savings
 *   5. Show the assumptions and settings behind every number
 *   6. Let the AI advisor recommend improvements
 *
 * Steps apply to the CURRENT state, so a presenter who builds the river pipe by hand in step 1
 * keeps that board in steps 2 and 3. demoStateAt(i) replays from scratch (jumping, tests).
 */

import { addEdge, addNode, freeCellNear, nodeById, removeNode } from "./board";
import type { Board, BoardNode, RuleResult, ScenarioSettings } from "./contract";
import { DEFAULT_SETTINGS } from "./contract";
import { TAIWAN_SCIENCE_PARK } from "./presets";
import { applyRecommendation, evaluateRules } from "./rules";

export type DemoPanel = "impact" | "assumptions" | "advisor";

export interface DemoState {
  board: Board;
  settings: ScenarioSettings;
  /**
   * The constraint result the step is about (step 2: the river → fab tier violation). The UI
   * does NOT open it automatically: the offending pipe glows red and clicking it opens the popup.
   */
  popup: RuleResult | null;
  /** Node ids the UI should highlight. */
  focus: string[];
  /** Which right/side panel the step should show. */
  panel: DemoPanel;
  /** Bottom mode toggle. */
  mode: "build" | "advisor";
  /** Step 1: show the engine's weak-points list (engine.weakPoints). */
  showWeakPoints: boolean;
  /** Steps 3-4: show a callout on the Impact panel summarizing what just changed. */
  impactCallout: boolean;
  /** Step 6: run engine.advise() on entry. */
  runAdvisor: boolean;
}

export type DemoStepId = "a" | "b" | "c" | "d" | "e" | "f";

export interface DemoStep {
  id: DemoStepId;
  title: string;
  narration: string;
  apply: (prev: DemoState) => DemoState;
}

/** The fab's id on the Taiwan Science Park board. */
export const DEMO_FAB_ID = "n1";

export function demoStart(): DemoState {
  return {
    board: TAIWAN_SCIENCE_PARK,
    settings: { ...DEFAULT_SETTINGS, scenarioId: "drought2021" },
    popup: null,
    focus: [DEMO_FAB_ID],
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

/** The tier violation on a pipe into the fab, if any. */
function fabTierViolation(board: Board): RuleResult | null {
  return evaluateRules(board).find((r) => r.ruleId === "tier-requirement" && r.to === DEMO_FAB_ID) ?? null;
}

/** (2) A river intake piped straight into the fab. Reuses the presenter's own river and pipe if they built one. */
function tryRiverIntoFab(prev: DemoState): DemoState {
  let board = prev.board;
  let river = firstOfType(board, "river");
  if (!river) {
    const fab = nodeById(board, DEMO_FAB_ID);
    const placed = addNode(board, "river", freeCellNear(board, (fab?.x ?? 5) - 4, (fab?.y ?? 4) + 1));
    board = placed.board;
    river = nodeById(board, placed.id) as BoardNode;
  }
  if (!board.edges.some((e) => e.from === river.id && e.to === DEMO_FAB_ID)) board = addEdge(board, river.id, DEMO_FAB_ID).board;
  return { ...prev, ...CLEAR, board, popup: fabTierViolation(board), focus: [river.id, DEMO_FAB_ID] };
}

/**
 * (3) Accept the recommendation (Desal + Polishing, with brine disposal), and feed the desal
 * plant from the sea instead of the river so the new supply is drought-proof.
 */
function swapInDesal(prev: DemoState): DemoState {
  const violation = fabTierViolation(prev.board) ?? prev.popup;
  const withChain = violation && !violation.valid ? applyRecommendation(prev.board, violation) : prev.board;
  const riverId = firstOfType(withChain, "river")?.id;
  let board: Board = { ...withChain, nodes: withChain.nodes.map((n) => (n.id === riverId ? { ...n, type: "seawater" } : n)) };
  board = addSecondDesalUnit(board, riverId);
  const before = new Set(prev.board.nodes.map((n) => n.id));
  const focus = board.nodes.filter((n) => !before.has(n.id) || n.id === riverId).map((n) => n.id);
  return { ...prev, ...CLEAR, board, focus, impactCallout: true };
}

/**
 * One desal plant the size of Hsinchu's (13,000 m³/day, sourced) covers only about 60% of a
 * 20,000 m³/day fab after polishing losses, so the demo adds a second, parallel unit.
 */
function addSecondDesalUnit(board: Board, intakeId: string | undefined): Board {
  const desals = board.nodes.filter((n) => n.type === "desal" && !n.ghost);
  const polish = firstOfType(board, "polish") ?? firstOfType(board, "upw");
  const brine = firstOfType(board, "brine");
  if (!intakeId || desals.length !== 1 || !polish) return board;
  const first = desals[0];
  const second = addNode(board, "desal", freeCellNear(board, first.x, first.y + 1));
  const pipes: Array<[string, string]> = [[intakeId, second.id], [second.id, polish.id]];
  if (brine) pipes.push([second.id, brine.id]);
  return pipes.reduce((b, [from, to]) => addEdge(b, from, to).board, second.board);
}

/**
 * (4) Pipe the fab's wastewater through a recycling loop and an RO unit back into polishing.
 * Recycled water covers what the second desal unit was making, so that unit is retired.
 */
function recycleWastewater(prev: DemoState): DemoState {
  let board = prev.board;
  const desals = board.nodes.filter((n) => n.type === "desal" && !n.ghost && !n.existing);
  if (desals.length > 1) board = removeNode(board, desals[desals.length - 1].id);
  const fab = nodeById(board, DEMO_FAB_ID);
  const polish = firstOfType(board, "polish") ?? firstOfType(board, "upw");
  if (!fab || !polish || firstOfType(board, "recycle")) return { ...prev, ...CLEAR, impactCallout: true };
  const recycle = addNode(board, "recycle", freeCellNear(board, fab.x + 2, fab.y + 1));
  const ro = addNode(recycle.board, "ro", freeCellNear(recycle.board, fab.x + 2, fab.y - 1));
  board = [
    [DEMO_FAB_ID, recycle.id],
    [recycle.id, ro.id],
    [ro.id, polish.id],
  ].reduce((b, [from, to]) => addEdge(b, from, to).board, ro.board);
  return { ...prev, ...CLEAR, board, focus: [recycle.id, ro.id], impactCallout: true };
}

export const DEMO_STEPS: DemoStep[] = [
  {
    id: "a",
    title: "A fab with no water",
    narration: "One semiconductor fab and no water source, so it's offline and every hour costs production. Add a source to get it running, ideally one a drought can't cut. Try it: drop a River intake from the palette and pipe it to the fab.",
    apply: () => demoStart(),
  },
  {
    id: "b",
    title: "Try a river intake",
    narration: "The river is piped in, but the pipe glows red. Click the river to see why.",
    apply: tryRiverIntoFab,
  },
  {
    id: "c",
    title: "Swap in desalination",
    narration: "Take the recommendation: desalination fed from the sea (a drought can't cut it), ultrapure polishing, and brine disposal. One Hsinchu-size plant makes 13,000 m³/day and the fab needs about 21,000, so it takes two units. The fab is back online; see what it's worth on the right.",
    apply: swapInDesal,
  },
  {
    id: "d",
    title: "Recycle the wastewater",
    narration: "Pipe the fab's wastewater through a recycling loop and RO back into polishing. It recycles about 11,000 m³/day, so one desal unit is enough: the second one is retired. Same water, less capex, lower running cost.",
    apply: recycleWastewater,
  },
  {
    id: "e",
    title: "Check the assumptions",
    narration: "Every number comes from an editable assumption, labeled sourced or illustrative. Change one, or flip a scenario setting, and the whole dashboard recomputes.",
    apply: (prev) => ({ ...prev, ...CLEAR, focus: [], panel: "assumptions" }),
  },
  {
    id: "f",
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
