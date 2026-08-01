import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import itemMeta from "../data/item-meta.json";
import quests from "../data/quests.json";
import { BOSSES } from "@/lib/bosses";
import { buildHomepageProof } from "@/lib/homepage-proof";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("the homepage companion face", () => {
  it("does not mistake an item sprite for the superseded boss subject", () => {
    const page = read("src/app/page.tsx");
    const proof = read("src/lib/homepage-proof.ts");
    expect(`${page}\n${proof}`).not.toMatch(/setInterval|setTimeout/);
    expect(page).not.toContain('data-home-boss-subject="true"');
    expect(page).not.toContain("/api/sprite/item/");
    expect(page).not.toContain('className="pixelated');
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
