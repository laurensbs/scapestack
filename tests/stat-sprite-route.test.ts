import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/sprite/stat/[slug]/route";

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

function context(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

describe("identity stat sprite route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["combat.png", "Combat_icon.png"],
    ["total-level.png", "Stats_icon.png"],
    ["quests.png", "Quest_point_icon.png"],
    ["diaries.png", "Achievement_Diaries_icon.png"],
    ["collection-log.png", "Collection_log.png"]
  ])("proxies the verified wiki filename for %s", async (slug, filename) => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(PNG_BYTES, {
        status: 200,
        headers: { "content-type": "image/png" }
      })
    );

    const response = await GET(
      new Request(`http://local.test/api/sprite/stat/${slug}`),
      context(slug)
    );

    expect(response.headers.get("cache-control"))
      .toBe("public, max-age=604800, stale-while-revalidate=2592000");
    expect(response.headers.get("x-scapestack-stat-icon-source")).toBe("osrs-wiki");
    expect(fetchMock).toHaveBeenCalledWith(
      `https://oldschool.runescape.wiki/images/${filename}`,
      expect.objectContaining({
        headers: {
          "user-agent": "scapestack/0.6 (+https://www.scapestack.org)"
        },
        next: { revalidate: 60 * 60 * 24 * 7 },
        signal: expect.any(AbortSignal)
      })
    );
  });

  it("returns a transparent generated SVG when a known wiki icon is forced to 404", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("missing", {
        status: 404,
        headers: { "content-type": "text/html" }
      })
    );

    const response = await GET(
      new Request("http://local.test/api/sprite/stat/combat.png?force404=1"),
      context("combat.png")
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    expect(response.headers.get("x-scapestack-stat-icon-source")).toBe("generated-fallback");
    expect(body).toContain("combat icon unavailable");
    expect(body).not.toContain("<rect");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("Scapestack_forced_missing_identity_icon.png"),
      expect.any(Object)
    );
  });

  it("does not fetch arbitrary filenames", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const response = await GET(
      new Request("http://local.test/api/sprite/stat/total-xp.png"),
      context("total-xp.png")
    );

    expect(response.headers.get("x-scapestack-stat-icon-source")).toBe("generated-fallback");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
