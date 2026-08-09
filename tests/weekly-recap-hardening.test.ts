import { describe, expect, it } from "vitest";
import { readAccountSessionToken } from "@/lib/account-session-cookie";
import { isDiscordWebhookUrl } from "@/lib/discord-webhook";
import { compactXp, displayPercent, recapHeadline, textProgressBar, type RecapWeek } from "@/lib/weekly-recap";

/**
 * The defects an adversarial pass over Phase 1 confirmed, each with the guard
 * that would have caught it. Everything here failed before the fix.
 */

function week(overrides: Partial<RecapWeek> = {}): RecapWeek {
  return {
    rsn: "lauky",
    weekStart: "2026-08-03",
    xpGained: 130_000,
    levelsGained: 0,
    levelUps: [],
    kcGained: {},
    clogSlotsGained: 0,
    goal: { target: "99 Slayer", pctBefore: 99.4, pctAfter: 99.9, remainder: "4k XP" },
    nextStepUrl: "https://www.scapestack.org/r/tok",
    ...overrides
  };
}

describe("a goal that is not finished is never announced as finished", () => {
  it("does not round 99.9% up to 100%", () => {
    // The bar's cells were floored and its label was not, so the same
    // component drew nine cells and wrote "100%". The headline used the same
    // rounding and produced: "You're now 100% to your 99 Slayer. 4k XP to go."
    expect(displayPercent(99.9)).toBe(99);
    expect(textProgressBar(99.9)).toBe("▓▓▓▓▓▓▓▓▓░ 99%");
    expect(recapHeadline(week())).toContain("You're now 99% to your 99 Slayer");
    expect(recapHeadline(week())).not.toContain("100%");
  });

  it("still says 100% when it really is done", () => {
    expect(displayPercent(100)).toBe(100);
    expect(textProgressBar(100)).toBe("▓▓▓▓▓▓▓▓▓▓ 100%");
  });

  it("does not disagree with itself: a full bar always reads 100%", () => {
    for (let pct = 0; pct <= 100; pct += 0.1) {
      const bar = textProgressBar(pct);
      const full = bar.startsWith("▓▓▓▓▓▓▓▓▓▓");
      const label = Number(bar.match(/(\d+)%$/)![1]);
      expect(full === (label === 100), `${pct} -> ${bar}`).toBe(true);
    }
  });
});

describe("XP is printed in a unit players use", () => {
  it("never writes 1000k", () => {
    expect(compactXp(999_600)).toBe("1M");
    expect(compactXp(999_499)).toBe("999k");
    expect(compactXp(1_000_000)).toBe("1M");
  });
});

describe("the webhook allowlist bounds the port, not just the host", () => {
  it("refuses a port Discord does not answer on", () => {
    // discord.com:1337 passes hostname, scheme and path — and is dropped
    // rather than refused, so the connection hangs until the 8s abort. One
    // such webhook costs the Sunday job 8 seconds every week forever.
    const base = "/api/webhooks/1234567890123456789/abcdefghijklmnopqrstuvwxyz0123456789";
    expect(isDiscordWebhookUrl(`https://discord.com${base}`)).toBe(true);
    expect(isDiscordWebhookUrl(`https://discord.com:1337${base}`)).toBe(false);
    expect(isDiscordWebhookUrl(`https://discord.com:80${base}`)).toBe(false);
    // :443 is https's own default, which URL normalises away — so this is not
    // an explicit port at all, and refusing it would refuse Discord.
    expect(isDiscordWebhookUrl(`https://discord.com:443${base}`)).toBe(true);
  });
});

describe("a corrupted session cookie is no session, not a 500", () => {
  it("survives a malformed escape", () => {
    // A lone "%" made decodeURIComponent throw, which 500'd all seven account
    // routes — and the 401 branch that clears the bad cookie was never
    // reached, so the player was locked out with no way back from the site.
    const read = (cookie: string) =>
      readAccountSessionToken(new Request("https://www.scapestack.org/api/account/me", {
        headers: { cookie }
      }));
    expect(read("scapestack_account=%")).toBeNull();
    expect(read("scapestack_account=abc%zz")).toBeNull();
    expect(read("scapestack_account=real-token")).toBe("real-token");
    expect(read("scapestack_account=tok%20en")).toBe("tok en");
  });
});
