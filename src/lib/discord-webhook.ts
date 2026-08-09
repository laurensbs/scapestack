/**
 * Posting to a player's Discord webhook.
 *
 * The URL is typed in by a player, which makes every request the server makes
 * with it a request an outsider chose. Scapestack runs on a platform with a
 * metadata endpoint and a database on a private network, so "POST this body to
 * whatever they pasted" is a server-side request forgery with a UI. Hence the
 * allowlist below: the host must be Discord's, over https, on Discord's
 * webhook path. Nothing else is dialled.
 */

const DISCORD_WEBHOOK_HOSTS = new Set([
  "discord.com",
  "discordapp.com",
  "ptb.discord.com",
  "canary.discord.com"
]);

/**
 * Discord's own shape: /api/webhooks/{id}/{token}, optionally /api/v10/...
 *
 * Deliberately not bounded by length. Real IDs are 17–19 digits and real
 * tokens around 68 characters, but pinning those numbers buys nothing — the
 * scheme, the host and this path prefix are what decide where the server
 * dials — and it would reject every valid webhook the day Discord widens a
 * field.
 */
const WEBHOOK_PATH = /^\/api(?:\/v\d{1,2})?\/webhooks\/\d+\/[A-Za-z0-9_.-]+$/;

export function isDiscordWebhookUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (!DISCORD_WEBHOOK_HOSTS.has(url.hostname)) return false;
  // Credentials in the authority are how a URL can read as one host to a
  // careless parser and resolve to another: https://discord.com@evil.test/.
  // URL parses that correctly, but rejecting them outright costs nothing.
  if (url.username || url.password) return false;
  // Discord answers on 443 and nothing else. A URL with an explicit port is
  // still Discord's hostname, so the allowlist above passes it — and
  // discord.com:1337 is dropped rather than refused, so the connection hangs
  // until the 8s abort. One such webhook costs the Sunday job 8 seconds every
  // week forever, and 38 of them consume the entire function.
  if (url.port) return false;
  return WEBHOOK_PATH.test(url.pathname);
}

/**
 * A webhook URL is a credential — the token in the path is the whole auth. It
 * must never appear in a log line, an error body or a support screenshot.
 */
export function redactWebhookUrl(value: string): string {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/");
    const id = parts[parts.length - 2] ?? "";
    return `${url.hostname}/…/${id.slice(0, 4)}…`;
  } catch {
    return "invalid-url";
  }
}

export type DiscordPostResult =
  | { status: "sent" }
  | { status: "rejected"; reason: "not-a-discord-webhook" }
  /** Discord answered 404/401: the webhook was deleted. Stop trying. */
  | { status: "gone" }
  | { status: "failed"; code: number | null };

const TIMEOUT_MS = 8_000;

export async function postDiscordWebhook(
  webhookUrl: string,
  payload: unknown,
  fetchImpl: typeof fetch = fetch
): Promise<DiscordPostResult> {
  if (!isDiscordWebhookUrl(webhookUrl)) {
    return { status: "rejected", reason: "not-a-discord-webhook" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      // A webhook that answers with a redirect is not Discord answering. The
      // allowlist above would be worth nothing if a 302 could walk out of it.
      redirect: "manual",
      signal: controller.signal
    });
    // 404/401: the webhook is deleted or its token is no longer valid. Gone.
    //
    // 403 is NOT gone. Discord returns it for Missing Permissions (50013) on a
    // webhook that still exists — a channel permission change, an AutoMod
    // rule. Treating it as deleted silently threw away a working webhook and
    // left the player to work out for themselves why the recaps stopped.
    if (response.status === 404 || response.status === 401) return { status: "gone" };
    if (!response.ok) return { status: "failed", code: response.status };
    return { status: "sent" };
  } catch {
    return { status: "failed", code: null };
  } finally {
    clearTimeout(timer);
  }
}
