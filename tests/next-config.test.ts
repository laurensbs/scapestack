import { describe, expect, it } from "vitest";
import config from "../next.config";

describe("Next deployment config", () => {
  it("keeps the OSRS sprite CDN as the only remote image host", () => {
    expect(config.images?.remotePatterns).toEqual([
      { protocol: "https", hostname: "chisel.weirdgloop.org" }
    ]);
  });

  it("sets security headers across public pages", async () => {
    const headers = await config.headers?.();
    const globalHeaders = headers?.find((entry) => entry.source === "/:path*")?.headers;

    expect(globalHeaders).toEqual(expect.arrayContaining([
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
      }
    ]));
  });

  it("caches generated public metadata and sprite proxy assets", async () => {
    const headers = await config.headers?.();
    const cachedSources = headers
      ?.filter((entry) => entry.headers.some((header) => header.key === "Cache-Control"))
      .map((entry) => entry.source);

    expect(cachedSources).toEqual([
      "/api/sprite/item/:path*",
      "/icon",
      "/apple-icon",
      "/opengraph-image",
      "/manifest.webmanifest",
      "/robots.txt",
      "/sitemap.xml"
    ]);
    expect(headers?.find((entry) => entry.source === "/api/sprite/item/:path*")?.headers).toContainEqual({
      key: "Cache-Control",
      value: "public, max-age=86400, stale-while-revalidate=604800"
    });
  });
});
