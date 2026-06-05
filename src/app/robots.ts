import type { MetadataRoute } from "next";
import { BRAND_URL, brandUrl } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dev/",
        "/bank/share/"
      ]
    },
    host: BRAND_URL,
    sitemap: brandUrl("/sitemap.xml")
  };
}
