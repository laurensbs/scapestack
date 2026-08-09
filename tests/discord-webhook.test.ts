import { describe, expect, it, vi } from "vitest";
import { isDiscordWebhookUrl, postDiscordWebhook, redactWebhookUrl } from "@/lib/discord-webhook";

const REAL = "https://discord.com/api/webhooks/1234567890123456789/abcdefghijklmnopqrstuvwxyz0123456789";

describe("the server only ever dials Discord", () => {
  it("accepts Discord's own webhook URLs", () => {
    expect(isDiscordWebhookUrl(REAL)).toBe(true);
    expect(isDiscordWebhookUrl(REAL.replace("discord.com", "discordapp.com"))).toBe(true);
    expect(isDiscordWebhookUrl(REAL.replace("/api/", "/api/v10/"))).toBe(true);
  });

  it("refuses anything else a player could paste", () => {
    // This field is typed in by a player, so every request made with it is a
    // request an outsider chose. Scapestack runs next to a metadata endpoint
    // and a database on a private network.
    const attacks = [
      "http://discord.com/api/webhooks/1234567890123456789/abcdefghijklmnopqrstuvwxyz0123456789",
      "https://169.254.169.254/latest/meta-data/",
      "http://localhost:5432/",
      "https://discord.com.evil.test/api/webhooks/1234567890123456789/abcdefghijklmnopqrstuvwxyz0123456789",
      "https://discord.com@evil.test/api/webhooks/1234567890123456789/abcdefghijklmnopqrstuvwxyz0123456789",
      "https://discord.com/api/guilds/1234567890123456789/bans",
      "file:///etc/passwd",
      "not a url at all",
      ""
    ];
    for (const attack of attacks) {
      expect(isDiscordWebhookUrl(attack), attack).toBe(false);
    }
  });

  it("never posts to a URL it rejected", async () => {
    const fetchImpl = vi.fn();
    const result = await postDiscordWebhook("https://169.254.169.254/latest/", {}, fetchImpl as never);
    expect(result).toEqual({ status: "rejected", reason: "not-a-discord-webhook" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not follow a redirect out of the allowlist", async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 }));
    await postDiscordWebhook(REAL, {}, fetchImpl as never);
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ redirect: "manual" });
  });
});

describe("a webhook URL is a credential", () => {
  it("is never rendered in full", () => {
    const redacted = redactWebhookUrl(REAL);
    expect(redacted).not.toContain("abcdefghijklmnopqrstuvwxyz");
    expect(redacted).toContain("discord.com");
  });
});

describe("what Discord answers decides whether to try again", () => {
  it("treats a deleted webhook as gone rather than as a failure to retry", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 404 }));
    expect(await postDiscordWebhook(REAL, {}, fetchImpl as never)).toEqual({ status: "gone" });
  });

  it("treats a 500 as worth another Sunday", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 500 }));
    expect(await postDiscordWebhook(REAL, {}, fetchImpl as never)).toEqual({ status: "failed", code: 500 });
  });

  it("survives a network error instead of taking the job down", async () => {
    const fetchImpl = vi.fn(async () => { throw new Error("ECONNRESET"); });
    expect(await postDiscordWebhook(REAL, {}, fetchImpl as never)).toEqual({ status: "failed", code: null });
  });
});
