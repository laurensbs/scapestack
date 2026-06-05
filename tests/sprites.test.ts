import { describe, it, expect } from "vitest";
import { BOSSES } from "@/lib/bosses";
import { bossSpriteUrl, skillSpriteUrl } from "@/lib/sprites";

describe("skillSpriteUrl", () => {
  it("returns the correct path for known skill names", () => {
    expect(skillSpriteUrl("Attack")).toBe("/sprites/skills/attack.png");
    expect(skillSpriteUrl("Hitpoints")).toBe("/sprites/skills/hitpoints.png");
    expect(skillSpriteUrl("Runecraft")).toBe("/sprites/skills/runecraft.png");
    expect(skillSpriteUrl("Sailing")).toBe("/sprites/skills/sailing.png");
  });

  it("is case-insensitive on the input name", () => {
    expect(skillSpriteUrl("attack")).toBe("/sprites/skills/attack.png");
    expect(skillSpriteUrl("ATTACK")).toBe("/sprites/skills/attack.png");
  });

  it("returns null for Overall — it is a synthetic total, not a skill", () => {
    expect(skillSpriteUrl("Overall")).toBeNull();
  });

  it("returns null for unknown names so production doesn't 404", () => {
    expect(skillSpriteUrl("")).toBeNull();
    expect(skillSpriteUrl("Random Garbage")).toBeNull();
  });
});

describe("bossSpriteUrl", () => {
  it("returns the local boss sprite for known boss slugs", () => {
    expect(bossSpriteUrl("vardorvis")).toBe("/sprites/bosses/vardorvis.png");
    expect(bossSpriteUrl("King-Black-Dragon")).toBe("/sprites/bosses/king-black-dragon.png");
  });

  it("returns null for unknown or unsafe slugs", () => {
    expect(bossSpriteUrl("")).toBeNull();
    expect(bossSpriteUrl("../vardorvis")).toBeNull();
    expect(bossSpriteUrl("future-boss")).toBeNull();
  });

  it("covers every boss used by the DPS picker", () => {
    for (const boss of BOSSES) {
      expect(bossSpriteUrl(boss.slug), boss.slug).toBe(`/sprites/bosses/${boss.slug}.png`);
    }
  });
});
