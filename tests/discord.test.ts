import { afterEach, describe, expect, it, vi } from "vitest";
import { sendBankUpdate } from "@/lib/discord";
import { BRAND_NAME, brandUrl } from "@/lib/brand";
import type { OrganizedTab } from "@/lib/organizer";

function tab(items: OrganizedTab["items"]): OrganizedTab {
  return {
    name: "Combat",
    iconItemId: 4151,
    items,
    layout: {},
    quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    value: items.reduce((sum, item) => sum + item.stackValue, 0)
  };
}

describe("discord webhook embeds", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the shared share URL origin for item thumbnails", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 })
    );

    const result = await sendBankUpdate(
      {
        enabled: true,
        url: "https://discord.com/api/webhooks/123/token"
      },
      {
        shareUrl: "https://preview.example/bank/share/abc",
        tabs: [
          tab([
            {
              id: 11802,
              name: "Armadyl godsword",
              quantity: 1,
              unitPrice: 10_000_000,
              stackValue: 10_000_000,
              subtab: "Spec weapons",
              slot: null,
              weight: 0
            }
          ])
        ]
      },
      { ignoreThrottle: true }
    );

    expect(result.ok).toBe(true);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.embeds[0].thumbnail.url).toBe("https://preview.example/api/sprite/item/11802.png");
    expect(body.username).toBe(BRAND_NAME);
    expect(body.avatar_url).toBe(brandUrl("/coin.png"));
  });

  it("falls back to the production brand domain without a share URL", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 })
    );

    const result = await sendBankUpdate(
      {
        enabled: true,
        url: "https://discord.com/api/webhooks/123/token"
      },
      {
        tabs: [
          tab([
            {
              id: 11802,
              name: "Armadyl godsword",
              quantity: 1,
              unitPrice: 10_000_000,
              stackValue: 10_000_000,
              subtab: "Spec weapons",
              slot: null,
              weight: 0
            }
          ])
        ]
      },
      { ignoreThrottle: true }
    );

    expect(result.ok).toBe(true);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.embeds[0].thumbnail.url).toBe("https://www.scapestack.org/api/sprite/item/11802.png");
  });
});
