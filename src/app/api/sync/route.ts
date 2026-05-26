// Plugin sync endpoint.
//
// The Scapestack RuneLite plugin POSTs here with the player's current
// quest / diary / collection-log state. We upsert the row in Neon; the
// next /next visit reads it via getSyncedPlayer().
//
// Auth (v1): the plugin includes the player's in-game RSN in the body
// and we trust it. NOT production-grade — anyone could fake a payload
// for someone else's name. v2 will add a per-install secret that's
// signed against an RSN by our own service.
//
// Validation: strict shape-check + length caps to keep junk out of the
// DB. Payload over 1 MB rejected.

import { NextResponse } from "next/server";
import { upsertSyncedPlayer } from "@/lib/sync-repo";

const MAX_BODY_BYTES = 1_000_000;
const ALLOWED_DIARY_TIERS = new Set(["Easy", "Medium", "Hard", "Elite"]);

interface SyncBody {
  rsn?: unknown;
  displayName?: unknown;
  questsCompleted?: unknown;
  diariesCompleted?: unknown;
  collectionLogItemIds?: unknown;
  pluginVersion?: unknown;
}

function badRequest(message: string): Response {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(req: Request): Promise<Response> {
  // Reject suspiciously large bodies before we even parse them.
  const lenHdr = req.headers.get("content-length");
  if (lenHdr && Number(lenHdr) > MAX_BODY_BYTES) {
    return badRequest("Body too large");
  }

  let body: SyncBody;
  try {
    body = await req.json() as SyncBody;
  } catch {
    return badRequest("Invalid JSON");
  }

  // RSN — required, max 12 chars (OSRS limit), printable ascii-ish.
  if (typeof body.rsn !== "string") return badRequest("rsn must be a string");
  const rsn = body.rsn.trim();
  if (rsn.length < 1 || rsn.length > 12) return badRequest("rsn length out of range");

  const displayName = typeof body.displayName === "string" && body.displayName.trim()
    ? body.displayName.trim().slice(0, 12)
    : rsn;

  // Quests — array of strings, capped at 500 entries.
  if (!Array.isArray(body.questsCompleted)) return badRequest("questsCompleted must be an array");
  const questsCompleted = body.questsCompleted
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.slice(0, 100))
    .slice(0, 500);

  // Diaries — array of { region, tier }, capped at 64 entries (12 regions × 4 tiers + slack).
  if (!Array.isArray(body.diariesCompleted)) return badRequest("diariesCompleted must be an array");
  const diariesCompleted = body.diariesCompleted
    .filter((x): x is { region: string; tier: string } =>
      typeof x === "object" && x !== null &&
      typeof (x as { region?: unknown }).region === "string" &&
      typeof (x as { tier?: unknown }).tier === "string" &&
      ALLOWED_DIARY_TIERS.has((x as { tier: string }).tier))
    .map((x) => ({
      region: x.region.slice(0, 64),
      tier: x.tier as "Easy" | "Medium" | "Hard" | "Elite"
    }))
    .slice(0, 64);

  // Collection log item IDs — array of positive integers, capped at 2000.
  if (!Array.isArray(body.collectionLogItemIds)) return badRequest("collectionLogItemIds must be an array");
  const collectionLogItemIds = body.collectionLogItemIds
    .filter((x): x is number => typeof x === "number" && Number.isFinite(x) && x > 0 && x < 1_000_000)
    .map((x) => Math.floor(x))
    .slice(0, 2000);

  const pluginVersion = typeof body.pluginVersion === "string"
    ? body.pluginVersion.slice(0, 32)
    : "unknown";

  try {
    await upsertSyncedPlayer({
      rsn,
      displayName,
      questsCompleted,
      diariesCompleted,
      collectionLogItemIds,
      pluginVersion
    });
  } catch (err) {
    console.error("upsertSyncedPlayer failed:", err);
    return NextResponse.json(
      { ok: false, error: "Sync failed — try again later" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    counts: {
      quests: questsCompleted.length,
      diaries: diariesCompleted.length,
      collectionLogItems: collectionLogItemIds.length
    }
  });
}

// Permissive CORS for the plugin POSTs from a desktop client (origin
// will be 'null' for file:// or the plugin's HTTP client which doesn't
// send an Origin header). Tighten when we add real auth.
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
