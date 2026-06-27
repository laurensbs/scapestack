import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import manifest from "@/app/manifest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import {
  BRAND_DESCRIPTION,
  BRAND_IMAGE_FONT_FAMILY,
  BRAND_LEGACY_REDIRECT_ROUTES,
  BRAND_NAME,
  BRAND_PLAYER_PROMPTS,
  BRAND_POSITIONING,
  BRAND_PUBLIC_ROUTES,
  BRAND_SECONDARY_TAGLINE,
  BRAND_STATE_SYSTEM,
  BRAND_SHORTCUTS,
  BRAND_TAGLINE,
  BRAND_THEME_COLOR,
  BRAND_UI_SURFACES,
  BRAND_VOICE_RULES,
  brandUrl
} from "@/lib/brand";

describe("Scapestack branding", () => {
  it("keeps public brand URLs on the production domain", () => {
    expect(brandUrl("/bank")).toBe("https://www.scapestack.org/bank");
    expect(brandUrl("/plugin")).toBe("https://www.scapestack.org/plugin");
  });

  it("defines product shortcuts for the core Scapestack loop", () => {
    expect(BRAND_SHORTCUTS.map((shortcut) => shortcut.url)).toEqual([
      "/bank",
      "/next",
      "/plugin"
    ]);
  });

  it("positions Scapestack as a tactical OSRS decision engine", () => {
    expect(BRAND_TAGLINE).toBe("Know what to do next in OSRS");
    expect(BRAND_SECONDARY_TAGLINE).toBe("Type your RSN. Pick one route before you log in.");
    expect(BRAND_DESCRIPTION).toContain("Plan tonight's OSRS route");
    expect(BRAND_POSITIONING.promise).toBe("From login indecision to one useful route.");
    expect(BRAND_POSITIONING.feeling).toContain("OSRS route board");
    expect(BRAND_POSITIONING.antiPattern).toContain("player-facing screens about choices");
    expect(BRAND_VOICE_RULES.join(" ")).toContain("practical OSRS player language");
    expect(BRAND_VOICE_RULES.join(" ")).not.toContain("AI-powered");
  });

  it("defines player-facing routes and prompt chips", () => {
    expect(BRAND_UI_SURFACES.map((surface) => surface.page)).toEqual([
      "Tonight",
      "Bank",
      "Boss",
      "Slayer",
      "Unlocks",
      "Sync"
    ]);
    expect(BRAND_UI_SURFACES.map((surface) => surface.primaryAction).join(" ")).toContain("Route task");
    expect(BRAND_UI_SURFACES.map((surface) => surface.requiredFeeling).join(" ")).toContain("Boss");
    expect(BRAND_PLAYER_PROMPTS.map((prompt) => prompt.label)).toEqual([
      "I have 45 minutes",
      "I need GP",
      "I want boss KC",
      "I have a Slayer task",
      "I want an unlock",
      "Low effort",
      "What should I buy?",
      "Hide done stuff"
    ]);
    expect(BRAND_PLAYER_PROMPTS.map((prompt) => prompt.copy).join(" ")).toContain("finished quests");
    expect(BRAND_STATE_SYSTEM.map((state) => state.state)).toEqual(["Empty", "Loading", "Error", "Mobile"]);
    expect(BRAND_STATE_SYSTEM.map((state) => state.copy).join(" ")).toContain("no hover-only affordances");
  });

  it("publishes crawlable canonical routes without indexing private surfaces", () => {
    const routePaths = BRAND_PUBLIC_ROUTES.map((route) => route.path);

    expect(routePaths).toContain("/");
    expect(routePaths).toContain("/bank");
    expect(routePaths).toContain("/next");
    expect(routePaths).toContain("/plugin");
    expect(routePaths).toContain("/dps");
    expect(routePaths).toContain("/hiscore");
    expect(routePaths).not.toContain("/api/sync");
    expect(routePaths).not.toContain("/dev/layout");
    expect(routePaths).not.toContain("/bank/share/[code]");
    for (const redirectRoute of BRAND_LEGACY_REDIRECT_ROUTES) {
      expect(routePaths).not.toContain(redirectRoute);
    }
  });

  it("builds robots.txt for public tools and private runtime routes", () => {
    const data = robots();

    expect(data.sitemap).toBe("https://www.scapestack.org/sitemap.xml");
    expect(data.host).toBe("https://www.scapestack.org");
    expect(data.rules).toMatchObject({
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dev/", "/bank/share/"]
    });
  });

  it("builds a sitemap from the canonical product routes", () => {
    const data = sitemap();

    expect(data.map((entry) => entry.url)).toEqual(BRAND_PUBLIC_ROUTES.map((route) => brandUrl(route.path)));
    expect(data.find((entry) => entry.url === brandUrl("/bank"))).toMatchObject({
      priority: 0.95,
      changeFrequency: "weekly"
    });
    expect(data.some((entry) => entry.url.includes("/api/"))).toBe(false);
    expect(data.some((entry) => entry.url.includes("/dev/"))).toBe(false);
    for (const redirectRoute of BRAND_LEGACY_REDIRECT_ROUTES) {
      expect(data.some((entry) => entry.url === brandUrl(redirectRoute))).toBe(false);
    }
  });

  it("builds a branded install manifest", () => {
    const data = manifest();

    expect(data.name).toContain(BRAND_NAME);
    expect(data.description).toBe(BRAND_DESCRIPTION);
    expect(data.theme_color).toBe(BRAND_THEME_COLOR);
    expect(data.start_url).toBe("/next");
    expect(data.icons?.some((icon) => icon.src === "/icon" && icon.sizes === "512x512")).toBe(true);
    expect(data.shortcuts?.map((shortcut) => shortcut.url)).toEqual(["/bank", "/next", "/plugin"]);
    expect(data.screenshots?.[0].src).toBe("/opengraph-image");
  });

  it("keeps global chrome owned by Scapestack", () => {
    const layoutSource = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
    const globalsSource = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

    expect(layoutSource).toContain("creator: BRAND_NAME");
    expect(layoutSource).toContain("publisher: BRAND_NAME");
    expect(layoutSource).toContain("{BRAND_TAGLINE}");
    expect(layoutSource).toContain("Made for Gielinor");
    expect(layoutSource).toContain("GeistSans.variable");
    expect(globalsSource).toContain("--font-geist-sans");
    expect(layoutSource).not.toContain("next/font/google");
    expect(globalsSource).not.toContain("--font-inter");
    expect(layoutSource).not.toContain("Webstability");
    expect(layoutSource).not.toContain("webstability.eu");
  });

  it("makes clickable controls feel clickable by default", () => {
    const globalsSource = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

    expect(globalsSource).toContain(":where(button:not(:disabled), a[href], summary)");
    expect(globalsSource).toContain("a[href]");
    expect(globalsSource).toContain("summary");
    expect(globalsSource).toContain("cursor: pointer");
    expect(globalsSource).toContain(":where(button:disabled, [aria-disabled=\"true\"])");
    expect(globalsSource).toContain("[aria-disabled=\"true\"]");
    expect(globalsSource).toContain("cursor: not-allowed");
  });

  it("keeps decorative coin accents on OSRS gold instead of generic green", () => {
    const globalsSource = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

    expect(globalsSource).toContain("Coin marker — OSRS gold");
    expect(globalsSource).toContain("radial-gradient(circle at 30% 30%, #FFE6A8 0%, #E6A52F 50%, #B07B1F 100%)");
    expect(globalsSource).toContain("inset 0 0 0 1px #B07B1F");
    expect(globalsSource).not.toContain("Coin marker — kept but recoloured to mint");
  });

  it("keeps retained sidebar brandmark on the gold brand palette", () => {
    const sidebarSource = readFileSync(join(process.cwd(), "src/components/sidebar.tsx"), "utf8");

    expect(sidebarSource).toContain("var(--color-accent-soft)");
    expect(sidebarSource).toContain("var(--color-accent)");
    expect(sidebarSource).toContain("var(--color-gold-deep)");
    expect(sidebarSource).toContain("BRAND_TAGLINE");
    expect(sidebarSource).not.toContain("#00A972");
    expect(sidebarSource).not.toContain("OSRS toolkit");
  });

  it("keeps generated image branding on the app font stack", () => {
    const imageSources = [
      "src/app/opengraph-image.tsx",
      "src/app/icon.tsx",
      "src/app/apple-icon.tsx",
      "src/app/u/[rsn]/opengraph-image.tsx"
    ].map((path) => readFileSync(join(process.cwd(), path), "utf8"));

    expect(BRAND_IMAGE_FONT_FAMILY).toBe("Geist, Arial, sans-serif");
    for (const source of imageSources) {
      expect(source).toContain("BRAND_IMAGE_FONT_FAMILY");
      expect(source).not.toContain("Inter, Arial");
      expect(source).not.toContain("fontFamily: \"sans-serif\"");
    }
  });

  it("keeps dynamic profile Open Graph generation on the runtime that builds", () => {
    const profileOgSource = readFileSync(join(process.cwd(), "src/app/u/[rsn]/opengraph-image.tsx"), "utf8");

    expect(profileOgSource).toContain('export const runtime = "edge"');
    expect(profileOgSource).toContain('new ImageResponse');
  });

  it("marks private share and dev routes as noindex", () => {
    const shareSource = readFileSync(join(process.cwd(), "src/app/bank/share/[code]/page.tsx"), "utf8");
    const devSource = readFileSync(join(process.cwd(), "src/app/dev/layout/page.tsx"), "utf8");

    expect(shareSource).toContain("privateSharedBankRobots");
    expect(shareSource).toContain("index: false");
    expect(shareSource).toContain("follow: false");
    expect(devSource).toContain("robots");
    expect(devSource).toContain("index: false");
    expect(devSource).toContain("follow: false");
  });
});
