// Hours-to-max sanity tests.
// Hardcoded rates dus de invariants zijn simpel: 99-skill = 0u,
// brand-new account = duizenden uren, perSkill is gesorteerd op
// hours desc, overall wordt overgeslagen.

import { describe, it, expect } from "vitest";
import { estimateSkillHours, hoursToMax } from "@/lib/hours-to-max";
import { XP_TABLE } from "@/lib/skill-methods/types";

describe("estimateSkillHours", () => {
  it("99-skill geeft 0 uur", () => {
    const e = estimateSkillHours("Slayer", 99, XP_TABLE[99], 99);
    expect(e.hours).toBe(0);
    expect(e.xpRemaining).toBe(0);
  });

  it("1 → 99 Slayer = honderden uren", () => {
    const e = estimateSkillHours("Slayer", 1, 0, 99);
    expect(e.hours).toBeGreaterThan(200);
    expect(e.hours).toBeLessThan(500);
  });

  it("90 → 99 Cooking (super hoge rate) = paar uur", () => {
    const e = estimateSkillHours("Cooking", 90, XP_TABLE[90], 99);
    // Cooking 400k/u → 7.5M XP / 400k = ~19u
    expect(e.hours).toBeGreaterThan(10);
    expect(e.hours).toBeLessThan(30);
  });

  it("onbekende skill → fallback rate", () => {
    const e = estimateSkillHours("NieuweSkill", 1, 0, 99);
    expect(e.hours).toBeGreaterThan(0);
    expect(e.xpPerHour).toBe(50_000); // fallback
  });
});

describe("hoursToMax", () => {
  it("alleen skills onder target tellen mee", () => {
    const summary = hoursToMax([
      { name: "Slayer",  level: 70, xp: XP_TABLE[70] },
      { name: "Cooking", level: 99, xp: XP_TABLE[99] },
      { name: "Overall", level: 1500, xp: 0 } // moet geskipt worden
    ], 99);
    expect(summary.perSkill.map((p) => p.skill)).toEqual(["Slayer"]);
    expect(summary.totalHours).toBeGreaterThan(0);
  });

  it("perSkill is gesorteerd: zwaarste skill eerst", () => {
    const summary = hoursToMax([
      { name: "Slayer",   level: 1, xp: 0 }, // 40k/u → ~325u
      { name: "Cooking",  level: 1, xp: 0 }, // 400k/u → ~32u
      { name: "Mining",   level: 1, xp: 0 }, // 55k/u → ~237u
    ], 99);
    expect(summary.perSkill[0].skill).toBe("Slayer");
    expect(summary.perSkill[summary.perSkill.length - 1].skill).toBe("Cooking");
  });

  it("max account = 0u totaal", () => {
    const summary = hoursToMax([
      { name: "Attack", level: 99, xp: XP_TABLE[99] },
      { name: "Slayer", level: 99, xp: XP_TABLE[99] }
    ], 99);
    expect(summary.totalHours).toBe(0);
    expect(summary.perSkill.length).toBe(0);
  });

  it("totaal voor lege account = veel uren (>1000)", () => {
    // 24 skills × ~300u gemiddeld = thousands
    const allSkills = [
      "Attack","Strength","Defence","Hitpoints","Ranged","Magic","Prayer",
      "Slayer","Mining","Smithing","Fishing","Cooking","Firemaking",
      "Woodcutting","Crafting","Fletching","Herblore","Agility","Thieving",
      "Farming","Hunter","Construction","Runecraft","Sailing"
    ].map((name) => ({ name, level: 1, xp: 0 }));
    const summary = hoursToMax(allSkills, 99);
    expect(summary.totalHours).toBeGreaterThan(1000);
  });
});
