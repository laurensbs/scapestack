// Discord webhook integration. Stores webhook URLs in localStorage only —
// never round-tripped through our server. Webhooks are user-controlled
// secrets and we treat them as such.

import type { BankDiff } from "./diff";
import type { OrganizedTab } from "./organizer";
import { BRAND_NAME, BRAND_URL, brandUrl } from "./brand";
import { ICON_URL } from "./utils";

const STORAGE_KEY = "scapestack-bank:discord-webhook";
const LAST_SENT_KEY = "scapestack-bank:discord-last-sent";

export interface WebhookConfig {
  url: string;
  enabled: boolean;
  // Optional clan / display name shown in the embed
  label?: string;
  // Player's RSN, used in the message
  rsn?: string;
}

export function loadWebhookConfig(): WebhookConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.url !== "string") return null;
    return parsed as WebhookConfig;
  } catch {
    return null;
  }
}

export function saveWebhookConfig(config: WebhookConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

export function clearWebhookConfig(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LAST_SENT_KEY);
  } catch {}
}

export function isValidDiscordWebhook(url: string): boolean {
  return /^https:\/\/(discord\.com|discordapp\.com|ptb\.discord\.com|canary\.discord\.com)\/api\/webhooks\/\d+\/[\w-]+$/i.test(url.trim());
}

// Throttle: don't spam Discord. Refuse to send within N minutes of last send.
const MIN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function shouldThrottle(): { throttled: boolean; nextAt?: number } {
  if (typeof window === "undefined") return { throttled: false };
  try {
    const last = parseInt(localStorage.getItem(LAST_SENT_KEY) || "0", 10);
    if (!Number.isFinite(last) || last <= 0) return { throttled: false };
    const elapsed = Date.now() - last;
    if (elapsed < MIN_INTERVAL_MS) {
      return { throttled: true, nextAt: last + MIN_INTERVAL_MS };
    }
    return { throttled: false };
  } catch {
    return { throttled: false };
  }
}

function markSent(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAST_SENT_KEY, String(Date.now()));
  } catch {}
}

// ── Embed builders ──────────────────────────────────────────────────────────

const SCAPESTACK_GOLD = 0xFFB930; // matches our brand
const RED = 0xC95040;
const GREEN = 0x6ABF6A;

interface BuildOptions {
  rsn?: string;
  label?: string;
  tabs: OrganizedTab[];
  diff?: BankDiff;
  shareUrl?: string;
}

interface DiscordEmbed {
  title: string;
  description?: string;
  color: number;
  url?: string;
  thumbnail?: { url: string };
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string;
}

function formatGpCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString();
}

function absoluteSpriteUrl(itemId: number, shareUrl?: string): string {
  const origin = (() => {
    if (shareUrl) {
      try {
        return new URL(shareUrl).origin;
      } catch {}
    }
    if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
    return BRAND_URL;
  })();

  return new URL(ICON_URL(itemId), origin).toString();
}

function buildEmbed(opts: BuildOptions): DiscordEmbed {
  const { rsn, label, tabs, diff, shareUrl } = opts;
  const totalValue = tabs.reduce((s, t) => s + t.value, 0);
  const totalItems = tabs.reduce((s, t) => s + t.items.length, 0);

  const title = rsn
    ? `${rsn} updated their bank`
    : "Bank updated";

  const valueDelta = diff
    ? diff.totalValueAfter - diff.totalValueBefore
    : 0;
  const up = valueDelta >= 0;
  const color = !diff
    ? SCAPESTACK_GOLD
    : up ? GREEN : RED;

  const fields: DiscordEmbed["fields"] = [];

  // Net worth + delta
  let netWorthValue = `**${formatGpCompact(totalValue)} gp**`;
  if (diff && valueDelta !== 0) {
    const sign = up ? "+" : "";
    netWorthValue += `\n${sign}${formatGpCompact(Math.abs(valueDelta))} gp ${up ? "📈" : "📉"}`;
  }
  fields.push({ name: "Net worth", value: netWorthValue, inline: true });

  fields.push({ name: "Items", value: `${totalItems}`, inline: true });
  fields.push({ name: "Tabs", value: `${tabs.length}`, inline: true });

  // Top gains
  if (diff && diff.added.length + diff.changedQuantity.filter((c) => c.delta > 0).length > 0) {
    const additions = [
      ...diff.added.map((it) => ({ name: it.name, gain: it.quantity, value: it.stackValue })),
      ...diff.changedQuantity.filter((c) => c.delta > 0).map((c) => ({ name: c.name, gain: c.delta, value: c.deltaValue }))
    ]
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    if (additions.length > 0) {
      fields.push({
        name: "Top gains",
        value: additions
          .map((a) => `• ${a.name} **+${a.gain.toLocaleString()}** (${formatGpCompact(a.value)} gp)`)
          .join("\n"),
        inline: false
      });
    }
  }

  // Top losses (only when meaningful)
  if (diff && diff.removed.length + diff.changedQuantity.filter((c) => c.delta < 0).length > 0) {
    const losses = [
      ...diff.removed.map((it) => ({ name: it.name, loss: it.quantity, value: it.stackValue })),
      ...diff.changedQuantity.filter((c) => c.delta < 0).map((c) => ({ name: c.name, loss: -c.delta, value: -c.deltaValue }))
    ]
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);

    if (losses.length > 0) {
      fields.push({
        name: "Spent / lost",
        value: losses
          .map((l) => `• ${l.name} **-${l.loss.toLocaleString()}** (${formatGpCompact(l.value)} gp)`)
          .join("\n"),
        inline: false
      });
    }
  }

  // Top valuable item — thumbnail
  const sorted = tabs.flatMap((t) => t.items).sort((a, b) => b.stackValue - a.stackValue);
  const topItem = sorted[0];
  const thumbnail = topItem && topItem.stackValue >= 100_000
    ? { url: absoluteSpriteUrl(topItem.id, shareUrl) }
    : undefined;

  const footer = label
    ? { text: `${label} · via Scapestack` }
    : { text: "via Scapestack" };

  return {
    title,
    color,
    fields,
    thumbnail,
    url: shareUrl,
    footer,
    timestamp: new Date().toISOString()
  };
}

// ── Send ────────────────────────────────────────────────────────────────────

export interface SendResult {
  ok: boolean;
  status?: number;
  error?: string;
  throttled?: boolean;
  nextAt?: number;
}

export async function sendBankUpdate(
  config: WebhookConfig,
  opts: BuildOptions,
  options: { ignoreThrottle?: boolean } = {}
): Promise<SendResult> {
  if (!config.enabled || !config.url) {
    return { ok: false, error: "Webhook disabled or no URL configured" };
  }
  if (!isValidDiscordWebhook(config.url)) {
    return { ok: false, error: "URL doesn't look like a Discord webhook" };
  }
  if (!options.ignoreThrottle) {
    const t = shouldThrottle();
    if (t.throttled) return { ok: false, throttled: true, nextAt: t.nextAt };
  }

  const embed = buildEmbed(opts);
  const payload = {
    username: BRAND_NAME,
    avatar_url: brandUrl("/coin.png"), // graceful 404 fallback
    embeds: [embed]
  };

  try {
    const res = await fetch(config.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      markSent();
      return { ok: true, status: res.status };
    }
    let detail = "";
    try {
      const body = await res.text();
      detail = body.slice(0, 200);
    } catch {}
    return { ok: false, status: res.status, error: detail || `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

// Test ping — sends a minimal "hello" embed so user can verify.
export async function pingWebhook(url: string): Promise<SendResult> {
  if (!isValidDiscordWebhook(url)) {
    return { ok: false, error: "URL doesn't look like a Discord webhook" };
  }
  const payload = {
    username: BRAND_NAME,
    embeds: [{
      title: "Webhook test ping",
      description: "Scapestack will post your bank updates here. You can disable this anytime in Gear & Bank.",
      color: SCAPESTACK_GOLD,
      footer: { text: "via Scapestack" },
      timestamp: new Date().toISOString()
    }]
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) return { ok: true, status: res.status };
    const detail = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: detail.slice(0, 200) || `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}
