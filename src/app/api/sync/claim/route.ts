// First-claim endpoint for the Scapestack plugin.
//
// Plugin POSTs here once on first install: { rsn, token }. We verify the
// RSN exists on Hiscores (a tiny barrier — fake names can't slip past
// without a real account), then bind rsn → sha256(token). Subsequent
// /api/sync calls must present the same token via Bearer header.
//
// Idempotent: the same plugin re-POSTing the same { rsn, token } is a
// no-op (recordClaim returns ok). A different token for the same RSN
// is rejected.

import { NextResponse } from "next/server";
import { fetchHiscores } from "@/lib/hiscores";
import { recordClaim } from "@/lib/sync-auth";

interface ClaimBody {
  rsn?: unknown;
  token?: unknown;
}

function bad(message: string, status = 400): Response {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request): Promise<Response> {
  let body: ClaimBody;
  try {
    body = await req.json() as ClaimBody;
  } catch {
    return bad("Invalid JSON");
  }
  if (typeof body.rsn !== "string") return bad("rsn must be a string");
  if (typeof body.token !== "string") return bad("token must be a string");
  const rsn = body.rsn.trim();
  const token = body.token.trim();
  if (rsn.length < 1 || rsn.length > 12) return bad("rsn length out of range");
  if (token.length < 16 || token.length > 200) return bad("token length out of range");
  if (!/^[A-Za-z0-9\-_.~]+$/.test(token)) return bad("token contains invalid characters");

  // Hiscores existence check — best-effort. We don't reject when
  // Jagex is down; just skip when we can't reach them.
  try {
    const hi = await fetchHiscores(rsn);
    if (hi === null) return bad("RSN not found on Hiscores", 404);
  } catch {
    // Jagex unreachable — accept the claim. The sync endpoint will
    // catch fake-RSNs later when their sync data fails validation.
  }

  const result = await recordClaim(rsn, token);
  if (!result.ok) {
    return bad(result.reason ?? "Claim rejected", result.existingTokenHash ? 409 : 500);
  }
  return NextResponse.json({ ok: true });
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type"
    }
  });
}
