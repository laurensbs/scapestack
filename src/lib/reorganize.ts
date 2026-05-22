// Client-safe re-sort utility. Lives in its own module so the bank-result
// client component can import it without dragging server-only deps
// (organizer.ts imports node:fs through item-db).

import { tabPriority, type Archetype } from "./archetype";
import { subtabRank, shuffleKey, newShuffleSeed } from "./playstyle";
import type { OrganizedTab, OrganizedItem } from "./organizer";

export type ReorganizeStrategy = "smart" | "value" | "quantity" | "name";

// Stream items into consecutive slots — no gaps, no row breaks. This is what
// vanilla OSRS Bank Tags supports: items always flow left-to-right with no
// empty cells in between.
function packDense(items: OrganizedItem[]): Record<number, number> {
  const layout: Record<number, number> = {};
  for (let i = 0; i < items.length; i++) {
    layout[i] = items[i].id;
  }
  return layout;
}

export function reorganizeTabs(
  tabs: OrganizedTab[],
  strategy: ReorganizeStrategy,
  archetype: Archetype = "unspecified",
  // Tie-break seed for the subtle shuffle on a "smart" tidy. A fresh seed
  // each click means the bank re-tidies to a slightly different — but always
  // fully grouped — arrangement, like a player who never lays their bank out
  // identically twice. Pass a fixed seed to reproduce an exact layout.
  shuffleSeed: number = newShuffleSeed()
): OrganizedTab[] {
  const resorted = tabs.map((t) => {
    const items = t.items.slice();
    if (strategy === "smart") {
      // Smart tidy = canonical sort and pack densely. We skip layoutForTab's
      // row-break logic because OSRS bank tags don't allow empty slots — items
      // flow continuously. Sort precedence mirrors organize():
      //   playstyle subtab rank → subtab name → weight → quantity → shuffle.
      // The shuffle only ever reorders items the prior keys called equal, so
      // the structure is stable; only ties vary between tidies.
      items.sort((a, b) => {
        const ra = subtabRank(archetype, a.subtab);
        const rb = subtabRank(archetype, b.subtab);
        if (ra !== rb) return ra - rb;
        if (a.subtab !== b.subtab) return a.subtab.localeCompare(b.subtab);
        if (a.weight !== b.weight) return a.weight - b.weight;
        if (a.quantity !== b.quantity) return b.quantity - a.quantity;
        const ka = shuffleKey(shuffleSeed, a.id);
        const kb = shuffleKey(shuffleSeed, b.id);
        if (ka !== kb) return ka - kb;
        return a.name.localeCompare(b.name);
      });
      return { ...t, items, layout: packDense(items) };
    }
    if (strategy === "value") {
      items.sort((a, b) => b.stackValue - a.stackValue || a.name.localeCompare(b.name));
    } else if (strategy === "quantity") {
      items.sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));
    } else if (strategy === "name") {
      items.sort((a, b) => a.name.localeCompare(b.name));
    }
    return { ...t, items, layout: packDense(items) };
  });

  if (strategy === "smart" && archetype !== "unspecified") {
    // Smart tidy also re-orders tabs themselves to match the archetype's
    // preferred tab strip, so the *first* visible tab is what they care about.
    resorted.sort((a, b) => tabPriority(archetype, a.name) - tabPriority(archetype, b.name));
  }
  return resorted;
}
