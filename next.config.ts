import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));

const config: NextConfig = {
  turbopack: { root },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "chisel.weirdgloop.org" }
    ]
  }
};

export default config;
