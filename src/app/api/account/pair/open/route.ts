import { NextResponse } from "next/server";
import { startApprovedAccountPairing, normalizePairingCode } from "@/lib/account-pairing";
import { BRAND_URL } from "@/lib/brand";
import { extractBearerToken, verifyClaim } from "@/lib/sync-auth";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Cache-Control": "no-store"
};

function json(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return NextResponse.json(data, { status, headers: { ...CORS_HEADERS, ...extraHeaders } });
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
  const rsn = body && typeof body === "object" && !Array.isArray(body)
    ? (body as { rsn?: unknown }).rsn
    : null;
  if (typeof rsn !== "string" || !rsn.trim()) {
    return json({ ok: false, error: "RSN is required" }, 400);
  }
  if (!await verifyClaim(rsn, token)) {
    return json({ ok: false, error: "RuneLite claim does not match this player" }, 403);
  }

  const pairing = await startApprovedAccountPairing(rsn);
  if (pairing.status === "unclaimed") {
    return json({ ok: false, error: "Sync this player before connecting the browser" }, 409);
  }
  if (pairing.status === "rate-limited") {
    return json({ ok: false, error: "Wait a minute before creating another link" }, 429, { "Retry-After": "60" });
  }

  const link = new URL("/link", BRAND_URL);
  link.searchParams.set("code", normalizePairingCode(pairing.code));
  return json({
    ok: true,
    pairing: {
      ...pairing,
      linkUrl: link.toString()
    }
  });
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
