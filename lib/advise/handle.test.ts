import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const ctorArgs: unknown[] = [];
vi.mock("@anthropic-ai/sdk", () => ({
  default: class FakeAnthropic {
    messages = { create };
    constructor(opts: unknown) {
      ctorArgs.push(opts);
    }
  },
}));

import { handleAdvise } from "./handle";
import { ADVISE_MODEL } from "./live";
import { SYSTEM_PROMPT } from "./prompt";
import { MAX_BODY_BYTES } from "./validate";
import { makeRequest } from "./testFixtures";

const FAKE_KEY = "sk-ant-test-not-real";
const body = (question = "How do I cut water cost 40%?") => JSON.stringify(makeRequest(question));

beforeEach(() => {
  create.mockReset();
  ctorArgs.length = 0;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("handleAdvise", () => {
  it("uses the scripted fallback when no key is set, without calling the SDK", async () => {
    const result = await handleAdvise(body(), undefined);
    expect(result.status).toBe(200);
    expect(result.body.source).toBe("scripted");
    expect(result.body.success).toBe(true);
    expect(result.body.answer).toContain("$812.5K");
    expect(create).not.toHaveBeenCalled();
  });

  it("calls Claude with the fixed model, a short timeout and the guard-railed prompt", async () => {
    create.mockResolvedValue({ content: [{ type: "text", text: "You save $812.5K a year." }] });
    const result = await handleAdvise(body(), FAKE_KEY);
    expect(result.body).toEqual({ success: true, source: "claude", answer: "You save $812.5K a year." });
    const params = create.mock.calls[0][0];
    expect(params.model).toBe(ADVISE_MODEL);
    expect(ADVISE_MODEL).toBe("claude-sonnet-4-6");
    expect(params.system).toBe(SYSTEM_PROMPT);
    expect(params.messages[0].content).toContain("Net annual savings [netAnnualSavings] = $812.5K/yr");
    expect(params.messages[0].content).toContain("<question>\nHow do I cut water cost 40%?\n</question>");
    expect(ctorArgs[0]).toMatchObject({ apiKey: FAKE_KEY, maxRetries: 0 });
    expect((ctorArgs[0] as { timeout: number }).timeout).toBeLessThanOrEqual(15_000);
  });

  it("system prompt forbids invented figures", () => {
    expect(SYSTEM_PROMPT).toContain("the model doesn't compute that");
    expect(SYSTEM_PROMPT).toMatch(/Never invent/);
  });

  it("falls back to scripted when the SDK throws, without leaking the error or key", async () => {
    create.mockRejectedValue(Object.assign(new Error(`boom ${FAKE_KEY}`), { status: 529 }));
    const result = await handleAdvise(body(), FAKE_KEY);
    expect(result.body.source).toBe("scripted");
    expect(JSON.stringify(result.body)).not.toContain(FAKE_KEY);
    expect(JSON.stringify(result.body)).not.toContain("boom");
    const logged = vi.mocked(console.warn).mock.calls.flat().join(" ");
    expect(logged).not.toContain(FAKE_KEY);
    expect(logged).not.toContain("boom");
  });

  it("falls back to scripted on an empty model response", async () => {
    create.mockResolvedValue({ content: [] });
    expect((await handleAdvise(body(), FAKE_KEY)).body.source).toBe("scripted");
  });

  it("returns 400 for invalid JSON", async () => {
    const result = await handleAdvise("{not json", undefined);
    expect(result.status).toBe(400);
    expect(result.body.success).toBe(false);
    expect(result.body.error).toMatch(/valid JSON/);
  });

  it("returns 400 with a friendly message for a bad body", async () => {
    const result = await handleAdvise(JSON.stringify({ question: "" }), FAKE_KEY);
    expect(result.status).toBe(400);
    expect(result.body.error).toBe("Please type a question.");
    expect(create).not.toHaveBeenCalled();
  });

  it("returns 413 for oversized payloads", async () => {
    const result = await handleAdvise("x".repeat(MAX_BODY_BYTES + 1), undefined);
    expect(result.status).toBe(413);
  });
});
