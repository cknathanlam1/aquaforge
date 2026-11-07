import { describe, expect, it } from "vitest";
import { applyRecommendation, checkConnection, evaluateRules } from "../lib/rules";
import { makeBoard } from "./helpers";

describe("tier rules", () => {
  it("rejects a Basic filter feeding a UPW plant and recommends Desal + Polishing", () => {
    const board = makeBoard([["src", "river"], ["f", "filter"], ["upw", "upw"]], [["src", "f"]]);

    const result = checkConnection(board, "f", "upw");

    expect(result.valid).toBe(false);
    expect(result.severity).toBe("error");
    expect(result.recommendedPieces).toEqual(["desal", "polish"]);
    expect(result.reasonText).toMatch(/Tier 4/);
    // The UPW plant itself polishes, so only Desal is actually missing.
    expect(result.tierChain.filter((s) => s.status === "missing").map((s) => s.pieceType)).toEqual(["desal"]);
    expect(result.tierChain.at(-1)).toMatchObject({ pieceType: "upw", status: "target", tier: 4 });
  });

  it("rejects a Basic filter feeding a fab and recommends Desal + Polishing (both missing)", () => {
    const board = makeBoard([["sea", "seawater"], ["f", "filter"], ["fab", "fab"]], [["sea", "f"]]);

    const result = checkConnection(board, "f", "fab");

    expect(result.valid).toBe(false);
    expect(result.recommendedPieces).toEqual(["desal", "polish"]);
    expect(result.tierChain.map((s) => s.status)).toEqual(["have", "have", "missing", "missing", "target"]);
    expect(result.reasonText).toMatch(/not ultrapure/);
  });

  it.each([
    ["tower", "river", false],
    ["tower", "municipal", true],
    ["closed", "municipal", false],
    ["office", "municipal", true],
    ["fire", "river", false],
    ["chiller", "municipal", true],
  ] as const)("%s fed by %s is valid=%s", (consumer, source, valid) => {
    const board = makeBoard([["s", source], ["c", consumer]], []);
    expect(checkConnection(board, "s", "c").valid).toBe(valid);
  });

  it("warns when desal has no brine disposal", () => {
    const board = makeBoard([["sea", "seawater"], ["d", "desal"]], [["sea", "d"]]);
    const warn = evaluateRules(board).find((r) => r.ruleId === "desal-brine");
    expect(warn).toMatchObject({ valid: false, severity: "warning", recommendedPieces: ["brine"] });

    const fixed = makeBoard([["sea", "seawater"], ["d", "desal"], ["b", "brine"]], [["sea", "d"], ["d", "b"]]);
    expect(evaluateRules(fixed).some((r) => r.ruleId === "desal-brine")).toBe(false);
  });

  it("never lets a lower tier into a higher-tier consumer, even through a storage tank", () => {
    // Mixing Tier 2 into a tank with Tier 5 water drops the tank to Tier 2.
    const board = makeBoard(
      [["m", "municipal"], ["ro", "ro"], ["upw", "upw"], ["t", "tank"], ["fab", "fab"]],
      [["m", "ro"], ["ro", "upw"], ["upw", "t"], ["m", "t"], ["t", "fab"]],
    );
    expect(evaluateRules(board).some((r) => r.ruleId === "tier-requirement" && r.to === "fab")).toBe(true);
  });

  it("explains impossible connections", () => {
    const board = makeBoard([["m", "municipal"], ["srv", "server"], ["b", "brine"], ["g", "gen"]], []);
    expect(checkConnection(board, "m", "srv").message).toBe("No water needed here");
    expect(checkConnection(board, "m", "b").message).toBe("Brine only goes one way");
    expect(checkConnection(board, "g", "m").message).toBe("Nothing flows out of that!");
  });

  it("flags disconnected consumers as offline", () => {
    const board = makeBoard([["m", "municipal"], ["fab", "fab"]], []);
    expect(evaluateRules(board).find((r) => r.ruleId === "consumer-offline")?.nodeId).toBe("fab");
  });

  it("applying the recommendation gives a valid Desal + Polishing chain with brine disposal", () => {
    const board = makeBoard([["sea", "seawater"], ["f", "filter"], ["fab", "fab"]], [["sea", "f"]]);
    const fixed = applyRecommendation(board, checkConnection(board, "f", "fab"));

    const types = fixed.nodes.map((n) => n.type);
    expect(types).toEqual(expect.arrayContaining(["desal", "polish", "brine"]));
    expect(fixed.nodes.filter((n) => ["desal", "polish", "brine"].includes(n.type)).every((n) => !n.existing)).toBe(true);
    expect(evaluateRules(fixed).filter((r) => r.severity !== "info")).toEqual([]);
  });
});
