import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import itemMeta from "../data/item-meta.json";
import quests from "../data/quests.json";
import { BOSSES } from "@/lib/bosses";
import { buildHomepageProof, dailyBossIndex } from "@/lib/homepage-proof";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("the homepage companion face", () => {
  it("holds one boss for the UTC day and changes without an ambient timer", () => {
    expect(dailyBossIndex(new Date("2026-08-01T00:00:01Z"), 59)).toBe(
      dailyBossIndex(new Date("2026-08-01T23:59:59Z"), 59)
    );
    expect(dailyBossIndex(new Date("2026-08-02T00:00:01Z"), 59)).not.toBe(
      dailyBossIndex(new Date("2026-08-01T23:59:59Z"), 59)
    );

    const page = read("src/app/page.tsx");
    const proof = read("src/lib/homepage-proof.ts");
    expect(`${page}\n${proof}`).not.toMatch(/setInterval|setTimeout/);
    expect(page).toContain('data-home-boss-subject="true"');
    expect(page).toContain("width={144}");
    expect(page).toContain("height={144}");
    expect(page).toContain('className="pixelated');
  });

  it("derives all three credibility counts from the shipped datasets", () => {
    const facts = buildHomepageProof(new Date("2026-08-01T12:00:00Z"));
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
});
