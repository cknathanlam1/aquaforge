import { describe, expect, it } from "vitest";
import { MAX_QUESTION_CHARS, validateAdviseRequest } from "./validate";
import { makeRequest } from "./testFixtures";

describe("validateAdviseRequest", () => {
  it("accepts a well-formed request and trims the question", () => {
    const result = validateAdviseRequest({ ...makeRequest("  payback?  ") });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.question).toBe("payback?");
  });

  it("defaults a missing advisor to null", () => {
    const { advisor: _omit, ...rest } = makeRequest("hi");
    const result = validateAdviseRequest(rest);
    expect(result.ok && result.value.advisor).toBe(null);
  });

  const good = makeRequest("q");
  const metrics = good.comparison.metrics;
  it.each<[string, unknown]>([
    ["non-object body", "hello"],
    ["array body", []],
    ["missing question", { ...good, question: undefined }],
    ["blank question", { ...good, question: "   " }],
    ["overlong question", { ...good, question: "x".repeat(MAX_QUESTION_CHARS + 1) }],
    ["missing board", { ...good, board: null }],
    ["unknown scenario", { ...good, settings: { ...good.settings, scenarioId: "mars" } }],
    ["missing comparison", { ...good, comparison: undefined }],
    ["missing required metric", { ...good, comparison: { ...good.comparison, metrics: { ...metrics, payback: undefined } } }],
    ["string metric value", { ...good, comparison: { ...good.comparison, metrics: { ...metrics, npv: { ...metrics.npv, value: "1e9" } } } }],
    ["NaN-like metric value", { ...good, comparison: { ...good.comparison, metrics: { ...metrics, npv: { ...metrics.npv, value: Infinity } } } }],
    ["rules not a list", { ...good, comparison: { ...good.comparison, rules: {} } }],
    ["malformed advisor card", { ...good, advisor: { cards: [{ title: "x" }], plan: null } }],
    ["too many nodes", { ...good, board: { nodes: Array.from({ length: 501 }, () => good.board.nodes[0]), edges: [] } }],
  ])("rejects %s", (_name, body) => {
    const result = validateAdviseRequest(body);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
  });
});
