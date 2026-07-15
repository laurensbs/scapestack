// Plugin sync endpoint.
//
// The Scapestack RuneLite plugin POSTs here with the player's current
// quest / diary / collection-log state. We upsert the row in Neon; the
// next /next visit reads it via getSyncedPlayer().
//
// Auth: the plugin includes a per-install bearer token. /api/sync/claim
// binds that token to the RSN on first claim; later syncs must present
// the same token for that RSN.
//
// Validation: strict shape-check + length caps to keep junk out of the
// DB. Payload over 1 MB rejected.

import { NextResponse } from "next/server";
import { upsertSyncedPlayer } from "@/lib/sync-repo";
import { extractBearerToken, verifyClaim } from "@/lib/sync-auth";
import { mapBlockTaskIds } from "@/lib/slayer/task-ids";
import { getSyncServiceStatus, SYNC_SERVICE_LIMITS } from "@/lib/sync-service-readiness";
import { normalizeScapestackAccountType } from "@/lib/account-type";
import { normalizePluginBankStatus } from "@/lib/plugin-bank-status";

const MAX_BODY_BYTES = SYNC_SERVICE_LIMITS.maxBodyBytes;
const ALLOWED_DIARY_TIERS = new Set(["Easy", "Medium", "Hard", "Elite"]);
const RSN_RE = /^[A-Za-z0-9 _-]+$/;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type"
};
interface SyncBody {
  rsn?: unknown;
  displayName?: unknown;
  accountType?: unknown;
  skills?: unknown;
  questsCompleted?: unknown;
  diariesCompleted?: unknown;
  collectionLogItemIds?: unknown;
  bossKc?: unknown;
  bankItems?: unknown;
  bankStatus?: unknown;
  slayer?: unknown;
  pluginVersion?: unknown;
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

function badRequest(message: string): Response {
  return json({ ok: false, error: message }, { status: 400 });
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function normalizeRsn(rsn: string): string {
  return rsn.trim().toLowerCase().slice(0, 12);
}

function cleanDisplayName(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const displayName = value.trim().slice(0, 12);
  return displayName && RSN_RE.test(displayName) ? displayName : fallback;
}

export async function GET(): Promise<Response> {
  return json(await getSyncServiceStatus());
}

export async function POST(req: Request): Promise<Response> {
  // Reject suspiciously large bodies before we even parse them.
  const lenHdr = req.headers.get("content-length");
  if (lenHdr) {
    const declaredLength = Number(lenHdr);
    if (!Number.isFinite(declaredLength) || declaredLength < 0) {
      return badRequest("Invalid content-length");
    }
    if (declaredLength > MAX_BODY_BYTES) {
      return badRequest("Body too large");
    }
  }

  const token = extractBearerToken(req.headers.get("authorization"));
  if (!token) {
    return json(
      { ok: false, error: "Missing or malformed Authorization header" },
      { status: 401 }
    );
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return badRequest("Unable to read request body");
  }
  if (byteLength(rawBody) > MAX_BODY_BYTES) {
    return badRequest("Body too large");
  }

  // Bearer auth — the plugin's install-token must match the claim row
  // for the supplied RSN. Without this, any client could overwrite any
  // player's sync data.
  let body: SyncBody;
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return badRequest("JSON body must be an object");
    }
    body = parsed as SyncBody;
  } catch {
    return badRequest("Invalid JSON");
  }

  // RSN — required, max 12 chars (OSRS limit), printable ascii-ish.
  if (typeof body.rsn !== "string") return badRequest("rsn must be a string");
  const rsn = body.rsn.trim();
  if (rsn.length < 1 || rsn.length > 12) return badRequest("rsn length out of range");
  if (!RSN_RE.test(rsn)) return badRequest("rsn contains invalid characters");
  const normalizedRsn = normalizeRsn(rsn);

  // Verify the bearer matches the claim row for this RSN.
  const allowed = await verifyClaim(rsn, token);
  if (!allowed) {
    return json(
      { ok: false, error: "Token does not match RSN claim — call /api/sync/claim first" },
      { status: 403 }
    );
  }

  const displayName = cleanDisplayName(body.displayName, rsn);
  const accountType = normalizeScapestackAccountType(body.accountType);

  // Skills — optional RuneLite real levels. Hiscores may still enrich
  // rank/xp later, but plugin levels let /next plan from live account data.
  const skillsReceived = Array.isArray(body.skills) ? body.skills.length : 0;
  const skills = Array.isArray(body.skills)
    ? body.skills
        .filter((x): x is { name: string; level: number; xp?: number } =>
          typeof x === "object" && x !== null &&
          typeof (x as { name?: unknown }).name === "string" &&
          typeof (x as { level?: unknown }).level === "number" &&
          Number.isFinite((x as { level: number }).level))
        .map((x) => ({
          name: x.name.trim().slice(0, 32),
          level: Math.max(1, Math.min(126, Math.floor(x.level))),
          xp: typeof x.xp === "number" && Number.isFinite(x.xp)
            ? Math.max(0, Math.min(200_000_000, Math.floor(x.xp)))
            : undefined
        }))
        .filter((x) => x.name.length > 0)
        .slice(0, 32)
    : [];

  // Quests — array of strings, capped at 500 entries.
  if (!Array.isArray(body.questsCompleted)) return badRequest("questsCompleted must be an array");
  const questsReceived = body.questsCompleted.length;
  const questsCompleted = body.questsCompleted
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.slice(0, 100))
    .slice(0, 500);

  // Diaries — array of { region, tier }, capped at 64 entries (12 regions × 4 tiers + slack).
  if (!Array.isArray(body.diariesCompleted)) return badRequest("diariesCompleted must be an array");
  const diariesReceived = body.diariesCompleted.length;
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
  const collectionLogItemsReceived = body.collectionLogItemIds.length;
  const collectionLogItemIds = body.collectionLogItemIds
    .filter((x): x is number => typeof x === "number" && Number.isFinite(x) && x > 0 && x < 1_000_000)
    .map((x) => Math.floor(x))
    .slice(0, 2000);

  // Optional forward-compatible boss KC map. Current plugin versions may omit
  // it; omission remains unknown rather than being treated as zero KC.
  const bossKc = body.bossKc && typeof body.bossKc === "object" && !Array.isArray(body.bossKc)
    ? Object.fromEntries(Object.entries(body.bossKc as Record<string, unknown>)
        .filter(([name, kc]) => name.trim().length > 0 && typeof kc === "number" && Number.isFinite(kc) && kc >= 0)
        .slice(0, 128)
        .map(([name, kc]) => [name.trim().slice(0, 80), Math.max(0, Math.min(2_147_483_647, Math.floor(kc as number)))]))
    : null;

  // Bank items — optional opt-in RuneLite payload. Only item identity and
  // quantity are accepted; no inventory/equipment/chat/client metadata.
  const bankItemsReceived = Array.isArray(body.bankItems) ? body.bankItems.length : 0;
  const bankItems = Array.isArray(body.bankItems)
    ? body.bankItems
        .filter((x): x is { id: number; name: string; quantity?: number } =>
          typeof x === "object" && x !== null &&
          typeof (x as { id?: unknown }).id === "number" &&
          Number.isFinite((x as { id: number }).id) &&
          typeof (x as { name?: unknown }).name === "string")
        .map((x) => ({
          id: Math.floor(x.id),
          name: x.name.trim().slice(0, 100),
          quantity: typeof x.quantity === "number" && Number.isFinite(x.quantity)
            ? Math.max(1, Math.min(2_147_483_647, Math.floor(x.quantity)))
            : 1
        }))
        .filter((x) => x.id > 0 && x.id < 1_000_000 && x.name.length > 0)
        .slice(0, SYNC_SERVICE_LIMITS.bankItems)
    : [];
  const bankStatus = normalizePluginBankStatus(body.bankStatus, bankItems.length);

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
  let slayerStatus: "missing" | "accepted" | "ignored" = "missing";
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
      slayerStatus = "accepted";
    } else {
      slayerStatus = "ignored";
    }
  }

  let syncedAt: string;
  let syncSummary: unknown = null;
  try {
    const result = await upsertSyncedPlayer({
      rsn,
      displayName,
      accountType,
      skills,
      questsCompleted,
      diariesCompleted,
      collectionLogItemIds,
      bossKc,
      bankItems,
      bankStatus,
      slayer,
      pluginVersion,
      availability: {
        skills: skills.length > 0 ? "available" : "unknown",
        quests: "available",
        diaries: "available",
        collectionLog: "available",
        bossKc: bossKc ? "available" : "unknown",
        slayer: slayerStatus === "accepted" ? "available" : "unknown",
        bank: bankStatus.enabled && bankStatus.unavailableReason === null
          ? "available"
          : bankStatus.unavailableReason ? "unavailable" : "unknown"
      }
    });
    syncedAt = result.syncedAt;
    syncSummary = result.syncSummary;
  } catch (error) {
    console.error("upsertSyncedPlayer failed", error instanceof Error
      ? { name: error.name, message: error.message }
      : { error: String(error) });
    return json(
      { ok: false, error: "Sync failed — try again later" },
      { status: 500 }
    );
  }

  return json({
    ok: true,
    syncedAt,
    syncSummary,
    player: {
      rsn: normalizedRsn,
      displayName,
      accountType
    },
    plugin: {
      version: pluginVersion,
      slayer: {
        status: slayerStatus,
        currentTaskId: slayer?.currentTaskId ?? null,
        blocks: slayer?.blocks.length ?? 0
      },
      bank: bankStatus
    },
    counts: {
      quests: questsCompleted.length,
      skills: skills.length,
      diaries: diariesCompleted.length,
      collectionLogItems: collectionLogItemIds.length,
      bankItems: bankItems.length
    },
    diagnostics: {
      received: {
        bytes: byteLength(rawBody),
        skills: skillsReceived,
        quests: questsReceived,
        diaries: diariesReceived,
        collectionLogItems: collectionLogItemsReceived,
        bankItems: bankItemsReceived
      },
      truncated: {
        skills: skills.length >= 32 && skillsReceived > skills.length,
        quests: questsCompleted.length >= 500 && questsReceived > questsCompleted.length,
        diaries: diariesCompleted.length >= 64 && diariesReceived > diariesCompleted.length,
        collectionLogItems: collectionLogItemIds.length >= 2000 && collectionLogItemsReceived > collectionLogItemIds.length,
        bankItems: bankItems.length >= SYNC_SERVICE_LIMITS.bankItems && bankItemsReceived > bankItems.length
      }
    }
  });
}

// Permissive CORS for plugin POSTs from a desktop client. Auth still comes
// from the per-install bearer token bound by /api/sync/claim.
export async function OPTIONS(): Promise<Response> {
  return new Response(null, withCors({ status: 204 }));
}
