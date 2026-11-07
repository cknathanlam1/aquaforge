"use client";
/** UI state for Nature. Engine calls go through lib/ui/engine.ts; all updates are immutable. */
import { create } from "zustand";
import { withOverrides, type AssumptionKey } from "@/lib/assumptions";
import {
  DEFAULT_SETTINGS, type AdviseRequest, type AdviseResponse, type AdvisorResult, type Board, type Metric,
  type PieceType, type RuleResult, type ScenarioFile, type ScenarioId, type ScenarioSettings,
} from "@/lib/contract";
import { buildDemoState, DEMO_STEPS, type MetricKey } from "@/lib/ui/demo";
import { engine } from "@/lib/ui/engine";
import type { Currency } from "@/lib/ui/format";
import { addEdge, addNode, boardSizeFor, hasEdge, MAX_BOARD_SIZE, mergeNewPieces } from "@/lib/ui/placement";

export type Tool = "select" | "pipe" | "delete";
export type Mode = "build" | "advisor";
export type RightTab = "impact" | "rules";
type Toggle = "truckingEnabled" | "surchargeEnabled" | "couplingEnabled";

const FLASH_MS = 1600;
const SHAKE_MS = 800;
const BAD_PIPE_MS = 6000;
const TOAST_MS = 3200;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 3;

export interface ShowWorkState { title: string; metrics: Metric[] }
export interface Toast { text: string; kind: "info" | "error" }

export interface NatureState {
  presetId: string;
  scenarioName: string;
  board: Board;
  boardSize: number;
  settings: ScenarioSettings;
  overrides: Partial<Record<AssumptionKey, number>>;
  currency: Currency;
  doNothing2050: boolean;

  mode: Mode;
  tool: Tool;
  selected: string | null;
  pending: string | null;
  popup: RuleResult | null;
  popupWhy: boolean;
  badPipe: { from: string; to: string } | null;
  shakeId: string | null;
  flash: string[];

  rightTab: RightTab;
  detailKey: MetricKey | null;
  showWork: ShowWorkState | null;
  drawerOpen: boolean;
  drawerFocus: AssumptionKey | null;
  leftOpen: boolean;
  zoom: number;
  pan: { x: number; y: number };
  playing: boolean;

  advisor: AdvisorResult | null;
  acceptedCards: string[];
  previewCard: string | null;
  question: string;
  answer: { text: string; source: AdviseResponse["source"] } | null;
  asking: boolean;

  demoStep: number | null;
  /** Node ids the current demo step wants highlighted. */
  demoFocus: string[];
  /** Guided step 1: show engine.weakPoints() on the board and in the narration card. */
  showWeakPoints: boolean;
  guided: boolean;
  /** The preset or imported file the board was last loaded from (what Reset returns to). */
  baseFile: ScenarioFile;
  toast: Toast | null;
}

export interface NatureActions {
  loadPreset: (id: string) => void;
  loadFile: (file: ScenarioFile) => void;
  toScenarioFile: () => ScenarioFile;
  setScenario: (id: ScenarioId) => void;
  setCutLevel: (level: ScenarioSettings["cutLevel"]) => void;
  toggleSetting: (key: Toggle) => void;
  setCurrency: (c: Currency) => void;
  setDoNothing2050: (on: boolean) => void;
  setOverride: (key: AssumptionKey, value: number | null) => void;
  resetOverrides: () => void;

  setMode: (m: Mode) => void;
  setTool: (t: Tool) => void;
  select: (id: string | null) => void;
  addPiece: (type: PieceType, cell?: readonly [number, number]) => void;
  movePiece: (id: string, x: number, y: number) => void;
  removePiece: (id: string) => void;
  clickPiece: (id: string) => void;
  connect: (from: string, to: string) => void;
  closePopup: () => void;
  togglePopupWhy: () => void;
  acceptRecommendation: () => void;

  setRightTab: (t: RightTab) => void;
  openDetail: (k: MetricKey | null) => void;
  openShowWork: (title: string, metrics: Metric[]) => void;
  closeShowWork: () => void;
  openDrawer: (focus?: AssumptionKey) => void;
  closeDrawer: () => void;
  toggleLeft: () => void;
  setZoom: (z: number) => void;
  setPan: (p: { x: number; y: number }) => void;
  resetView: () => void;
  togglePlay: () => void;
  setBoardSize: (n: number) => void;
  resetBoard: () => void;

  runAdvisor: () => void;
  acceptCard: (id: string) => void;
  acceptAll: () => void;
  setPreviewCard: (id: string | null) => void;
  setQuestion: (q: string) => void;
  ask: () => Promise<void>;

  goToStep: (n: number) => void;
  startGuided: () => void;
  exitGuided: () => void;
  notify: (text: string, kind?: Toast["kind"]) => void;
}

export type NatureStore = NatureState & NatureActions;

const timers = new Map<string, ReturnType<typeof setTimeout>>();
function later(key: string, ms: number, fn: () => void): void {
  const prev = timers.get(key);
  if (prev) clearTimeout(prev);
  timers.set(key, setTimeout(() => { timers.delete(key); fn(); }, ms));
}

const firstPreset = engine.presets()[0];

const noDemo = { demoStep: null, demoFocus: [] as string[], showWeakPoints: false, guided: false };

const transient = {
  selected: null, pending: null, popup: null, popupWhy: false, badPipe: null, shakeId: null, flash: [] as string[],
  advisor: null, acceptedCards: [] as string[], previewCard: null, answer: null, detailKey: null,
};

export const useNature = create<NatureStore>()((set, get) => {
  const flash = (ids: string[]) => {
    set({ flash: ids });
    later("flash", FLASH_MS, () => set({ flash: [] }));
  };
  const setBoard = (board: Board, extra: Partial<NatureState> = {}) =>
    set((s) => ({ board, boardSize: Math.max(s.boardSize, boardSizeFor(board)), ...extra }));
  const values = () => withOverrides(get().overrides);

  return {
    presetId: firstPreset.id,
    scenarioName: firstPreset.name,
    board: firstPreset.file.board,
    boardSize: boardSizeFor(firstPreset.file.board),
    settings: { ...firstPreset.file.settings },
    overrides: {},
    currency: "USD",
    doNothing2050: false,
    mode: "build",
    tool: "select",
    rightTab: "impact",
    showWork: null,
    drawerOpen: false,
    drawerFocus: null,
    leftOpen: true,
    zoom: 1,
    pan: { x: 0, y: 0 },
    playing: true,
    question: "",
    asking: false,
    ...noDemo,
    baseFile: firstPreset.file,
    toast: null,
    ...transient,

    loadPreset: (id) => {
      const p = engine.presets().find((x) => x.id === id);
      if (!p) return;
      get().loadFile(p.file);
      set({ presetId: p.id, scenarioName: p.name });
    },
    loadFile: (file) =>
      set({
        ...transient,
        presetId: "custom",
        scenarioName: file.name,
        board: file.board,
        boardSize: boardSizeFor(file.board),
        settings: { ...file.settings },
        overrides: { ...file.assumptionOverrides },
        baseFile: file,
        ...noDemo,
      }),
    toScenarioFile: () => {
      const s = get();
      const board = { nodes: s.board.nodes.filter((n) => !n.ghost), edges: s.board.edges };
      return { version: 1, name: s.scenarioName, board, settings: s.settings, assumptionOverrides: s.overrides };
    },
    setScenario: (scenarioId) => set((s) => ({ settings: { ...s.settings, scenarioId }, advisor: null })),
    setCutLevel: (cutLevel) => set((s) => ({ settings: { ...s.settings, cutLevel }, advisor: null })),
    toggleSetting: (key) => set((s) => ({ settings: { ...s.settings, [key]: !s.settings[key] }, advisor: null })),
    setCurrency: (currency) => set({ currency }),
    setDoNothing2050: (doNothing2050) => set({ doNothing2050 }),
    setOverride: (key, value) =>
      set((s) => {
        const { [key]: _drop, ...rest } = s.overrides;
        void _drop;
        return { overrides: value === null ? rest : { ...rest, [key]: value }, advisor: null };
      }),
    resetOverrides: () => set({ overrides: {}, advisor: null }),

    setMode: (mode) => set({ mode, leftOpen: true }),
    setTool: (tool) => set({ tool, pending: null }),
    select: (selected) => set({ selected }),
    addPiece: (type, cell) => {
      const s = get();
      const res = addNode(s.board, type, s.boardSize, cell);
      setBoard(res.board, { selected: res.id, advisor: null });
    },
    movePiece: (id, x, y) => {
      const s = get();
      if (x < 0 || y < 0 || x >= s.boardSize || y >= s.boardSize) return;
      if (s.board.nodes.some((n) => n.id !== id && n.x === x && n.y === y)) return;
      set({ board: { ...s.board, nodes: s.board.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)) } });
    },
    removePiece: (id) => {
      const s = get();
      set({
        board: { nodes: s.board.nodes.filter((n) => n.id !== id), edges: s.board.edges.filter((e) => e.from !== id && e.to !== id) },
        selected: s.selected === id ? null : s.selected,
        pending: null,
        advisor: null,
      });
    },
    clickPiece: (id) => {
      const s = get();
      const node = s.board.nodes.find((n) => n.id === id);
      if (!node) return;
      if (s.tool === "delete") return get().removePiece(id);
      if (s.tool === "pipe") {
        if (s.pending && s.pending !== id) return get().connect(s.pending, id);
        return set({ pending: s.pending === id ? null : id });
      }
      set({ selected: s.selected === id ? null : id });
    },
    connect: (from, to) => {
      const s = get();
      if (from === to || hasEdge(s.board, from, to)) return set({ pending: null });
      const result = engine.checkConnection(s.board, from, to);
      if (result.valid) {
        const res = addEdge(s.board, from, to);
        set({ board: res.board, pending: null, selected: null, advisor: null });
        flash([res.id]);
        return;
      }
      set({ pending: null, popup: result, popupWhy: false, badPipe: { from, to }, shakeId: to });
      later("shake", SHAKE_MS, () => set({ shakeId: null }));
      later("bad", BAD_PIPE_MS, () => set({ badPipe: null }));
    },
    closePopup: () => set({ popup: null, popupWhy: false, badPipe: null }),
    togglePopupWhy: () => set((s) => ({ popupWhy: !s.popupWhy })),
    acceptRecommendation: () => {
      const s = get();
      if (!s.popup) return;
      if (s.guided && s.demoStep === 1) return get().goToStep(2);
      const before = new Set(s.board.edges.map((e) => e.id));
      const board = engine.applyRecommendation(s.board, s.popup);
      setBoard(board, { popup: null, popupWhy: false, badPipe: null, mode: "build", advisor: null });
      flash(board.edges.filter((e) => !before.has(e.id)).map((e) => e.id));
    },

    setRightTab: (rightTab) => set({ rightTab, detailKey: null }),
    openDetail: (detailKey) => set({ detailKey, rightTab: "impact" }),
    openShowWork: (title, metrics) => set({ showWork: { title, metrics } }),
    closeShowWork: () => set({ showWork: null }),
    openDrawer: (focus) => set({ drawerOpen: true, drawerFocus: focus ?? null, showWork: null }),
    closeDrawer: () => set({ drawerOpen: false, drawerFocus: null }),
    toggleLeft: () => set((s) => ({ leftOpen: !s.leftOpen })),
    setZoom: (z) => set({ zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)) }),
    setPan: (pan) => set({ pan }),
    resetView: () => set({ zoom: 1, pan: { x: 0, y: 0 } }),
    togglePlay: () => set((s) => ({ playing: !s.playing })),
    setBoardSize: (n) => {
      const size = Math.max(boardSizeFor(get().board), Math.min(MAX_BOARD_SIZE, n));
      set({ boardSize: size });
    },
    /** Back to the loaded preset/file with default scenario settings; keeps assumption overrides. */
    resetBoard: () => {
      const s = get();
      set({
        ...transient,
        ...noDemo,
        board: s.baseFile.board,
        boardSize: boardSizeFor(s.baseFile.board),
        settings: { ...DEFAULT_SETTINGS },
        mode: "build",
        tool: "select",
        rightTab: "impact",
        showWork: null,
        drawerOpen: false,
        drawerFocus: null,
        doNothing2050: false,
        question: "",
        zoom: 1,
        pan: { x: 0, y: 0 },
      });
      get().notify("Board reset. Assumption edits kept (Assumptions → Reset all clears them).");
    },

    runAdvisor: () => {
      const s = get();
      set({ advisor: engine.advise(s.board, values(), s.settings), acceptedCards: [], previewCard: null, mode: "advisor" });
    },
    acceptCard: (id) => {
      const s = get();
      const card = id === "plan" ? s.advisor?.plan : s.advisor?.cards.find((c) => c.id === id);
      if (!card) return;
      const res = mergeNewPieces(s.board, card.board, engine.checkConnection);
      setBoard(res.board, { acceptedCards: [...s.acceptedCards, id], previewCard: null });
      flash(res.edgeIds);
    },
    acceptAll: () => {
      const s = get();
      const plan = s.advisor?.plan;
      if (!plan) return;
      get().acceptCard("plan");
      set((st) => ({ acceptedCards: [...st.acceptedCards, ...(st.advisor?.cards.filter((c) => c.pieces.every((t) => plan.pieces.includes(t))).map((c) => c.id) ?? [])] }));
    },
    setPreviewCard: (previewCard) => set({ previewCard }),
    setQuestion: (question) => set({ question }),
    ask: async () => {
      const s = get();
      const question = s.question.trim().slice(0, 500);
      if (!question || s.asking) return;
      const v = values();
      const comparison = engine.compare(s.board, v, s.settings);
      const advisor = s.advisor ?? engine.advise(s.board, v, s.settings);
      const body: AdviseRequest = { question, board: s.board, settings: s.settings, comparison: { metrics: comparison.metrics, rules: comparison.rules }, advisor };
      set({ asking: true, answer: null, advisor });
      try {
        const res = await fetch("/api/advise", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(`Advisor API returned ${res.status}`);
        const data = (await res.json()) as AdviseResponse;
        if (!data.success) throw new Error(data.error ?? "The advisor couldn’t answer.");
        set({ answer: { text: data.answer, source: data.source } });
      } catch (err: unknown) {
        get().notify(err instanceof Error ? err.message : "The advisor is unavailable.", "error");
      } finally {
        set({ asking: false });
      }
    },

    goToStep: (n) => {
      const step = Math.max(0, Math.min(DEMO_STEPS.length - 1, n));
      const d = buildDemoState(step);
      set({
        ...transient,
        presetId: firstPreset.id,
        scenarioName: firstPreset.name,
        baseFile: firstPreset.file,
        board: d.board,
        boardSize: boardSizeFor(d.board),
        settings: d.settings,
        overrides: {},
        mode: d.mode,
        leftOpen: true,
        tool: "select",
        rightTab: "impact",
        popup: d.popup,
        popupWhy: false,
        badPipe: d.popup?.from && d.popup.to ? { from: d.popup.from, to: d.popup.to } : null,
        shakeId: d.popup?.to ?? null,
        demoStep: step,
        demoFocus: d.focus,
        showWeakPoints: d.showWeakPoints,
        doNothing2050: false,
        showWork: null,
        drawerOpen: d.panel === "assumptions",
        drawerFocus: null,
      });
      if (d.popup) later("shake", SHAKE_MS, () => set({ shakeId: null }));
      // advise() is heavy: run it once, on entering the step that asks for it.
      if (d.runAdvisor) get().runAdvisor();
    },
    startGuided: () => {
      set({ guided: true });
      get().goToStep(0);
      set({ guided: true });
    },
    exitGuided: () => set({ ...noDemo, drawerOpen: false }),
    notify: (text, kind = "info") => {
      set({ toast: { text, kind } });
      later("toast", TOAST_MS, () => set({ toast: null }));
    },
  };
});

export { DEFAULT_SETTINGS };
