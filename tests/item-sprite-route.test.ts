import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/sprite/item/[id]/route";

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("item sprite route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses clean item IDs from .png route segments", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(PNG_BYTES, {
        status: 200,
        headers: { "content-type": "image/png" }
      })
    );

    const response = await GET(new Request("http://local.test/api/sprite/item/4151.png"), context("4151.png"));

    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("public, max-age=604800, stale-while-revalidate=2592000");
    expect(response.headers.get("x-scapestack-sprite-source")).toBe("primary");
    expect(response.headers.get("x-scapestack-sprite-id")).toBe("4151");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://chisel.weirdgloop.org/static/img/osrs-sprite/4151.png",
      expect.objectContaining({
        signal: expect.any(AbortSignal)
      })
    );
  });

  it("returns a branded unknown-item SVG when the primary item is missing", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 404 }));

    const response = await GET(new Request("http://local.test/api/sprite/item/999999.png"), context("999999.png"));
    const body = await response.text();

    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    expect(response.headers.get("cache-control")).toBe("public, max-age=86400");
    expect(response.headers.get("x-scapestack-sprite-source")).toBe("generated-fallback");
    expect(response.headers.get("x-scapestack-missing-sprite-id")).toBe("999999");
    expect(response.headers.get("x-scapestack-sprite-label")).toBe("Item 999999 sprite unavailable");
    expect(body).toContain("?");
    expect(body).toContain("#999999");
    expect(body).toContain("Item 999999 sprite unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns the branded unknown-item SVG when the primary sprite request times out or throws", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("sprite CDN timeout"));

    const response = await GET(new Request("http://local.test/api/sprite/item/4151.png"), context("4151.png"));
    const body = await response.text();

    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    expect(response.headers.get("x-scapestack-sprite-source")).toBe("generated-fallback");
    expect(response.headers.get("x-scapestack-missing-sprite-id")).toBe("4151");
    expect(response.headers.get("x-scapestack-sprite-label")).toBe("Item 4151 sprite unavailable");
    expect(body).toContain("#86A6D9");
    expect(body).toContain("#4151");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns the branded SVG fallback for invalid IDs without fetching", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const response = await GET(new Request("http://local.test/api/sprite/item/nope.png"), context("nope.png"));
    const body = await response.text();

    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    expect(response.headers.get("x-scapestack-sprite-source")).toBe("generated-fallback");
    expect(response.headers.get("x-scapestack-sprite-label")).toBe("Unknown item sprite unavailable");
    expect(body).toContain("#86A6D9");
    expect(body).toContain("ID ?");
    expect(body).toContain("Unknown item sprite unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
