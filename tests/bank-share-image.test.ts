import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

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

  it("renders set, missing pieces, exact cost and verdict from the stored snapshot", async () => {
    const { BankShareCard } = await import("@/app/share/bank/[shareId]/opengraph-image");
    const html = renderToStaticMarkup(createElement(BankShareCard, {
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
    }));

    expect(html).toContain("SET");
    expect(html).toContain("MISSING");
    expect(html).toContain("COST");
    expect(html).toContain("VERDICT");
    expect(html).toContain("Ahrim&#x27;s set 2/4");
    expect(html).toContain("Ahrim&#x27;s hood, Ahrim&#x27;s staff");
    expect(html).toContain("1,840,123 gp");
    expect(html).toContain("Buy now");
  });
});
