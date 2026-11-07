import { describe, expect, it } from "vitest";
import { SCENARIO_LABELS, type AdviseRequest } from "../contract";
import { formatPct, formatPlain, formatUsd, formatYears } from "./format";
import { detectIntent, scriptedAnswer } from "./scripted";
import { makeRequest } from "./testFixtures";

const NUMBER_TOKEN = /\d[\d,]*(?:\.\d+)?/g;

function tokens(text: string): string[] {
  return text.match(NUMBER_TOKEN) ?? [];
}

/** Every rendering of every number (and every number written in text) in the request. */
function allowedTokens(req: AdviseRequest): Set<string> {
  const pieces: string[] = [req.question, SCENARIO_LABELS[req.settings.scenarioId]];
  const walk = (value: unknown): void => {
    if (typeof value === "number" && Number.isFinite(value)) {
      pieces.push(formatUsd(value), formatYears(value), formatPct(value), formatPlain(value, 0), formatPlain(value, 1), formatPlain(value, 2));
    } else if (typeof value === "string") {
      pieces.push(value);
    } else if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (value && typeof value === "object") {
      Object.values(value).forEach(walk);
    }
  };
  walk(req.comparison);
  walk(req.advisor);
  return new Set(pieces.flatMap(tokens));
}

const QUESTIONS = [
  "How do I cut water cost 40%?",
  "What happens in a drought like 2021?",
  "What's the payback?",
  "Should we build desal?",
  "Is recycling worth it?",
  "Tell me about this design",
];

describe("scriptedAnswer", () => {
  it.each(QUESTIONS)("cites only numbers present in the request: %s", (question) => {
    const req = makeRequest(question);
    const answer = scriptedAnswer(req);
    const allowed = allowedTokens(req);
    const invented = tokens(answer).filter((token) => !allowed.has(token));
    expect(invented).toEqual([]);
  });

  it("leads with dollars", () => {
    const answer = scriptedAnswer(makeRequest("anything"));
    expect(answer.split("\n")[0]).toContain("$812.5K a year");
    expect(answer).toContain("$2.46M/yr");
  });

  it("refuses to compute a percentage target but echoes it", () => {
    const answer = scriptedAnswer(makeRequest("How do I cut water cost 40%?"));
    expect(answer).toContain("doesn't compute a 40% target");
    expect(answer).toContain("Add a recycling plant");
  });

  it("covers drought: cost of doing nothing and tankers", () => {
    const answer = scriptedAnswer(makeRequest("What if there's a drought?"));
    expect(answer).toContain("$7.35M/yr");
    expect(answer).toContain("92 tankers/day");
    expect(answer).toContain("2021-type drought");
  });

  it("phrases a negative-savings card as a cost", () => {
    const answer = scriptedAnswer(makeRequest("How do I cut water cost 40%?"));
    expect(answer).toContain("costs $310K/yr more");
    expect(answer).not.toContain("saves -$");
  });

  it("flags blocking rule violations", () => {
    expect(scriptedAnswer(makeRequest("payback?"))).toContain("Fix first: Desal needs brine disposal");
  });

  it("handles a null payback and missing advisor without crashing", () => {
    const base = makeRequest("What's the payback?");
    const req = makeRequest("What's the payback?", {
      advisor: null,
      comparison: { ...base.comparison, metrics: { ...base.comparison.metrics, payback: { ...base.comparison.metrics.payback, value: null } } },
    });
    expect(scriptedAnswer(req)).toContain("doesn't pay back");
  });

  it("is deterministic", () => {
    const req = makeRequest("Should we build desal?");
    expect(scriptedAnswer(req)).toBe(scriptedAnswer(req));
  });
});

describe("detectIntent", () => {
  it.each([
    ["How do I cut water cost 40%?", "cutCost"],
    ["What about a drought?", "drought"],
    ["When does it pay back?", "payback"],
    ["How much does desalination save?", "desal"],
    ["Should we recycle more?", "recycling"],
    ["hello", "summary"],
  ])("%s -> %s", (question, intent) => {
    expect(detectIntent(question)).toBe(intent);
  });
});
