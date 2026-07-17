import { beforeEach, describe, expect, it, vi } from "vitest";

const getPriceSnapshot = vi.fn();
const priceFor = vi.fn((prices: Map<number, number>, id: number) => prices.get(id) ?? 0);

vi.mock("@/lib/prices", () => ({ getPriceSnapshot, priceFor }));

describe("GET /api/prices", () => {
  beforeEach(() => {
    getPriceSnapshot.mockReset();
    priceFor.mockClear();
  });

  it("returns requested live values with provenance", async () => {
    getPriceSnapshot.mockResolvedValue({
      prices: new Map([[12926, 2_400_000]]),
      sourceUrl: "https://prices.runescape.wiki/api/v1/osrs/latest",
      retrievedAt: "2026-07-17T12:00:00.000Z",
      freshness: "fresh",
      fallbackUsed: false
    });
    const { GET } = await import("@/app/api/prices/route");
    const response = await GET(new Request("https://scapestack.org/api/prices?ids=12926"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      values: { "12926": 2_400_000 },
      freshness: "fresh",
      fallbackUsed: false
    });
  });

  it("rejects missing item ids without calling the upstream feed", async () => {
    const { GET } = await import("@/app/api/prices/route");
    const response = await GET(new Request("https://scapestack.org/api/prices"));
    expect(response.status).toBe(400);
    expect(getPriceSnapshot).not.toHaveBeenCalled();
  });
});
