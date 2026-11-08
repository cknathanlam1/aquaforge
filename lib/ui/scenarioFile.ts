/** ScenarioFile validation, JSON import/export and compressed URL-hash sharing. */
import { ASSUMPTION_KEYS, type AssumptionKey } from "@/lib/assumptions";
import { DEFAULT_SETTINGS, PIECE_TYPES, SCENARIO_LABELS, type BoardEdge, type BoardNode, type PieceType, type ScenarioFile, type ScenarioId } from "@/lib/contract";

const MAX_NODES = 200;
const MAX_EDGES = 400;
const MAX_COORD = 64;
const HASH_KEY = "s=";

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isInt = (x: unknown): x is number => typeof x === "number" && Number.isInteger(x);

export type ParseResult = { ok: true; file: ScenarioFile } | { ok: false; error: string };

export function parseScenarioFile(raw: unknown): ParseResult {
  if (!isObj(raw)) return { ok: false, error: "Not a scenario object." };
  if (raw.version !== 1) return { ok: false, error: "Unsupported scenario version (expected 1)." };
  const board = raw.board;
  if (!isObj(board) || !Array.isArray(board.nodes) || !Array.isArray(board.edges)) return { ok: false, error: "Missing board.nodes / board.edges." };
  if (board.nodes.length > MAX_NODES || board.edges.length > MAX_EDGES) return { ok: false, error: "Board is too large." };

  const nodes: BoardNode[] = [];
  for (const n of board.nodes) {
    if (!isObj(n) || typeof n.id !== "string" || !PIECE_TYPES.includes(n.type as PieceType)) return { ok: false, error: "Invalid board node." };
    if (!isInt(n.x) || !isInt(n.y) || n.x < 0 || n.y < 0 || n.x >= MAX_COORD || n.y >= MAX_COORD) return { ok: false, error: `Node ${n.id} has invalid coordinates.` };
    nodes.push({ id: n.id.slice(0, 40), type: n.type as PieceType, x: n.x, y: n.y, existing: n.existing === true });
  }
  const ids = new Set(nodes.map((n) => n.id));
  const edges: BoardEdge[] = [];
  for (const e of board.edges) {
    if (!isObj(e) || typeof e.id !== "string" || typeof e.from !== "string" || typeof e.to !== "string") return { ok: false, error: "Invalid board edge." };
    if (!ids.has(e.from) || !ids.has(e.to)) return { ok: false, error: `Edge ${e.id} points at a missing node.` };
    edges.push({ id: e.id.slice(0, 40), from: e.from, to: e.to });
  }

  const s = isObj(raw.settings) ? raw.settings : {};
  const scenarioId = (Object.keys(SCENARIO_LABELS) as ScenarioId[]).includes(s.scenarioId as ScenarioId) ? (s.scenarioId as ScenarioId) : DEFAULT_SETTINGS.scenarioId;
  const bool = (x: unknown, d: boolean) => (typeof x === "boolean" ? x : d);
  const settings = {
    scenarioId,
    cutLevel: s.cutLevel === "escalated" ? ("escalated" as const) : ("initial" as const),
    truckingEnabled: bool(s.truckingEnabled, DEFAULT_SETTINGS.truckingEnabled),
    surchargeEnabled: bool(s.surchargeEnabled, DEFAULT_SETTINGS.surchargeEnabled),
    couplingEnabled: bool(s.couplingEnabled, DEFAULT_SETTINGS.couplingEnabled),
  };

  const overrides: Partial<Record<AssumptionKey, number>> = {};
  if (isObj(raw.assumptionOverrides)) {
    for (const key of ASSUMPTION_KEYS) {
      const v = raw.assumptionOverrides[key];
      if (typeof v === "number" && Number.isFinite(v)) overrides[key] = v;
    }
  }
  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.slice(0, 80) : "Imported scenario";
  return { ok: true, file: { version: 1, name, board: { nodes, edges }, settings, assumptionOverrides: overrides } };
}

export function downloadScenario(file: ScenarioFile): void {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${file.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "scenario"}.aquaforge.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readScenarioUpload(f: File): Promise<ParseResult> {
  if (f.size > 1_000_000) return { ok: false, error: "File is larger than 1 MB." };
  try {
    return parseScenarioFile(JSON.parse(await f.text()));
  } catch {
    return { ok: false, error: "That file isn’t valid JSON." };
  }
}

// ---------- URL hash (deflate-raw + base64url, with a plain fallback) ----------

const toB64Url = (bytes: Uint8Array) => {
  let s = "";
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64Url = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function pipeBytes(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeScenarioHash(file: ScenarioFile): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(file));
  if (typeof CompressionStream === "undefined") return `${HASH_KEY}j.${toB64Url(json)}`;
  return `${HASH_KEY}z.${toB64Url(await pipeBytes(json, new CompressionStream("deflate-raw")))}`;
}

export async function decodeScenarioHash(hash: string): Promise<ParseResult | null> {
  const h = hash.replace(/^#/, "");
  if (!h.startsWith(HASH_KEY)) return null;
  const body = h.slice(HASH_KEY.length);
  try {
    const kind = body.slice(0, 2);
    const bytes = fromB64Url(body.slice(2));
    if (bytes.length > 200_000) return { ok: false, error: "Shared link is too large." };
    const raw = kind === "z." ? await pipeBytes(bytes, new DecompressionStream("deflate-raw")) : bytes;
    return parseScenarioFile(JSON.parse(new TextDecoder().decode(raw)));
  } catch {
    return { ok: false, error: "That shared link is damaged." };
  }
}
