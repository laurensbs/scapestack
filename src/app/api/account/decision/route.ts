import { NextResponse } from "next/server";
import { getConnectedAccount } from "@/lib/account-pairing";
import {
  recordRecommendationDecisionForAccount,
  recordRecommendationLifecycleForAccount
} from "@/lib/account-history-repo";
import { readAccountSessionToken } from "@/lib/account-session-cookie";
import { parseRecommendationDecision } from "@/lib/recommendation-decision";

function json(body: Record<string, unknown>, status = 200): Response {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  const sessionToken = readAccountSessionToken(request);
  const account = sessionToken ? await getConnectedAccount(sessionToken) : null;
  if (!account) return json({ ok: false, error: "Connect RuneLite to save this plan" }, 401);

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 32_000) {
    return json({ ok: false, error: "That plan is too large to save" }, 413);
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return json({ ok: false, error: "Could not read that plan" }, 400);
  }
  const body = input && typeof input === "object"
    ? input as { decision?: unknown; eventType?: unknown }
    : {};
  const decision = parseRecommendationDecision(body.decision);
  if (!decision) return json({ ok: false, error: "That plan is incomplete" }, 400);
  const eventType = body.eventType;
  if (eventType !== undefined && !["started", "done", "skipped"].includes(String(eventType))) {
    return json({ ok: false, error: "That plan action is not supported" }, 400);
  }

  try {
    const stored = await recordRecommendationDecisionForAccount(account.accountId, decision);
    if (!stored) return json({ ok: false, error: "Could not save that plan" }, 500);
    const lifecycle = eventType
      ? await recordRecommendationLifecycleForAccount({
          accountId: account.accountId,
          decisionId: stored.decisionId,
          decision,
          eventType: eventType as "started" | "done" | "skipped"
        })
      : null;
    if (eventType && !lifecycle) return json({ ok: false, error: "Could not save that plan action" }, 500);
    return json({
      ok: true,
      created: stored.created,
      decisionId: stored.decisionId,
      ...(lifecycle ? { eventId: lifecycle.eventId, eventCreated: lifecycle.created } : {})
    });
  } catch (error) {
    console.error("Recommendation decision save failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Unknown failure"
    });
    return json({ ok: false, error: "Could not save that plan" }, 500);
  }
}
