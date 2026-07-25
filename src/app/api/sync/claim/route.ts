// First-claim endpoint for the Scapestack plugin.
//
// Plugin POSTs here once on first install: { rsn } plus Authorization bearer.
// We verify the
// RSN exists on Hiscores (a tiny barrier — fake names can't slip past
// without a real account), then bind rsn → sha256(token). Subsequent
// /api/sync calls must present the same token via Bearer header.
//
// Idempotent: the same plugin re-POSTing the same { rsn, bearer token } is a
// no-op (recordClaim returns ok). A different token for the same RSN
// is rejected.

import { NextResponse } from "next/server";
import { checkHiscoresForClaim } from "@/lib/claim-hiscores";
import { extractBearerToken, hasExistingClaim, recordClaim } from "@/lib/sync-auth";
import { cleanRsnInput, isValidRsn, normalizeRsn } from "@/lib/rsn";
import { checkAndRecordClaimAttempt, clientAddressFrom } from "@/lib/claim-rate-limit";
import { ensureSyncSchema } from "@/lib/sync-repo";

const MAX_BODY_BYTES = 50_000;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type"
};

interface ClaimBody {
  rsn?: unknown;
  /** RuneLite's per-account hash. Plugin 0.4.0+. Tells a rename apart from
   *  an account switch on the same install. */
  accountHash?: unknown;
}

function withCors(init: ResponseInit = {}): ResponseInit {
  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  if (!headers.has("cache-control")) {
    headers.set("cache-control", "no-store");
  }
  return { ...init, headers };
}

function json(data: unknown, init: ResponseInit = {}): Response {
  return NextResponse.json(data, withCors(init));
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function bad(message: string, status = 400): Response {
  return json({ ok: false, error: message }, { status });
}

export async function POST(req: Request): Promise<Response> {
  const lenHdr = req.headers.get("content-length");
  if (lenHdr) {
    const declaredLength = Number(lenHdr);
    if (!Number.isFinite(declaredLength) || declaredLength < 0) {
      return bad("Invalid content-length");
    }
    if (declaredLength > MAX_BODY_BYTES) {
      return bad("Body too large");
    }
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return bad("Unable to read request body");
  }
  if (byteLength(rawBody) > MAX_BODY_BYTES) {
    return bad("Body too large");
  }
  const token = extractBearerToken(req.headers.get("authorization"));
  if (!token) {
    return json(
      { ok: false, error: "Missing or malformed Authorization header" },
      { status: 401 }
    );
  }

  let body: ClaimBody;
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return bad("JSON body must be an object");
    }
    body = parsed as ClaimBody;
  } catch {
    return bad("Invalid JSON");
  }
  if (typeof body.rsn !== "string") return bad("rsn must be a string");
  // Fold the client's non-breaking spaces before validating — see lib/rsn.ts.
  const rsn = cleanRsnInput(body.rsn);
  if (rsn.length < 1 || rsn.length > 12) return bad("rsn length out of range");
  if (!isValidRsn(rsn)) return bad("rsn contains invalid characters");

  // Claiming is the first thing a new install does, so on a fresh deployment
  // it can arrive before any sync has created the schema. Without this the
  // rate limiter would query a table that does not exist, fail open, and be
  // silently disabled — and recordClaim's last_synced_at read would error out.
  // Memoised per process, so this is a cold-start cost, not a per-request one.
  await ensureSyncSchema();

  // Rate limit before the Hiscores lookup, not after. Otherwise this endpoint
  // doubles as an unmetered proxy for enumerating Jagex's Hiscores, which is
  // exactly what a name-grabber needs to find claimable targets.
  const rate = await checkAndRecordClaimAttempt({ address: clientAddressFrom(req), token });
  if (!rate.allowed) {
    return json(
      { ok: false, error: "Too many claim attempts. Wait a while and try again." },
      { status: 429 }
    );
  }

  // Hiscores existence check — best-effort. Skip it for existing claims:
  // idempotent re-claims and rival-token conflicts are decided entirely by
  // the DB binding and should not wait on Jagex.
  const existingClaim = await hasExistingClaim(rsn);
  let hiscoresStatus: "found" | "missing" | "unreachable" | "skipped-existing" = "skipped-existing";
  if (!existingClaim) {
    const hiscores = await checkHiscoresForClaim(rsn);
    hiscoresStatus = hiscores;
    if (hiscores === "missing") return bad("RSN not found on Hiscores", 404);
    // "unreachable" deliberately accepts the claim. The sync endpoint will
    // still require the same token on every payload.
  }

  // Only accept a plausible account hash; RuneLite's is a decimal long.
  const accountHash = typeof body.accountHash === "string" && /^-?\d{1,32}$/.test(body.accountHash.trim())
    ? body.accountHash.trim()
    : null;

  const result = await recordClaim(rsn, token, accountHash);
  if (!result.ok) {
    return bad(result.reason ?? "Claim rejected", result.existingTokenHash ? 409 : 500);
  }
  return json({
    ok: true,
    player: {
      rsn: normalizeRsn(rsn),
      displayName: rsn
    },
    claim: {
      status: existingClaim ? "verified-existing" : "accepted",
      hiscores: hiscoresStatus
    }
  });
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, withCors({ status: 204 }));
}
