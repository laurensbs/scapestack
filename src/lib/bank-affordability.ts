// "You have 14.5m. These two pieces cost 1.84m. Buy both and you're done."
//
// This is the one sentence Scapestack can say that nothing else in the OSRS
// ecosystem can. Not because it is clever — because of what it can see.
//
//   The wiki is a document store. It has every item and every price, and no
//   idea what is in your bank.
//   Wise Old Man and TempleOSRS track XP and KC.
//   Jagex's own Activity Adviser reads stats and quest progress.
//   WikiSync (324,099 installs) sends quests, diaries and collection log.
//
// None of them see the bank, and none of them can, because a bank is mutable
// per-account state. Scapestack has it and, until now, used half of it: goals.ts
// says out loud that it picked untradeable goals partly because "they don't
// fluctuate with GE prices". That was a sensible choice for a static table and
// it is exactly why the product never asked the only question it owns.
//
// So: take what is in the bank, take what the goal sets say a set contains,
// price the gap at live GE rates, and answer whether tonight's coins cover it.

import { GOAL_SETS, type Goal, type GoalSet } from "./goals";
import { getLatestPrices, getWikiItemMapping, type WikiLatestPrice } from "./wiki";

/** Coins. The one item whose quantity is the answer rather than an input. */
export const COINS_ITEM_ID = 995;

export interface AffordabilityBankItem {
  id: number;
  name: string;
  quantity?: number;
}

export interface MissingPiece {
  goalId: string;
  name: string;
  /** Insta-buy price. Null when the item has no live price at all. */
  price: number | null;
  /** False when nothing in this goal can be bought — an untradeable. */
  tradeable: boolean;
}

export interface AffordableSet {
  setId: string;
  setName: string;
  owned: number;
  total: number;
  missing: MissingPiece[];
  /** Sum of the missing pieces. Null when any piece has no price. */
  cost: number | null;
  /** Null when we could not price the gap, so nothing is claimed either way. */
  affordable: boolean | null;
  /** What is left over afterwards. Null for the same reason. */
  remainingGp: number | null;
}

export interface AffordabilityReport {
  /** Coins in the bank. Zero is a real answer; it is not "unknown". */
  gp: number;
  /** Priced, buyable, and you have the coins — closest to done first. */
  buyableNow: AffordableSet[];
  /** Priced and buyable, but short. Ordered by how short. */
  shortBy: AffordableSet[];
  /** Sets whose gap contains something no amount of GP will fix. */
  notForSale: AffordableSet[];
  /** True when the GE price feed was unavailable, so nothing is claimed. */
  pricesUnavailable: boolean;
}

/**
 * Which item ids satisfy a goal.
 *
 * 214 of the 218 goals carry only a name pattern, so an id list alone prices
 * almost nothing. The ids do not need typing: the Grand Exchange mapping
 * already published by prices.runescape.wiki lists every tradeable item with
 * its name, and `getWikiItemMapping()` fetches and caches it.
 *
 * That mapping also settles tradeability exactly. Presence in it IS being
 * tradeable — the GE does not list what it will not sell — so "no id" and
 * "cannot be bought" become the same fact instead of two guesses.
 */
function goalItemIds(goal: Goal, tradeableIdsByName: ReadonlyMap<string, number>): number[] {
  if (goal.itemIds?.length) return goal.itemIds;
  const id = tradeableIdsByName.get(goal.name.toLowerCase());
  return id === undefined ? [] : [id];
}

/** name -> id, for the tradeable universe. Built once per report. */
export function tradeableIndex(
  mapping: ReadonlyMap<number, { id: number; name: string }>
): Map<string, number> {
  const out = new Map<string, number>();
  for (const entry of mapping.values()) {
    const key = entry.name.toLowerCase();
    // First wins: the mapping is stable and a duplicate name is a variant we
    // have no way to choose between here. cheapestPrice does the choosing when
    // a goal really does list several ids.
    if (!out.has(key)) out.set(key, entry.id);
  }
  return out;
}

function ownsGoal(
  goal: Goal,
  ownedIds: ReadonlySet<number>,
  ownedNames: readonly string[],
  tradeableIdsByName: ReadonlyMap<string, number>
): boolean {
  for (const id of goalItemIds(goal, tradeableIdsByName)) {
    if (ownedIds.has(id)) return true;
  }
  if (goal.namePattern) {
    return ownedNames.some((name) => goal.namePattern!.test(name));
  }
  return false;
}

/**
 * The cheapest live price among the ids that satisfy this goal.
 *
 * A goal is often satisfied by several ids — charged and uncharged, trimmed and
 * plain. A player buying one buys the cheapest that counts, so that is the
 * honest number. Using the first id in the list would quote the wrong figure
 * whenever the list happens to start with the expensive variant.
 */
function cheapestPrice(
  goal: Goal,
  prices: ReadonlyMap<number, WikiLatestPrice>,
  tradeableIdsByName: ReadonlyMap<string, number>
): number | null {
  let best: number | null = null;
  for (const id of goalItemIds(goal, tradeableIdsByName)) {
    const entry = prices.get(id);
    // `high` is the insta-buy side. Someone who wants it tonight pays the
    // offer, not the bid; quoting `low` would understate every gap on the page.
    const price = entry && entry.high > 0 ? entry.high : null;
    if (price === null) continue;
    if (best === null || price < best) best = price;
  }
  return best;
}

function analyseSet(
  set: GoalSet,
  ownedIds: ReadonlySet<number>,
  ownedNames: readonly string[],
  prices: ReadonlyMap<number, WikiLatestPrice>,
  tradeableIdsByName: ReadonlyMap<string, number>,
  gp: number
): AffordableSet {
  const missing: MissingPiece[] = [];
  let owned = 0;

  for (const goal of set.goals) {
    if (ownsGoal(goal, ownedIds, ownedNames, tradeableIdsByName)) {
      owned += 1;
      continue;
    }
    const ids = goalItemIds(goal, tradeableIdsByName);
    const price = ids.length > 0 ? cheapestPrice(goal, prices, tradeableIdsByName) : null;
    missing.push({
      goalId: goal.id,
      name: goal.name,
      price,
      // No ids means we have no purchasable handle on it. That is reported as
      // not-for-sale rather than as unpriced, because for the player the
      // outcome is the same: money will not finish this set tonight.
      tradeable: ids.length > 0 && price !== null
    });
  }

  const anyUnpurchasable = missing.some((piece) => !piece.tradeable);
  const cost = anyUnpurchasable
    ? null
    : missing.reduce((sum, piece) => sum + (piece.price ?? 0), 0);

  return {
    setId: set.id,
    setName: set.name,
    owned,
    total: set.goals.length,
    missing,
    cost,
    affordable: cost === null ? null : cost <= gp,
    remainingGp: cost === null ? null : gp - cost
  };
}

/**
 * Closest to done first, then cheapest.
 *
 * Ranking on cost alone surfaces a set you own nothing of because one piece is
 * cheap. Ranking on completion alone surfaces a 25-item set you are one
 * expensive piece short of. What a player means by "what can I finish tonight"
 * is the fewest remaining purchases, and cost breaks the tie.
 */
/**
 * Is being short of this worth telling someone about?
 *
 * Measured on a real 42m bank: without this filter the panel printed
 * "CoX uniques — Short 1,740,331,472 gp", which is not information, it is
 * arithmetic performed at the player. A gap you could close in a session or
 * two is a goal; a gap forty times your bank is a different game.
 *
 * Three times current GP is the line. It survives a player with 0 gp — the
 * multiply gives 0 and nothing qualifies, which is the right answer, because
 * with no coins nothing is nearly affordable.
 */
const REACH_MULTIPLE = 3;

function withinReach(row: AffordableSet, gp: number): boolean {
  return row.cost !== null && row.cost <= gp * REACH_MULTIPLE;
}

function byClosestThenCheapest(left: AffordableSet, right: AffordableSet): number {
  if (left.missing.length !== right.missing.length) return left.missing.length - right.missing.length;
  return (left.cost ?? Infinity) - (right.cost ?? Infinity);
}

export function coinsIn(bank: readonly AffordabilityBankItem[]): number {
  let total = 0;
  for (const item of bank) {
    if (item.id === COINS_ITEM_ID) total += Math.max(0, Math.floor(item.quantity ?? 0));
  }
  return total;
}

/** Pure core, so the ranking and the arithmetic are testable without a network. */
export function buildAffordabilityReport(
  bank: readonly AffordabilityBankItem[],
  prices: ReadonlyMap<number, WikiLatestPrice>,
  tradeableIdsByName: ReadonlyMap<string, number>,
  sets: readonly GoalSet[] = GOAL_SETS
): AffordabilityReport {
  const gp = coinsIn(bank);
  const ownedIds = new Set(bank.map((item) => item.id));
  const ownedNames = bank.map((item) => item.name.toLowerCase());
  const pricesUnavailable = prices.size === 0;

  const analysed = sets
    .map((set) => analyseSet(set, ownedIds, ownedNames, prices, tradeableIdsByName, gp))
    // A finished set is not an opportunity, and a set you own nothing of is
    // not "close". Both are noise on a page that answers "tonight".
    .filter((row) => row.missing.length > 0 && row.owned > 0);

  return {
    gp,
    pricesUnavailable,
    buyableNow: analysed
      .filter((row) => row.affordable === true)
      .sort(byClosestThenCheapest),
    shortBy: analysed
      .filter((row) => row.affordable === false && withinReach(row, gp))
      .sort((left, right) => (left.cost ?? 0) - (right.cost ?? 0)),
    notForSale: analysed
      .filter((row) => row.affordable === null)
      .sort(byClosestThenCheapest)
  };
}

export async function affordabilityReport(
  bank: readonly AffordabilityBankItem[],
  sets: readonly GoalSet[] = GOAL_SETS
): Promise<AffordabilityReport> {
  const [prices, mapping] = await Promise.all([getLatestPrices(), getWikiItemMapping()]);
  return buildAffordabilityReport(bank, prices, tradeableIndex(mapping), sets);
}

/**
 * The sentence itself.
 *
 * Written the way a player would say it: the number they have, the number it
 * costs, and what happens next. No "unlock your potential", no "hours saved" —
 * a price and a verdict. Returns null when there is nothing true to say, which
 * is a real outcome and not a failure to render.
 */
export function affordabilityLine(report: AffordabilityReport): string | null {
  if (report.pricesUnavailable) return null;
  const best = report.buyableNow[0];
  if (!best) return null;
  const pieces = best.missing.length;
  const names = best.missing.map((piece) => piece.name);
  const what = pieces === 1
    ? names[0]
    : pieces === 2
      ? `${names[0]} and ${names[1]}`
      : `${pieces} pieces`;
  return `${formatGpExact(report.gp)} banked. ${what} — ${formatGpExact(best.cost ?? 0)}. `
    + `That finishes ${best.setName}.`;
}

/**
 * GP the way the game writes it.
 *
 * Deliberately not the site's existing formatGp, which rounds 1,843,201 to
 * "1.84M". A player deciding whether to buy needs the figure they will type
 * into the Grand Exchange, not a headline.
 */
export function formatGpExact(value: number): string {
  return `${Math.round(value).toLocaleString("en-GB")} gp`;
}
