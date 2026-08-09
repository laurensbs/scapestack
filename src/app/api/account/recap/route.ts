import { NextResponse } from "next/server";
import { getConnectedAccount } from "@/lib/account-pairing";
import { readAccountSessionToken, requestHasTrustedOrigin } from "@/lib/account-session-cookie";
import { isDiscordWebhookUrl, redactWebhookUrl } from "@/lib/discord-webhook";
import { getRecapSettings, setRecapSettings } from "@/lib/weekly-recap-repo";

/**
 * Where a player turns the Sunday recap on (SPEC §3.3).
 *
 * Paired accounts only. The webhook posts into someone's Discord, and "prove
 * you own this account" has to come before "we will post on your behalf".
 */

const NO_STORE = { "cache-control": "no-store" };

function json(body: unknown, status = 200): Response {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

async function accountFor(request: Request) {
  const token = readAccountSessionToken(request);
  return token ? getConnectedAccount(token) : null;
}

export async function GET(request: Request): Promise<Response> {
  const account = await accountFor(request);
  if (!account) return json({ ok: false, error: "Connect RuneLite to manage your recap" }, 401);
  const settings = await getRecapSettings(account.accountId);
  return json({
    ok: true,
    enabled: settings.enabled,
    // The token in the path is the whole authorisation. It goes to the
    // database and comes back only as "discord.com/…/1234…", never in full —
    // not to this page, not to a log line, not into a support screenshot.
    discord: settings.discordWebhookUrl ? redactWebhookUrl(settings.discordWebhookUrl) : null
  });
}

export async function POST(request: Request): Promise<Response> {
  if (!requestHasTrustedOrigin(request)) {
    return json({ ok: false, error: "That request did not come from this site" }, 403);
  }
  const account = await accountFor(request);
  if (!account) return json({ ok: false, error: "Connect RuneLite to manage your recap" }, 401);

  let body: { enabled?: unknown; discordWebhookUrl?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return json({ ok: false, error: "That request is not valid" }, 400);
  }

  const enabled = body.enabled !== false;
  const raw = typeof body.discordWebhookUrl === "string" ? body.discordWebhookUrl.trim() : null;

  // An empty string means "remove it", which is a different instruction from
  // "leave it alone" (undefined). Conflating them would make the field
  // impossible to clear.
  let webhook: string | null | undefined;
  if (raw === null) webhook = undefined;
  else if (raw === "") webhook = null;
  else if (isDiscordWebhookUrl(raw)) webhook = raw;
  else return json({ ok: false, error: "That is not a Discord webhook URL" }, 400);

  try {
    await setRecapSettings(account.accountId, { enabled, discordWebhookUrl: webhook });
  } catch (error) {
    console.error("Recap settings write failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return json({ ok: false, error: "Could not save that" }, 500);
  }

  const settings = await getRecapSettings(account.accountId);
  return json({
    ok: true,
    enabled: settings.enabled,
    discord: settings.discordWebhookUrl ? redactWebhookUrl(settings.discordWebhookUrl) : null
  });
}
