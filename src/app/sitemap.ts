import type { MetadataRoute } from "next";
import { BRAND_PUBLIC_ROUTES, brandUrl } from "@/lib/brand";

const LAST_PRODUCT_AUDIT = new Date("2026-06-04T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  return BRAND_PUBLIC_ROUTES.map((route) => ({
    url: brandUrl(route.path),
    lastModified: LAST_PRODUCT_AUDIT,
    changeFrequency: route.changeFrequency,
    priority: route.priority
  }));
}
