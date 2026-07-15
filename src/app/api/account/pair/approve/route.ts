import { NextResponse } from "next/server";
import { approveAccountPairing } from "@/lib/account-pairing";
import { extractBearerToken, verifyClaim } from "@/lib/sync-auth";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Cache-Control": "no-store"
};

function json(data: unknown, status = 200): Response {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

export async function POST(request: Request): Promise<Response> {
  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) return json({ ok: false, error: "Missing Authorization" }, 401);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ ok: false, error: "Invalid request" }, 400);
  }
  const { rsn, code } = body as { rsn?: unknown; code?: unknown };
  if (typeof rsn !== "string" || typeof code !== "string") {
    return json({ ok: false, error: "RSN and code are required" }, 400);
  }
  if (!await verifyClaim(rsn, token)) {
    return json({ ok: false, error: "RuneLite claim does not match this player" }, 403);
  }
  const result = await approveAccountPairing(rsn, code);
  if (result !== "approved") return json({ ok: false, error: "Code expired or not found" }, 404);
  return json({ ok: true, status: "approved" });
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
