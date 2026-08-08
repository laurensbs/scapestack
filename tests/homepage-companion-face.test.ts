import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import itemMeta from "../data/item-meta.json";
import quests from "../data/quests.json";
import { BOSSES } from "@/lib/bosses";
import { HOMEPAGE_BOSS_RENDERS } from "@/lib/homepage-boss-renders";
import {
  buildHomepageProof,
  homepageBossForDate
} from "@/lib/homepage-proof";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("the homepage companion face", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the corrected NPC render instead of the superseded item sprite", () => {
    const page = read("src/app/page.tsx");
    const proof = read("src/lib/homepage-proof.ts");
    const route = read("src/app/api/sprite/boss/[slug]/route.ts");
    const nextConfig = read("next.config.ts");
    expect(`${page}\n${proof}`).not.toMatch(/setInterval|setTimeout/);
    expect(page).toContain('data-home-boss-subject="true"');
    expect(page).toContain("/api/sprite/boss/");
    expect(page).toContain("<Image");
    expect(page).toContain("width={boss.width}");
    expect(page).toContain("height={boss.height}");
    expect(page).toContain('sizes="(max-width: 639px) 420px, (max-width: 1199px) 40vw, 520px"');
    expect(page).toContain("opacity-[0.16] sm:opacity-100");
    expect(page).toContain("sm:relative sm:right-auto");
    // The plate moved into globals.css as .boss-plate when the render got its
    // rim-light: measured 2026-08-08, nine of the twelve homepage bosses sat
    // under 3:1 against the ground and were effectively invisible.
    expect(page).toContain("boss-plate");
    expect(page).toContain("boss-render");
    const globals = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(globals).toContain(".boss-plate");
    expect(globals).toContain("radial-gradient");
    // The rim is what makes a dark render legible at all — drop-shadow layers
    // outline a transparent PNG the way the game outlines an NPC.
    expect(globals).toMatch(/\.boss-render[\s\S]{0,200}drop-shadow/);
    expect(page).toContain("blur-xl");
    expect(page).not.toContain("/api/sprite/item/");
    expect(page).not.toContain("unoptimized");
    expect(route).toContain("scapestack-boss-render-proxy/1.0");
    expect(route).toContain("generated-fallback");
    expect(route).toContain("revalidate: 60 * 60 * 24 * 30");
    expect(nextConfig).toContain('/api/sprite/boss/:path*');
    expect(nextConfig).toContain('value: "public, max-age=2592000, stale-while-revalidate=31536000"');
  });

  it("commits twelve pageimages originals instead of guessing filenames at request time", () => {
    const names = HOMEPAGE_BOSS_RENDERS.map((boss) => boss.name);
    expect(names).toEqual([
      "Vorkath", "Zulrah", "Cerberus", "Nex", "Araxxor", "Vardorvis",
      "Corporeal Beast", "Kraken", "Alchemical Hydra", "Phantom Muspah",
      "General Graardor", "Duke Sucellus"
    ]);
    expect(new Set(HOMEPAGE_BOSS_RENDERS.map((boss) => boss.slug))).toHaveProperty("size", 12);
    for (const boss of HOMEPAGE_BOSS_RENDERS) {
      expect(boss.originalUrl).toMatch(/^https:\/\/oldschool\.runescape\.wiki\/images\//);
      expect(boss.originalUrl).not.toContain("/thumb/");
      expect(boss.width).toBeGreaterThan(700);
      expect(boss.height).toBeGreaterThan(700);
    }
    expect(HOMEPAGE_BOSS_RENDERS.find((boss) => boss.slug === "zulrah")?.originalUrl)
      .toContain("Zulrah_%28serpentine%29.png");
    expect(HOMEPAGE_BOSS_RENDERS.find((boss) => boss.slug === "alchemical-hydra")?.originalUrl)
      .toContain("Alchemical_Hydra_%28serpentine%29.png");
    expect(HOMEPAGE_BOSS_RENDERS.find((boss) => boss.slug === "phantom-muspah")?.originalUrl)
      .toContain("Phantom_Muspah_%28ranged%29.png");
  });

  it("keeps one boss stable for a UTC day and advances on the next date", () => {
    const morning = homepageBossForDate(new Date("2026-08-02T00:01:00.000Z"));
    const evening = homepageBossForDate(new Date("2026-08-02T23:59:00.000Z"));
    const tomorrow = homepageBossForDate(new Date("2026-08-03T12:00:00.000Z"));
    expect(evening.slug).toBe(morning.slug);
    expect(tomorrow.slug).not.toBe(morning.slug);
  });

  it("returns a valid fallback image when the wiki render is forced to 404", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("missing", {
      status: 404,
      headers: { "content-type": "text/html" }
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("@/app/api/sprite/boss/[slug]/route");
    const response = await GET(
      new Request("http://local.test/api/sprite/boss/vorkath?force404=1"),
      { params: Promise.resolve({ slug: "vorkath" }) }
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("x-scapestack-boss-source")).toBe("generated-fallback");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(60);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("Scapestack_forced_missing_boss_render.png"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "user-agent": expect.stringContaining("scapestack-boss-render-proxy")
        })
      })
    );
  });

  it("derives all three credibility counts from the shipped datasets", () => {
    const facts = buildHomepageProof();
    const page = read("src/app/page.tsx");

    expect(facts.bossesChecked).toBe(BOSSES.length);
    expect(facts.questsTracked).toBe(Object.keys(quests).length);
    expect(facts.itemsPriced).toBe(Object.values(itemMeta).filter((item) => Number(item.value) > 0).length);
    expect(page).toContain("bosses checked");
    expect(page).toContain("quests tracked");
    expect(page).toContain("items priced");
  });

  it("states the product once and keeps the homepage out of feature-grid territory", () => {
    const page = read("src/app/page.tsx");
    expect(page).toContain("Your OSRS companion.");
    expect(page).toContain("Scapestack remembers what you are working toward and tells you the next step.");
    expect(page).toContain("<HeroIntake />");
    expect(page).not.toMatch(/testimonials?|feature grid|demo account|HomeSpecimen/i);
    expect(page).not.toMatch(/text-\[[0-9.]+px\]/);
  });

  it("applies the Archivo weight, figure and tracking rules to the homepage", () => {
    const page = read("src/app/page.tsx");
    const intake = read("src/components/hero-intake.tsx");
    const layout = read("src/app/layout.tsx");

    expect(page.match(/\bfont-extrabold\b/g)).toHaveLength(1);
    expect(page).toContain("font-extrabold!");
    expect(`${page}\n${intake}`).not.toMatch(/\bfont-(?:medium|bold|black)\b/);

    const proofFigures = [...page.matchAll(/<strong className="([^"]+)"/g)].map((match) => match[1]);
    expect(proofFigures).toHaveLength(3);
    for (const className of proofFigures) {
      expect(className).toContain("tabular-nums");
      expect(className).toContain("font-semibold");
    }

    const inputClass = intake.match(/<input[\s\S]*?className="([^"]+)"/)?.[1];
    const buttonClass = intake.match(/<button[\s\S]*?className="([^"]+)"/)?.[1];
    const footerClass = layout.match(/<footer className="([^"]+)"/)?.[1];
    expect(inputClass).toContain("font-normal");
    expect(buttonClass).toContain("font-semibold");
    expect(footerClass).toContain("text-[length:var(--text-label)]");
    expect(footerClass).not.toMatch(/tracking-/);
  });
});
