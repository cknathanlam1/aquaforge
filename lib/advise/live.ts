/**
 * Live Claude call. Throws on any failure; the caller falls back to the scripted answer.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { AdviseRequest } from "../contract";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompt";

/** Model id specified by the project owner. Change it here only. */
export const ADVISE_MODEL = "claude-sonnet-4-6";
export const ADVISE_TIMEOUT_MS = 12_000;
const MAX_OUTPUT_TOKENS = 600;

export async function askClaude(req: AdviseRequest, apiKey: string): Promise<string> {
  const client = new Anthropic({ apiKey, timeout: ADVISE_TIMEOUT_MS, maxRetries: 0 });
  const message = await client.messages.create({
    model: ADVISE_MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(req) }],
  });
  const text = message.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("\n")
    .trim();
  if (!text) throw new Error("Empty model response");
  return text;
}
