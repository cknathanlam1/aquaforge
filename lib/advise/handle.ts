/**
 * Framework-free core of POST /api/advise, so it can be unit-tested without Next.
 * Never throws; never echoes the API key or error internals.
 */

import type { AdviseResponse } from "../contract";
import { askClaude } from "./live";
import { scriptedAnswer } from "./scripted";
import { MAX_BODY_BYTES, validateAdviseRequest } from "./validate";

export interface AdviseResult {
  status: number;
  body: AdviseResponse;
}

function failure(status: number, error: string): AdviseResult {
  return { status, body: { success: false, source: "scripted", answer: "", error } };
}

/** Logs only the error class and HTTP status, never the message (it may echo request data). */
function describeError(error: unknown): string {
  if (error && typeof error === "object") {
    const name = error.constructor?.name ?? "Error";
    const status = "status" in error && typeof error.status === "number" ? ` status=${error.status}` : "";
    return `${name}${status}`;
  }
  return "unknown";
}

export async function handleAdvise(rawBody: string, apiKey: string | undefined): Promise<AdviseResult> {
  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
    return failure(413, "That request is too large. Try a smaller board.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return failure(400, "Request body must be valid JSON.");
  }
  const validation = validateAdviseRequest(parsed);
  if (!validation.ok) return failure(400, validation.error);

  const req = validation.value;
  if (apiKey) {
    try {
      const answer = await askClaude(req, apiKey);
      return { status: 200, body: { success: true, source: "claude", answer } };
    } catch (error: unknown) {
      console.warn(`[advise] live call failed (${describeError(error)}); using scripted answer`);
    }
  }
  return { status: 200, body: { success: true, source: "scripted", answer: scriptedAnswer(req) } };
}
