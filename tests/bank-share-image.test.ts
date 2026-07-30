import { describe, expect, it, vi } from "vitest";

const shareId = "AbCdEfGhIjKlMnOpQrStUvWx";

vi.mock("@/app/share/bank/[shareId]/data", () => ({
  loadPublicBankShare: async (id: string) => id === shareId
    ? {
        shareId,
        publishedAt: "2026-07-30T10:02:00.000Z",
        snapshot: {
          version: 1,
          displayName: "Lauky",
          gp: 12_000_000,
          rows: [{
            setName: "Ahrim's set",
            owned: 2,
            total: 4,
            missing: ["Ahrim's hood", "Ahrim's staff"],
            cost: 1_840_123,
            verdict: "Buy now",
            gate: "ready"
          }],
          sourceSyncedAt: "2026-07-30T10:00:00.000Z",
          pricedAt: "2026-07-30T10:01:00.000Z"
        }
      }
    : null
}));

describe("public bank OpenGraph image", () => {
  it("renders the stored affordability table as a PNG response", async () => {
    const { default: BankShareOpenGraphImage, contentType, size } = await import("@/app/share/bank/[shareId]/opengraph-image");
    const response = await BankShareOpenGraphImage({ params: Promise.resolve({ shareId }) });
    const png = await response.arrayBuffer();

    expect(contentType).toBe("image/png");
    expect(size).toEqual({ width: 1200, height: 630 });
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(png.byteLength).toBeGreaterThan(5_000);
    expect(Array.from(new Uint8Array(png.slice(0, 8)))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });
});
