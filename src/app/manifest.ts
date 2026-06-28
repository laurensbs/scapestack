import type { MetadataRoute } from "next";
import {
  BRAND_BACKGROUND_COLOR,
  BRAND_DESCRIPTION,
  BRAND_NAME,
  BRAND_TAGLINE,
  BRAND_SHORT_NAME,
  BRAND_SHORTCUTS,
  BRAND_THEME_COLOR
} from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND_NAME} · ${BRAND_TAGLINE}`,
    short_name: BRAND_SHORT_NAME,
    description: BRAND_DESCRIPTION,
    start_url: "/next",
    scope: "/",
    display: "standalone",
    background_color: BRAND_BACKGROUND_COLOR,
    theme_color: BRAND_THEME_COLOR,
    categories: ["games", "productivity", "utilities"],
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icon?maskable=1",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ],
    shortcuts: BRAND_SHORTCUTS.map((shortcut) => ({
      ...shortcut,
      icons: [{ src: shortcut.icon, sizes: "192x192", type: "image/png" }]
    })),
    screenshots: [
      {
        src: "/opengraph-image",
        sizes: "1200x630",
        type: "image/png",
        form_factor: "wide",
        label: `${BRAND_NAME} OSRS session planner`
      }
    ],
    related_applications: [],
    prefer_related_applications: false,
    orientation: "any",
    dir: "ltr",
    lang: "en",
    id: "/next",
    display_override: ["window-controls-overlay", "standalone", "browser"]
  };
}
