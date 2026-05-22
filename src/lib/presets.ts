// Activity presets: inventory loadouts for specific bosses/activities.
// When a preset is active, the bank tab is re-laid-out so the first row(s)
// match what your inventory will look like for that activity.
//
// Based on RuneTags shared layouts + dillydill123/inventory-setups defaults.

import type { OrganizedItem } from "./organizer";

export interface Preset {
  slug: string;
  name: string;
  emoji: string;             // simple icon for chip (fallback if no sprite)
  iconItemId?: number;       // OSRS sprite — boss's signature drop/loadout icon
  applicableTabs: string[];  // which tab(s) this preset is offered on
  rows: PresetRow[];         // ordered rows; row 1 first
}

export interface PresetRow {
  label: string;
  patterns: RegExp[];        // each item slot is filled by the first item matching pattern
}

export const PRESETS: Preset[] = [
  {
    slug: "vorkath",
    name: "Vorkath",
    emoji: "🐉",
    iconItemId: 21907, // Vorkath's head
    applicableTabs: ["Combat", "Range"],
    rows: [
      {
        label: "Main gear",
        patterns: [
          /helm of neitiznot|imbued slayer helmet|slayer helmet/i,
          /amulet of fury|amulet of torture/i,
          /(armadyl|masori) chestplate|(armadyl|masori) body/i,
          /(armadyl|masori) chainskirt|(armadyl|masori) chaps/i,
          /barrows gloves|^ferocious gloves/i,
          /pegasian boots|ranger boots/i,
          /^archers ring|venator ring/i,
          /ava's assembler/i
        ]
      },
      {
        label: "Inventory",
        patterns: [
          /^twisted bow|^toxic blowpipe/i,
          /^dragon arrow$/i, // ammo
          /super combat potion\(4\)/i,
          /ranging potion\(4\)/i,
          /prayer potion\(4\)/i, /prayer potion\(4\)/i, /prayer potion\(4\)/i,
          /super antifire\(4\)|extended super antifire\(4\)/i
        ]
      }
    ]
  },
  {
    slug: "zulrah",
    name: "Zulrah",
    emoji: "🐍",
    iconItemId: 12921, // Magma mutagen
    applicableTabs: ["Combat", "Range", "Magic"],
    rows: [
      {
        label: "Mage switch",
        patterns: [
          /ancestral hat/i, /occult necklace/i,
          /tumeken's shadow|sanguinesti staff|trident of the swamp/i,
          /ancestral robe top/i, /ancestral robe bottom/i,
          /tormented bracelet/i, /eternal boots/i, /magus ring/i
        ]
      },
      {
        label: "Range switch",
        patterns: [
          /masori mask/i, /necklace of anguish/i,
          /toxic blowpipe|twisted bow/i,
          /masori body/i, /masori chaps/i,
          /zaryte vambraces/i, /pegasian boots/i, /venator ring/i
        ]
      },
      {
        label: "Inventory",
        patterns: [
          /super combat potion\(4\)/i,
          /ranging potion\(4\)/i, /magic potion\(4\)/i,
          /^anti-venom\+\(4\)/i, /^stamina potion\(4\)/i,
          /prayer potion\(4\)/i, /prayer potion\(4\)/i, /prayer potion\(4\)/i
        ]
      }
    ]
  },
  {
    slug: "cox",
    name: "CoX",
    emoji: "⚔️",
    iconItemId: 20997, // Twisted bow
    applicableTabs: ["Combat", "Range", "Magic"],
    rows: [
      {
        label: "3-style switch",
        patterns: [
          /twisted bow/i,
          /bow of faerdhinen/i,
          /scythe of vitur|^scythe/i,
          /tumeken's shadow|sanguinesti staff/i,
          /elder maul|dragon claws|voidwaker/i,
          /^zaryte crossbow/i,
          /dragon dagger/i,
          /salve amulet|amulet of torture/i
        ]
      },
      {
        label: "Body armour",
        patterns: [
          /virtus robe top/i,
          /ancestral robe top/i,
          /bandos chestplate/i,
          /torva platebody|justiciar chestguard/i,
          /masori body/i,
          /armadyl chestplate/i,
          /elite void top/i,
          /fighter torso/i
        ]
      },
      {
        label: "Consumables",
        patterns: [
          /saradomin brew\(4\)/i,
          /super combat potion\(4\)/i,
          /super restore\(4\)/i,
          /prayer potion\(4\)/i,
          /stamina potion\(4\)/i,
          /^anglerfish$/i,
          /elder \(\+\)|overload \(\+\)/i,
          /xeric's aid|xeric's blessing/i
        ]
      }
    ]
  },
  {
    slug: "tob",
    name: "ToB",
    emoji: "🦇",
    iconItemId: 22325, // Scythe of vitur
    applicableTabs: ["Combat", "Range", "Magic"],
    rows: [
      {
        label: "Weapons",
        patterns: [
          /scythe of vitur/i,
          /sanguinesti staff/i,
          /twisted bow/i,
          /^toxic blowpipe/i,
          /zaryte crossbow/i,
          /^ghrazi rapier/i,
          /^bow of faerdhinen/i,
          /voidwaker|^dragon claws/i
        ]
      },
      {
        label: "Consumables",
        patterns: [
          /saradomin brew\(4\)/i, /super restore\(4\)/i,
          /super combat potion\(4\)/i, /ranging potion\(4\)/i,
          /magic potion\(4\)/i, /stamina potion\(4\)/i,
          /^anglerfish$/i, /^cooked karambwan$/i
        ]
      }
    ]
  },
  {
    slug: "toa",
    name: "ToA",
    emoji: "🏺",
    iconItemId: 26219, // Osmumten's fang
    applicableTabs: ["Combat", "Range", "Magic"],
    rows: [
      {
        label: "Weapons",
        patterns: [
          /tumeken's shadow/i,
          /scythe of vitur/i,
          /^twisted bow/i,
          /^bow of faerdhinen/i,
          /osmumten's fang/i,
          /sanguinesti staff/i,
          /zaryte crossbow/i,
          /dragon claws|voidwaker/i
        ]
      },
      {
        label: "Consumables",
        patterns: [
          /saradomin brew\(4\)/i,
          /super combat potion\(4\)/i,
          /super restore\(4\)/i,
          /ranging potion\(4\)/i,
          /magic potion\(4\)/i,
          /stamina potion\(4\)/i,
          /^anglerfish$/i,
          /^smelling salts/i
        ]
      }
    ]
  },
  {
    slug: "wintertodt",
    name: "Wintertodt",
    emoji: "❄️",
    iconItemId: 20708, // Pyromancer hood — Wintertodt signature reward
    applicableTabs: ["Skilling"],
    rows: [
      {
        label: "Outfit",
        patterns: [
          /pyromancer hood/i,
          /pyromancer garb/i,
          /pyromancer robe/i,
          /pyromancer boots/i,
          /warm gloves/i,
          /bruma torch/i,
          /tinderbox|imcando tinderbox/i,
          /knife|hammer/i
        ]
      },
      {
        label: "Food",
        patterns: [
          /rejuvenation potion/i,
          /saradomin brew\(4\)/i,
          /^anglerfish$/i,
          /^shark$/i,
          /super restore\(4\)/i
        ]
      }
    ]
  }
];

export function presetsForTab(tabName: string): Preset[] {
  return PRESETS.filter((p) => p.applicableTabs.includes(tabName));
}

// Lay out items using a preset: each row's pattern list defines which items
// go in slots 0..7 of that row. Items not used in any preset row go in the
// "rest" block after a gap.
export function layoutWithPreset(items: OrganizedItem[], preset: Preset): Record<number, number> {
  const GRID_COLS = 8;
  const layout: Record<number, number> = {};
  const used = new Set<number>();
  let slot = 0;

  for (const row of preset.rows) {
    let col = 0;
    for (const pat of row.patterns) {
      if (col >= GRID_COLS) break;
      const match = items.find((it) => !used.has(it.id) && pat.test(it.name));
      if (match) {
        layout[slot + col] = match.id;
        used.add(match.id);
      }
      col++;
    }
    slot += GRID_COLS;
  }

  // Gap, then rest of items
  slot += GRID_COLS;
  for (const it of items) {
    if (used.has(it.id)) continue;
    layout[slot++] = it.id;
  }
  return layout;
}
