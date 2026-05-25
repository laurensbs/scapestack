import { describe, it, expect } from "vitest";
import { skillSpriteUrl } from "@/lib/sprites";

describe("skillSpriteUrl", () => {
  it("returns the correct path for known skill names", () => {
    expect(skillSpriteUrl("Attack")).toBe("/sprites/skills/attack.png");
    expect(skillSpriteUrl("Hitpoints")).toBe("/sprites/skills/hitpoints.png");
    expect(skillSpriteUrl("Runecraft")).toBe("/sprites/skills/runecraft.png");
  });

  it("is case-insensitive on the input name", () => {
    expect(skillSpriteUrl("attack")).toBe("/sprites/skills/attack.png");
    expect(skillSpriteUrl("ATTACK")).toBe("/sprites/skills/attack.png");
  });

  it("returns null for Overall — it is a synthetic total, not a skill", () => {
    expect(skillSpriteUrl("Overall")).toBeNull();
  });

  it("returns null for unknown names so production doesn't 404", () => {
    expect(skillSpriteUrl("Sailing")).toBeNull(); // hypothetical future skill
    expect(skillSpriteUrl("")).toBeNull();
    expect(skillSpriteUrl("Random Garbage")).toBeNull();
  });
});
