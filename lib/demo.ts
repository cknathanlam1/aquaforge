/**
 * Guided demo: the five-step Taiwan Science Park narrative as pure board/settings transforms.
 * The UI animates between steps; tests check the numbers each step produces.
 */

import { addEdge, addNode, nodeById, removeEdge } from "./board";
import type { Board, RuleResult, ScenarioSettings } from "./contract";
import { DEFAULT_SETTINGS } from "./contract";
import { TAIWAN_SCIENCE_PARK } from "./presets";
import { applyRecommendation, checkConnection } from "./rules";

export interface DemoState {
  board: Board;
  settings: ScenarioSettings;
  /** Set on the step where the constraint popup should open. */
  popup: RuleResult | null;
  /** Node ids the UI should highlight. */
  focus: string[];
}

export interface DemoStep {
  id: "a" | "b" | "c" | "d" | "e";
  title: string;
  narration: string;
  apply: (prev: DemoState) => DemoState;
}

export function demoStart(): DemoState {
  return { board: TAIWAN_SCIENCE_PARK, settings: { ...DEFAULT_SETTINGS, scenarioId: "normal" }, popup: null, focus: ["n4"] };
}

function findType(board: Board, type: string): string | undefined {
  return board.nodes.find((n) => n.type === type)?.id;
}

/** (c) Seawater intake → Basic filter, then the user tries filter → fab. */
function tryFilterIntoFab(prev: DemoState): DemoState {
  const fab = findType(prev.board, "fab") as string;
  const sea = addNode(prev.board, "seawater", { x: 0, y: 7 });
  const filter = addNode(sea.board, "filter", { x: 2, y: 7 });
  const board = addEdge(filter.board, sea.id, filter.id).board;
  return { ...prev, board, popup: checkConnection(board, filter.id, fab), focus: [filter.id, fab] };
}

/** (d) Accept Desal + Polishing, then add a recycling loop and a storage tank. */
function addResilience(prev: DemoState): DemoState {
  let board = prev.popup && !prev.popup.valid ? applyRecommendation(prev.board, prev.popup) : prev.board;
  const fab = findType(board, "fab") as string;
  const ro = findType(board, "ro") as string;
  const recycle = addNode(board, "recycle", { x: 3, y: 4 });
  board = addEdge(recycle.board, fab, recycle.id).board;
  board = addEdge(board, recycle.id, ro).board;
  const upw = findType(board, "upw") as string;
  const upwToFab = board.edges.find((e) => e.from === upw && e.to === fab);
  if (upwToFab) {
    const fabNode = nodeById(board, fab);
    const tank = addNode(removeEdge(board, upwToFab.id), "tank", { x: (fabNode?.x ?? 5) + 1, y: (fabNode?.y ?? 4) - 2 });
    board = addEdge(addEdge(tank.board, upw, tank.id).board, tank.id, fab).board;
  }
  return { ...prev, board, popup: null, focus: [recycle.id] };
}

/** (e) A neighbor fab (existing, with its own conventional train) joins the shared recycled loop. */
function addNeighbor(prev: DemoState): DemoState {
  let board = prev.board;
  const municipal = findType(board, "municipal") as string;
  const recycle = findType(board, "recycle") as string;
  const nro = addNode(board, "ro", { x: 9, y: 1 }, { existing: true });
  const nupw = addNode(nro.board, "upw", { x: 11, y: 1 }, { existing: true });
  const nfab = addNode(nupw.board, "neighbor_fab", { x: 11, y: 4 }, { existing: true });
  const recycle2 = addNode(nfab.board, "recycle", { x: 9, y: 5 });
  board = recycle2.board;
  for (const [from, to] of [
    [municipal, nro.id],
    [nro.id, nupw.id],
    [nupw.id, nfab.id],
    [nfab.id, recycle],
    [nfab.id, recycle2.id],
    [recycle, nro.id],
    [recycle2.id, nro.id],
  ] as const) {
    board = addEdge(board, from, to).board;
  }
  return { ...prev, board, focus: [nfab.id, recycle2.id] };
}

export const DEMO_STEPS: DemoStep[] = [
  {
    id: "a",
    title: "Baseline: one fab, normal year",
    narration: "One fab on reservoir water. In a normal year the water bill is small next to the fab's revenue, so nobody acts.",
    apply: () => demoStart(),
  },
  {
    id: "b",
    title: "2021-type drought",
    narration: "Reservoirs run dry and the government cuts industrial supply. The gap is trucked in: this is the cost of doing nothing.",
    apply: (prev) => ({ ...prev, settings: { ...prev.settings, scenarioId: "drought2021" }, popup: null }),
  },
  {
    id: "c",
    title: "Try a basic filter into the fab",
    narration: "Seawater through a basic filter is only Tier 2. The fab needs Tier 5, so the checker recommends Desal + UPW polishing.",
    apply: tryFilterIntoFab,
  },
  {
    id: "d",
    title: "Recycle, desal + polishing, storage",
    narration: "Accept the recommendation, recycle the fab's wastewater back into RO, and add a buffer tank. Watch savings, payback and NPV.",
    apply: addResilience,
  },
  {
    id: "e",
    title: "A neighbor joins the loop",
    narration: "A neighbor fab shares the recycled loop and adds recycling capacity. Savings scale across the park.",
    apply: addNeighbor,
  },
];

/** Run steps a..upTo from scratch. */
export function demoStateAt(stepIndex: number): DemoState {
  let state = demoStart();
  for (let i = 0; i <= Math.min(stepIndex, DEMO_STEPS.length - 1); i++) state = DEMO_STEPS[i].apply(state);
  return state;
}
