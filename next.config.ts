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
