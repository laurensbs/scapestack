import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AccountCoverageLine } from "@/components/account-coverage-line";
import { FarmTimersLine } from "@/components/farm-timers-line";
import { redactSyncedPlayer } from "@/lib/synced-player-visibility";
import type { SyncedPlayer } from "@/lib/sync-repo";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

describe("one coverage line, three honest states", () => {
  it("offers pairing when a sync exists but this browser is not the paired one", () => {
    // The state that had no representation at all before 2026-08-08: /p said
    // "synced 9 days ago" and "Hiscores only" in the same breath, because the
    // header reads the row and identity reads the cookie.
    const html = renderToStaticMarkup(createElement(AccountCoverageLine, {
      rsn: "lauky",
      state: { kind: "synced-unpaired", syncedLabel: "synced 9 days ago" }
    }));
    expect(html).toContain("This is me");
    expect(html).toContain("data-pair-this-browser");
    expect(html).toContain("synced 9 days ago");
    // formatSyncAge already carries the verb — the sentence must not add a
    // second one. "RuneLite synced this account synced 9 days ago" shipped for
    // one deploy. Strip the markup first: the data attribute legitimately
    // contains "synced-unpaired" and made the first version of this guard
    // match itself.
    const sentence = html.replace(/<[^>]+>/g, " ");
    expect(sentence, "the sync verb appears twice in one sentence")
      .not.toMatch(/synced[^.]*\bsynced\b/);
    // It must not tell a synced player to go install the plugin again.
    expect(html).not.toContain("Hiscores only");
  });

  it("says hiscores-only only when there is genuinely no row", () => {
    const html = renderToStaticMarkup(createElement(AccountCoverageLine, {
      rsn: "lauky",
      state: { kind: "hiscores-only", syncHref: "/plugin?rsn=lauky" }
    }));
    expect(html).toContain("Hiscores only");
    expect(html).not.toContain("This is me");
  });

  it("names what the last scan missed, for the paired owner", () => {
    const html = renderToStaticMarkup(createElement(AccountCoverageLine, {
      rsn: "lauky",
      state: { kind: "paired", syncedLabel: "synced 4 min ago", missing: ["bank", "collection log"] }
    }));
    expect(html).toContain("Hiscores + RuneLite");
    expect(html).toContain("not in that scan: bank, collection log");
  });

  it("never nests its paragraph inside another paragraph", () => {
    // The coverage node renders its own <p>. PlayerIdentityBand used to wrap
    // whatever it was given in a <p> too, and a <p> inside a <p> is auto-closed
    // by the parser — server HTML and client DOM disagreed and React threw
    // hydration error #418 on every /u render. 1,738 unit tests saw nothing;
    // the e2e that opens the page failed instantly.
    const band = read("src/components/player-identity-band.tsx");
    const slot = band.slice(band.indexOf("{coverage ? ("), band.indexOf("{coverage ? (") + 320);
    expect(slot, "the coverage slot must not be a <p>").not.toMatch(/<p[\s>]/);
    expect(slot).toContain("data-account-coverage");
  });

  it("is the only coverage voice on both routes", () => {
    // Each route used to compose its own sentence, which is how they drifted.
    for (const route of ["src/app/p/[rsn]/page.tsx", "src/app/u/[rsn]/page.tsx"]) {
      const source = read(route);
      expect(source, `${route} must use the shared line`).toContain("AccountCoverageLine");
      expect(source, `${route} still hand-writes a coverage sentence`)
        .not.toContain("Hiscores + RuneLite —");
    }
  });
});

describe("the farm timer is the return reason, and it is owner-only", () => {
  const patches = [
    { patch: "Ardougne herb", crop: "Ranarr", state: "ready", readyAt: null },
    { patch: "Catherby herb", crop: "Snapdragon", state: "growing", readyAt: new Date(Date.now() + 80 * 60_000).toISOString() },
    { patch: "Falador tree", crop: "Yew", state: "diseased", readyAt: null }
  ];

  it("renders the clock, the count and the losses", () => {
    const html = renderToStaticMarkup(createElement(FarmTimersLine, { patches, rsn: "lauky" }));
    expect(html).toContain("Your farm");
    expect(html).toContain("1 patch ready");
    expect(html).toContain("1 diseased or dead");
  });

  it("renders nothing when there is nothing to say", () => {
    expect(renderToStaticMarkup(createElement(FarmTimersLine, { patches: [], rsn: "lauky" }))).toBe("");
    const unseen = [{ patch: "Ardougne herb", crop: null, state: "empty", readyAt: null }];
    expect(renderToStaticMarkup(createElement(FarmTimersLine, { patches: unseen, rsn: "lauky" }))).toBe("");
  });

  it("never reaches a viewer who is not the paired browser", () => {
    // A farm timer says when someone plays. redactSyncedPlayer strips it, and
    // /p may only read it from exactSync — which requires the session cookie.
    const player = {
      rsn: "lauky", displayName: "lauky", accountType: "ironman",
      skills: [], questsCompleted: [], diariesCompleted: [], collectionLogItemIds: [],
      bankItems: [], bankStatus: { enabled: true, itemCount: 0, unavailableReason: null, capturedAt: null },
      slayer: null, farming: patches, pluginVersion: "0.4.0", lastSyncSummary: null,
      syncedAt: "2026-08-08T12:00:00.000Z"
    } as unknown as SyncedPlayer;
    expect(redactSyncedPlayer(player).farming).toBeNull();
    const page = read("src/app/p/[rsn]/page.tsx");
    expect(page).toContain("exactSync?.availability?.farming");
    expect(page, "farming must never be read off the unredacted context")
      .not.toContain("context.scapestackSync?.farming");
  });

  it("formats the countdown in the browser, so an open tab cannot lie", () => {
    const source = read("src/components/farm-timers-line.tsx");
    expect(source).toContain('"use client"');
    expect(source).toContain("setInterval");
    // Date.now() during render would differ between the server and client
    // passes and hydrate mismatched.
    expect(source).toContain("useState(0)");
  });

  it("adds no fourth section to a page budgeted at three", () => {
    const page = read("src/app/p/[rsn]/page.tsx");
    const farm = read("src/components/farm-timers-line.tsx");
    // It rides in the existing lastTrip slot and renders an <aside>.
    expect(page).toContain("<FarmTimersLine");
    expect(farm).toContain("<aside");
    expect(farm).not.toContain("<section");
  });
});
