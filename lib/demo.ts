/**
 * Guided demo: the five-step Taiwan Science Park narrative as pure board/settings transforms.
 *   1. Find the weak points (2021-type drought on the one-fab baseline)
 *   2. Try something that doesn't work: a river intake piped straight into the fab
 *   3. Swap in a replacement that does: seawater desalination + ultrapure polishing
 *   4. Show the assumptions and settings behind every number
 *   5. Let the AI advisor recommend improvements
 * The UI animates between steps and opens the panel each step names; tests check the numbers.
 */

import { addNode, nodeById } from "./board";
import type { Board, RuleResult, ScenarioSettings } from "./contract";
import { DEFAULT_SETTINGS } from "./contract";
import { TAIWAN_SCIENCE_PARK } from "./presets";
import { applyRecommendation, checkConnection } from "./rules";

export type DemoPanel = "impact" | "assumptions" | "advisor";

export interface DemoState {
  board: Board;
  settings: ScenarioSettings;
  /** Set on the step where the constraint popup should open. */
  popup: RuleResult | null;
  /** Node ids the UI should highlight. */
  focus: string[];
  /** Which right/side panel the step should show. */
  panel: DemoPanel;
  /** Bottom mode toggle. */
  mode: "build" | "advisor";
  /** Step 1: show the engine's weak-points list (engine.weakPoints). */
  showWeakPoints: boolean;
  /** Step 5: run engine.advise() on entry. */
  runAdvisor: boolean;
}

export interface DemoStep {
  id: "a" | "b" | "c" | "d" | "e";
  title: string;
  narration: string;
  apply: (prev: DemoState) => DemoState;
}

const FAB = "n4";
const MUNICIPAL = "n1";

export function demoStart(): DemoState {
  return {
    board: TAIWAN_SCIENCE_PARK,
    settings: { ...DEFAULT_SETTINGS, scenarioId: "drought2021" },
    popup: null,
    focus: [MUNICIPAL, FAB],
    panel: "impact",
    mode: "build",
    showWeakPoints: true,
    runAdvisor: false,
  };
}

const RESET_FLAGS = { popup: null, showWeakPoints: false, runAdvisor: false, panel: "impact" as DemoPanel, mode: "build" as const };

/** (2) A river intake piped straight into the fab: raw Tier 1 water into a Tier 5 consumer. */
function tryRiverIntoFab(prev: DemoState): DemoState {
  const fab = nodeById(prev.board, FAB);
  const river = addNode(prev.board, "river", { x: (fab?.x ?? 5) - 4, y: (fab?.y ?? 4) + 2 });
  return {
    ...prev,
    ...RESET_FLAGS,
    board: river.board,
    popup: checkConnection(river.board, river.id, FAB),
    focus: [river.id, FAB],
  };
}

/**
 * (3) Accept the recommendation (Desal + Polishing, with brine disposal), and feed the desal
 * plant from the sea instead of the river so the new supply is drought-proof.
 */
function swapInDesal(prev: DemoState): DemoState {
  const withChain = prev.popup && !prev.popup.valid ? applyRecommendation(prev.board, prev.popup) : prev.board;
  const riverId = withChain.nodes.find((n) => n.type === "river")?.id;
  const board: Board = { ...withChain, nodes: withChain.nodes.map((n) => (n.id === riverId ? { ...n, type: "seawater" } : n)) };
  const added = board.nodes.filter((n) => !TAIWAN_SCIENCE_PARK.nodes.some((b) => b.id === n.id)).map((n) => n.id);
  return { ...prev, ...RESET_FLAGS, board, focus: added };
}

export const DEMO_STEPS: DemoStep[] = [
  {
    id: "a",
    title: "Find the weak points",
    narration: "One fab, one reservoir, a 2021-type drought. The engine flags what breaks first and what each weakness costs a year.",
    apply: () => demoStart(),
  },
  {
    id: "b",
    title: "Try something that doesn't work",
    narration: "A river intake joins the board, glowing red. Click it to pipe it straight into the fab: raw river water is Tier 1, chips need Tier 5, so the checker stops you and explains why.",
    apply: tryRiverIntoFab,
  },
  {
    id: "c",
    title: "Swap in desalination",
    narration: "Take the recommendation: a desalination plant (fed from the sea, so a drought can't cut it), ultrapure polishing, and brine disposal. Watch the drought cost and payback.",
    apply: swapInDesal,
  },
  {
    id: "d",
    title: "Check the assumptions",
    narration: "Every number comes from an editable assumption, labeled sourced or illustrative. Change one, or flip a scenario setting, and the whole dashboard recomputes.",
    apply: (prev) => ({ ...prev, ...RESET_FLAGS, focus: [], panel: "assumptions" }),
  },
  {
    id: "e",
    title: "Ask the AI advisor",
    narration: "The advisor tries the additions that could help, drops any that break a rule, and ranks the rest by risk-adjusted NPV.",
    apply: (prev) => ({ ...prev, ...RESET_FLAGS, focus: [], panel: "advisor", mode: "advisor", runAdvisor: true }),
  },
];

/** Run steps a..upTo from scratch. */
export function demoStateAt(stepIndex: number): DemoState {
  let state = demoStart();
  for (let i = 0; i <= Math.min(stepIndex, DEMO_STEPS.length - 1); i++) state = DEMO_STEPS[i].apply(state);
  return state;
}
