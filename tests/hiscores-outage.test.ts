import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Observed on production 2026-08-08, minutes after a deploy: /p/lauky answered
 * 404, then 200 a few seconds later. The player existed the whole time — the
 * Jagex hiscores endpoint did not answer, and the page folded "the fetch
 * failed" into "this player does not exist".
 *
 * The negative these tests can produce: mock the hiscores fetch failing and
 * the page must NOT call notFound(). A real Jagex 404 still must.
 */

class NotFoundSignal extends Error {
  constructor() {
    super("not-found");
  }
}

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFoundSignal();
  },
  redirect: (destination: string) => {
    throw new Error(`redirect:${destination}`);
  },
  useRouter: () => ({ refresh: () => {} })
}));

// The pages must resolve every source without a database and without real
// network. With DATABASE_URL absent, sync and pairing reads answer null
// immediately instead of dialing Neon.
delete process.env.DATABASE_URL;

type FetchHandler = (url: string) => Promise<Response>;

function stubFetch(handler: FetchHandler) {
  vi.spyOn(globalThis, "fetch").mockImplementation(
    (input) => handler(String(input)) as Promise<Response>
  );
}

const hiscoresDown: FetchHandler = async (url) => {
  if (url.includes("hiscore_oldschool")) return new Response(null, { status: 503 });
  throw new Error("network down");
};

const networkDown: FetchHandler = async () => {
  throw new Error("ECONNRESET");
};

const playerMissing: FetchHandler = async (url) => {
  if (url.includes("hiscore_oldschool")) return new Response(null, { status: 404 });
  throw new Error("network down");
};

// The adversarial pass found this one: an incident page shaped like JSON.
// A 200 whose body has no skills table answered nothing about the player.
const answerShapedHole: FetchHandler = async (url) => {
  if (url.includes("hiscore_oldschool")) return Response.json({});
  throw new Error("network down");
};

const playerFound: FetchHandler = async (url) => {
  if (url.includes("hiscore_oldschool")) {
    return Response.json({
      name: "Lauky",
      skills: [{ id: 0, name: "Overall", rank: 1, level: 2277, xp: 4_600_000_000 }],
      activities: []
    });
  }
  throw new Error("network down");
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("a hiscores outage is not a missing player", () => {
  it("/p renders the retry state, not the 404, when Jagex answers 503", async () => {
    stubFetch(hiscoresDown);
    const PlayerPage = (await import("@/app/p/[rsn]/page")).default;

    const element = await PlayerPage({ params: Promise.resolve({ rsn: "lauky" }) });

    const html = renderToStaticMarkup(element);
    expect(html).toContain("data-hiscores-retry");
    expect(html).toContain('data-hiscores-retry-cause="hiscores"');
    expect(html).toContain("<button");
    // A transient failure wearing a real player's URL must not be indexed
    // as that player's page — it ships as a 200.
    expect(html).toContain('name="robots"');
    expect(html).toContain("noindex");
  });

  it("/p renders the retry state when Jagex answers 200 without a skills table", async () => {
    stubFetch(answerShapedHole);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const PlayerPage = (await import("@/app/p/[rsn]/page")).default;

    const element = await PlayerPage({ params: Promise.resolve({ rsn: "lauky" }) });

    // Before the shape check this rendered a full profile claiming "0 total"
    // — the production symptom in a different Jagex failure mode.
    const html = renderToStaticMarkup(element);
    expect(html).toContain("data-hiscores-retry");
  });

  it("/u renders the retry state, not the 404, when the fetch itself dies", async () => {
    stubFetch(networkDown);
    const ProfilePage = (await import("@/app/u/[rsn]/page")).default;

    const element = await ProfilePage({ params: Promise.resolve({ rsn: "lauky" }) });

    const html = renderToStaticMarkup(element);
    expect(html).toContain("data-hiscores-retry");
    expect(html).toContain("<button");
  });

  it("/p still 404s a player Jagex itself answers 404 for", async () => {
    stubFetch(playerMissing);
    const PlayerPage = (await import("@/app/p/[rsn]/page")).default;

    await expect(
      PlayerPage({ params: Promise.resolve({ rsn: "notaplayer" }) })
    ).rejects.toBeInstanceOf(NotFoundSignal);
  });
});

describe("loadPlanningContext names the failure kind", () => {
  it.each([
    ["a 503", hiscoresDown],
    ["a dead socket", networkDown]
  ])("%s comes out as unavailable, with hiscores null", async (_label, handler) => {
    stubFetch(handler);
    const { loadPlanningContext } = await import("@/lib/planning-context");

    const context = await loadPlanningContext("lauky");

    expect(context.hiscores).toBeNull();
    expect(context.hiscoresState).toBe("unavailable");
  });

  it("a Jagex 404 comes out as not_on_hiscores", async () => {
    stubFetch(playerMissing);
    const { loadPlanningContext } = await import("@/lib/planning-context");

    const context = await loadPlanningContext("notaplayer");

    expect(context.hiscores).toBeNull();
    expect(context.hiscoresState).toBe("not_on_hiscores");
  });

  it("a ranked player comes out as found", async () => {
    stubFetch(playerFound);
    const { loadPlanningContext } = await import("@/lib/planning-context");

    const context = await loadPlanningContext("lauky");

    expect(context.hiscores?.name).toBe("Lauky");
    expect(context.hiscoresState).toBe("found");
  });

  it("a hiscores deadline miss is unavailable, not a missing player", async () => {
    stubFetch(async (url) => {
      if (url.includes("hiscore_oldschool")) return new Promise<Response>(() => {});
      throw new Error("network down");
    });
    const { loadPlanningContext } = await import("@/lib/planning-context");

    const context = await loadPlanningContext("lauky");

    expect(context.hiscoresState).toBe("unavailable");
  });

  it("a 200 without a skills table is unavailable, not a found player", async () => {
    stubFetch(answerShapedHole);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { loadPlanningContext } = await import("@/lib/planning-context");

    const context = await loadPlanningContext("lauky");

    expect(context.hiscores).toBeNull();
    expect(context.hiscoresState).toBe("unavailable");
  });
});

describe("/next tells the outage as an outage", () => {
  // The /next rerun path goes through a client transition that the browser
  // pane could not be made to paint, so this guard is source-level: the
  // unavailable branch must exist and must win from the not-found preview,
  // which asserts "No Hiscores entry for {rsn}" — only true for a Jagex 404.
  // Negative: deleting the branch moves setView("not-found") first and fails.
  it("branches on hiscoresState before the not-found preview", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(process.cwd(), "src/app/next/next-client.tsx"),
      "utf8"
    );

    const branch = source.indexOf('planningContext?.hiscoresState === "unavailable"');
    const notFoundView = source.indexOf('setNotFoundRsn(rsn)');
    expect(branch).toBeGreaterThan(-1);
    expect(notFoundView).toBeGreaterThan(-1);
    expect(branch).toBeLessThan(notFoundView);
    expect(source).toContain("The hiscores didn't answer");
  });
});

describe("the loader's own failure is not a Jagex story", () => {
  it("renders the internal-cause retry state and logs the error", async () => {
    // The loader cannot reject because of the hiscores — those are bounded
    // and classified inside it. So a rejection is Scapestack's own bug, and
    // the page it renders must not carry the Jagex-blaming copy.
    vi.resetModules();
    vi.doMock("@/lib/planning-context", () => ({
      loadPlanningContext: async () => {
        throw new Error("planner exploded");
      },
      PLANNING_SOURCE_DEADLINES_MS: { hiscores: 900 }
    }));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    stubFetch(playerFound);

    const PlayerPage = (await import("@/app/p/[rsn]/page")).default;
    const playerHtml = renderToStaticMarkup(
      await PlayerPage({ params: Promise.resolve({ rsn: "lauky" }) })
    );
    const ProfilePage = (await import("@/app/u/[rsn]/page")).default;
    const profileHtml = renderToStaticMarkup(
      await ProfilePage({ params: Promise.resolve({ rsn: "lauky" }) })
    );

    for (const html of [playerHtml, profileHtml]) {
      expect(html).toContain('data-hiscores-retry-cause="internal"');
      expect(html).not.toContain("Jagex&#x27;s end");
    }
    expect(errorSpy).toHaveBeenCalledWith(
      "scapestack.planning_context_failed",
      expect.any(Error)
    );

    vi.doUnmock("@/lib/planning-context");
    vi.resetModules();
  });
});
