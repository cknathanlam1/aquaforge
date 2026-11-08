import { describe, expect, it } from "vitest";
import { ASSUMPTION_KEYS, DEFAULT_ASSUMPTIONS, defaultValues, withOverrides } from "../lib/assumptions";
import { acceptGhosts, activeBoard, addEdge, addNode, moveNode, removeNode } from "../lib/board";
import { PIECE_TYPES } from "../lib/contract";
import { engine } from "../lib/engine";
import { compactNumber, formatM3, formatMoney, formatPct } from "../lib/units";
import { makeBoard, settings } from "./helpers";

describe("engine facade", () => {
  it("exposes a catalog entry for every piece type", () => {
    const catalog = engine.pieceCatalog();
    expect(catalog.map((p) => p.type)).toEqual([...PIECE_TYPES]);
    expect(catalog.find((p) => p.type === "fab")).toMatchObject({ requiredTier: 5, outputTier: null });
    expect(catalog.find((p) => p.type === "desal")).toMatchObject({ outputTier: 4, capexKey: "capex.desal" });
  });

  it("ships six presets, opening on a blank park; the Taiwan boards start with no water", () => {
    const presets = engine.presets();
    expect(presets.map((p) => p.name)).toEqual(["Blank park", "Taiwan industrial park", "Taiwan Science Park fab", "Semiconductor fab", "Data center campus", "Fab + data center"]);
    expect(presets[0].file.board).toEqual({ nodes: [], edges: [] });
    for (const p of presets.slice(1, 3)) {
      expect(p.file.board.edges).toEqual([]);
      expect(engine.evaluateRules(p.file.board).filter((r) => r.severity !== "info").every((r) => r.ruleId === "consumer-offline")).toBe(true);
    }
    for (const p of presets.slice(3)) expect(engine.evaluateRules(p.file.board).filter((r) => r.severity !== "info")).toEqual([]);
  });

  it("compare() works through the facade", () => {
    const board = engine.presets()[2].file.board;
    const c = engine.compare(board, defaultValues(), settings({ scenarioId: "stress2050" }));
    expect(c.metrics.doNothing2050.value).toBeGreaterThan(0);
  });
});

describe("assumptions", () => {
  it("every assumption has a unit, source and status", () => {
    for (const key of ASSUMPTION_KEYS) {
      const a = DEFAULT_ASSUMPTIONS[key];
      expect(a.unit.length, key).toBeGreaterThan(0);
      expect(a.source.length, key).toBeGreaterThan(0);
      expect(["sourced", "illustrative"]).toContain(a.status);
    }
  });

  it("overrides apply only to known keys with finite numbers", () => {
    const v = withOverrides({ "price.municipal": 0.5, "not.a.key": 9, "price.discharge": Number.NaN });
    expect(v["price.municipal"]).toBe(0.5);
    expect(v["price.discharge"]).toBe(DEFAULT_ASSUMPTIONS["price.discharge"].value);
    expect("not.a.key" in v).toBe(false);
  });
});

describe("board operations are immutable", () => {
  it("add, connect, move, remove", () => {
    const start = makeBoard([["m", "municipal"]], []);
    const { board: b1, id } = addNode(start, "office", { x: 0, y: 0 });
    expect(start.nodes).toHaveLength(1);
    expect(b1.nodes.find((n) => n.id === id)).toMatchObject({ x: 0, y: 1 }); // (0,0) was taken
    const { board: b2 } = addEdge(b1, "m", id);
    expect(addEdge(b2, "m", id).board).toBe(b2); // no duplicate pipe
    expect(moveNode(b2, id, 3, 3).nodes.find((n) => n.id === id)).toMatchObject({ x: 3, y: 3 });
    expect(removeNode(b2, id).edges).toHaveLength(0);
  });

  it("ghosts are invisible to the engine until accepted", () => {
    const { board } = addNode(makeBoard([["m", "municipal"]], []), "recycle", { x: 2, y: 2 }, { ghost: true });
    expect(activeBoard(board).nodes).toHaveLength(1);
    expect(activeBoard(acceptGhosts(board)).nodes).toHaveLength(2);
  });
});

describe("formatting", () => {
  it("formats money in USD and NT$", () => {
    expect(formatMoney(3_660_000, "USD", 32)).toBe("$3.7M");
    expect(formatMoney(-1_000_000, "TWD", 32)).toBe("-NT$32.0M");
    expect(formatMoney(Number.NaN, "USD", 32)).toBe("n/a");
  });

  it("formats volumes, percentages and compact numbers", () => {
    expect(formatM3(28070.2)).toBe("28,070 m³");
    expect(formatPct(0.356)).toBe("36%");
    expect(compactNumber(950)).toBe("950");
    expect(compactNumber(2.5)).toBe("2.50");
  });
});
