import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
  }
];

const PUBLIC_ASSET_CACHE_HEADERS = [
  {
    key: "Cache-Control",
    value: "public, max-age=86400, stale-while-revalidate=604800"
  }
];

const config: NextConfig = {
  turbopack: { root },
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "chisel.weirdgloop.org" }
    ]
  },
  async redirects() {
    // Six retired routes. These were route DIRECTORIES — page.tsx files whose
    // entire body was permanentRedirect() — which made them look like product
    // surfaces in the tree and in the nav while serving a 308. A UI review
    // called that "a nav promising six tools where three do not exist". The
    // bounce belongs in config, not in components.
    //
    // Targets mirror the old legacyRouteNextHref mapping so cached links and
    // search results keep landing somewhere sensible.
    return [
      { source: "/gp", destination: "/next?intent=cash&time=30", permanent: true },
      { source: "/ge", destination: "/next?intent=cash&time=15", permanent: true },
      { source: "/quests", destination: "/next?intent=quest&time=120", permanent: true },
      { source: "/diary", destination: "/next?intent=quest&time=60", permanent: true },
      { source: "/skills", destination: "/next?intent=skill&time=60", permanent: true },
      // /hiscore was a whole lookup page, not a redirect — but hiscore lookup
      // is served better by the official Hiscores, WOM and TempleOSRS, and the
      // page existed mostly to feed the tool registry that fed it.
      { source: "/hiscore", destination: "/next", permanent: true }
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS
      },
      {
        source: "/api/sprite/item/:path*",
        headers: PUBLIC_ASSET_CACHE_HEADERS
      },
      {
        source: "/icon",
        headers: PUBLIC_ASSET_CACHE_HEADERS
      },
      {
        source: "/apple-icon",
        headers: PUBLIC_ASSET_CACHE_HEADERS
      },
      {
        source: "/opengraph-image",
        headers: PUBLIC_ASSET_CACHE_HEADERS
      },
      {
        source: "/manifest.webmanifest",
        headers: PUBLIC_ASSET_CACHE_HEADERS
      },
      {
        source: "/robots.txt",
        headers: PUBLIC_ASSET_CACHE_HEADERS
      },
      {
        source: "/sitemap.xml",
        headers: PUBLIC_ASSET_CACHE_HEADERS
      }
    ];
  }
};

export default config;
