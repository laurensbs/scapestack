import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MoneyMethodsPanel } from "@/components/money-methods-panel";
import {
  buildMoneyMethodFilter,
  moneyMethodCountLine,
  type WikiMoneyMethod
} from "@/lib/money-methods";

const FREE_METHOD: WikiMoneyMethod = {
  id: "collect-ashes",
  page: "Money making guide/Collecting ashes",
  activity: "Collecting ashes",
  category: "Collecting",
  intensity: "Low",
  members: false,
  wikiGpPerHour: 27_000,
  killsPerHour: 1_000,
  skillRequirements: [{ skill: "Firemaking", level: 30 }],
  questRequirements: [],
  inputs: [],
  outputs: [],
  loadouts: []
};

const ZULRAH: WikiMoneyMethod = {
  id: "killing-zulrah",
  page: "Money making guide/Killing Zulrah",
  activity: "Killing Zulrah",
  category: "Combat/High",
  intensity: "High",
  members: true,
  wikiGpPerHour: 3_400_000,
  killsPerHour: 20,
  skillRequirements: [{ skill: "Ranged", level: 80 }],
  questRequirements: ["Regicide"],
  inputs: [{
    name: "Extended anti-venom+(4)",
    itemIds: [29824],
    tradeable: true,
    quantity: 0.125,
    perHour: false,
    requiredToStart: 1,
    wikiUnitValue: 19_866,
    priceType: "gemw"
  }],
  outputs: [],
  loadouts: [{
    page: "Zulrah/Strategies",
    style: "Ranged",
    slots: [
      { slot: "weapon", alternatives: [{ name: "Toxic blowpipe", itemIds: [12926], tradeable: true }] },
      { slot: "ammo", alternatives: [{ name: "Amethyst dart", itemIds: [25849], tradeable: true }] }
    ]
  }]
};

const SKILLS = [
  { name: "Firemaking", level: 80 },
  { name: "Ranged", level: 90 },
  { name: "Attack", level: 80 },
  { name: "Strength", level: 80 },
  { name: "Defence", level: 80 },
  { name: "Hitpoints", level: 90 },
  { name: "Prayer", level: 70 },
  { name: "Magic", level: 85 }
];

const PRICES = new Map([
  [29824, 20_000],
  [12926, 2_000_000],
  [25849, 200]
]);

describe("the Wiki money guide is filtered by the actual account", () => {
  it("keeps the live Bucket projection complete and changes the startable count when the bank changes", () => {
    const syncSource = readFileSync(join(process.cwd(), "scripts/wiki-sync.mjs"), "utf8");
    const rawMoney = JSON.parse(readFileSync(join(process.cwd(), "data/wiki/money-making-guide.json"), "utf8"));
    const rawEquipment = JSON.parse(readFileSync(join(process.cwd(), "data/wiki/recommended-equipment.json"), "utf8"));
    const projected = JSON.parse(
      readFileSync(join(process.cwd(), "data/wiki/derived/money-methods.json"), "utf8")
    ) as WikiMoneyMethod[];
    expect(rawMoney._source).toMatchObject({
      bucket: "money_making_guide",
      fields: ["page_name", "value", "recurring", "json"]
    });
    expect(rawEquipment._source).toMatchObject({
      bucket: "recommended_equipment",
      fields: ["page_name", "json"]
    });
    expect(syncSource).toContain('bucket: "money_making_guide"');
    expect(syncSource).toContain('bucket: "recommended_equipment"');
    expect(projected).toHaveLength(rawMoney._source.rows);
    expect(projected.length).toBeGreaterThan(600);
    expect(projected.find((method: WikiMoneyMethod) => method.id === "killing-zulrah")?.loadouts.length).toBeGreaterThan(0);
    expect(projected.find((method: WikiMoneyMethod) => method.id === "collecting-mort-myre-fungi")?.questRequirements).toEqual([
      "Fairytale II - Cure a Queen",
      "Nature Spirit",
      "Priest in Peril"
    ]);
    const fullSkills = [...new Set([
      ...SKILLS.map((skill) => skill.name),
      ...projected.flatMap((method: WikiMoneyMethod) => method.skillRequirements.map((skill) => skill.skill))
    ])].map((name) => ({ name, level: 99 }));
    const fullQuests = [...new Set(
      projected.flatMap((method: WikiMoneyMethod) => method.questRequirements)
    )];
    const emptyFullGuide = buildMoneyMethodFilter({
      methods: projected,
      skills: fullSkills,
      questsCompleted: fullQuests,
      bank: [],
      prices: new Map(),
      cannotBuy: true
    });
    const nestFullGuide = buildMoneyMethodFilter({
      methods: projected,
      skills: fullSkills,
      questsCompleted: fullQuests,
      bank: [{ id: 5075, name: "Bird nest (empty)", quantity: 1 }],
      prices: new Map(),
      cannotBuy: true
    });
    expect(emptyFullGuide.methods.find((method) => method.id === "crushing-bird-nests")?.startable).toBe(false);
    expect(nestFullGuide.methods.find((method) => method.id === "crushing-bird-nests")?.startable).toBe(true);
    expect(nestFullGuide.startableCount).toBeGreaterThan(emptyFullGuide.startableCount);

    const base = {
      methods: [FREE_METHOD, ZULRAH],
      skills: SKILLS,
      questsCompleted: ["Regicide"],
      prices: PRICES,
      cannotBuy: true
    };
    const thinBank = buildMoneyMethodFilter({ ...base, bank: [] });
    // Load-bearing fixture proof: Zulrah reached the evaluator and names the
    // real missing input/loadout pieces; this is not a count over empty rows.
    expect(thinBank.methods.find((method) => method.id === "killing-zulrah")?.missing).toEqual({
      skills: [],
      quests: [],
      items: ["Extended anti-venom+(4)"],
      equipment: ["weapon", "ammo"]
    });
    expect(thinBank.startableCount).toBe(1);

    const readyBank = buildMoneyMethodFilter({
      ...base,
      bank: [
        { id: 29824, name: "Extended anti-venom+(4)", quantity: 1 },
        { id: 12926, name: "Toxic blowpipe", quantity: 1 },
        { id: 25849, name: "Amethyst dart", quantity: 100 }
      ]
    });
    expect(readyBank.startableCount).toBe(2);
    expect(moneyMethodCountLine(readyBank)).toBe(
      "Of 2 Wiki money methods, 2 you can start right now with what is in your bank."
    );
    expect(readyBank.startable.find((method) => method.id === "killing-zulrah")).toMatchObject({
      banked: ["Extended anti-venom+(4)", "Toxic blowpipe", "Amethyst dart"],
      missing: { skills: [], quests: [], items: [], equipment: [] }
    });
    const thinMarkup = renderToStaticMarkup(MoneyMethodsPanel({ report: thinBank, cannotBuy: true }));
    const readyMarkup = renderToStaticMarkup(MoneyMethodsPanel({ report: readyBank, cannotBuy: true }));
    expect(thinMarkup).toContain('data-startable-count="1"');
    expect(readyMarkup).toContain('data-startable-count="2"');
    expect(readyMarkup).toContain(
      "Of 2 Wiki money methods, 2 you can start right now with what is in your bank."
    );

    const coinsOnly = [{ id: 995, name: "Coins", quantity: 3_000_000 }];
    const main = buildMoneyMethodFilter({ ...base, bank: coinsOnly, cannotBuy: false });
    const iron = buildMoneyMethodFilter({ ...base, bank: coinsOnly, cannotBuy: true });
    expect(main.startableCount).toBe(2);
    expect(main.startable[0]?.id).toBe("killing-zulrah");
    expect(buildMoneyMethodFilter({
      ...base,
      bank: [{ id: 995, name: "Coins", quantity: 1_000_000 }],
      cannotBuy: false
    }).startableCount).toBe(1);
    expect(iron.startableCount).toBe(1);
    expect(iron.startable[0]?.id).toBe("collect-ashes");
  });
});
