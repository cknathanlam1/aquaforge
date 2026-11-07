import { handleAdvise } from "@/lib/advise/handle";
import { MAX_BODY_BYTES } from "@/lib/advise/validate";

/**
 * POST /api/advise
 * Body: AdviseRequest (lib/contract.ts). Response: AdviseResponse.
 * Uses Claude when ANTHROPIC_API_KEY is set, otherwise (or on any failure) a scripted explainer.
 */
export async function POST(request: Request): Promise<Response> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) {
    return Response.json(
      { success: false, source: "scripted", answer: "", error: "That request is too large. Try a smaller board." },
      { status: 413 },
    );
  }
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return Response.json(
      { success: false, source: "scripted", answer: "", error: "Could not read the request body." },
      { status: 400 },
    );
  }
  const result = await handleAdvise(raw, process.env.ANTHROPIC_API_KEY);
  return Response.json(result.body, { status: result.status });
}
