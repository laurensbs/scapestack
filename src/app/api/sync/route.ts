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
import { extractBearerToken, verifyClaim } from "@/lib/sync-auth";
import { mapBlockTaskIds } from "@/lib/slayer/task-ids";

const MAX_BODY_BYTES = 1_000_000;
const ALLOWED_DIARY_TIERS = new Set(["Easy", "Medium", "Hard", "Elite"]);

interface SyncBody {
  rsn?: unknown;
  displayName?: unknown;
  questsCompleted?: unknown;
  diariesCompleted?: unknown;
  collectionLogItemIds?: unknown;
  slayer?: unknown;
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

  // Bearer auth — the plugin's install-token must match the claim row
  // for the supplied RSN. Without this, any client could overwrite any
  // player's sync data.
  const token = extractBearerToken(req.headers.get("authorization"));
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Missing or malformed Authorization header" },
      { status: 401 }
    );
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

  // Verify the bearer matches the claim row for this RSN.
  const allowed = await verifyClaim(rsn, token);
  if (!allowed) {
    return NextResponse.json(
      { ok: false, error: "Token does not match RSN claim — call /api/sync/claim first" },
      { status: 403 }
    );
  }

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

  // Slayer state — optioneel. Parsed-out om validatie netjes te
  // houden; rejecten van ongeldige slayer-shape rejected niet de
  // hele sync (degradeert naar slayer = null).
  let slayer: {
    points: number; streak: number; taskRemaining: number;
    currentTaskId: number; blocks: string[];
  } | null = null;
  if (body.slayer && typeof body.slayer === "object") {
    const s = body.slayer as {
      points?: unknown; streak?: unknown; taskRemaining?: unknown;
      currentTaskId?: unknown; blocks?: unknown;
    };
    const num = (v: unknown, lo: number, hi: number) =>
      typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : null;
    const points = num(s.points, 0, 1_000_000);
    const streak = num(s.streak, 0, 100_000);
    const taskRem = num(s.taskRemaining, 0, 500);
    const taskId = num(s.currentTaskId, 0, 10_000) ?? 0;
    // Raw task-IDs van de plugin → server-side mappen naar monster.id
    // slugs zodat de UI niet hoeft te weten van de OSRS varp-tabel.
    const rawBlocks = Array.isArray(s.blocks) ? s.blocks : [];
    const blockIds = rawBlocks
      .filter((b): b is number => typeof b === "number" && Number.isFinite(b) && b > 0)
      .slice(0, 12);
    const blocks = mapBlockTaskIds(blockIds);
    if (points !== null && streak !== null && taskRem !== null) {
      slayer = { points, streak, taskRemaining: taskRem, currentTaskId: taskId, blocks };
    }
  }

  try {
    await upsertSyncedPlayer({
      rsn,
      displayName,
      questsCompleted,
      diariesCompleted,
      collectionLogItemIds,
      slayer,
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
