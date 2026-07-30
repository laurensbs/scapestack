import moneyMethodsJson from "../../data/wiki/derived/money-methods.json";

export interface WikiMoneyItem {
  name: string;
  itemIds: number[];
  tradeable: boolean;
  quantity: number;
  perHour: boolean;
  requiredToStart: number;
  wikiUnitValue: number;
  priceType: string | null;
}

export interface WikiMoneyEquipmentAlternative {
  name: string;
  itemIds: number[];
  tradeable: boolean;
}

export interface WikiMoneyLoadout {
  page: string;
  style: string | null;
  slots: Array<{ slot: string; alternatives: WikiMoneyEquipmentAlternative[] }>;
}

export interface WikiMoneyMethod {
  id: string;
  page: string;
  activity: string;
  category: string | null;
  intensity: string | null;
  members: boolean;
  wikiGpPerHour: number;
  killsPerHour: number;
  skillRequirements: Array<{ skill: string; level: number }>;
  questRequirements: string[];
  inputs: WikiMoneyItem[];
  outputs: WikiMoneyItem[];
  loadouts: WikiMoneyLoadout[];
}

export interface MoneyMethodBankItem {
  id: number;
  name: string;
  quantity: number;
}

export interface MoneyMethodMissing {
  skills: string[];
  quests: string[];
  items: string[];
  equipment: string[];
}

export interface EvaluatedMoneyMethod {
  id: string;
  page: string;
  activity: string;
  category: string | null;
  intensity: string | null;
  gpPerHour: number;
  startable: boolean;
  banked: string[];
  buyable: string[];
  purchaseCost: number;
  loadoutStyle: string | null;
  missing: MoneyMethodMissing;
}

export interface MoneyMethodFilterReport {
  totalMethods: number;
  startableCount: number;
  cannotBuy: boolean;
  livePricesUsed: boolean;
  methods: EvaluatedMoneyMethod[];
  startable: EvaluatedMoneyMethod[];
}

export interface BuildMoneyMethodFilterInput {
  methods?: readonly WikiMoneyMethod[];
  skills: ReadonlyArray<{ name: string; level: number }>;
  questsCompleted: readonly string[];
  bank: readonly MoneyMethodBankItem[];
  prices: ReadonlyMap<number, number>;
  /** Same shape and meaning as BankAffordabilityPanel: this account cannot
   * turn a missing tradeable input into a Grand Exchange purchase. */
  cannotBuy: boolean;
}

export const WIKI_MONEY_METHODS = moneyMethodsJson as unknown as WikiMoneyMethod[];

function normalized(value: string): string {
  return value.trim().toLowerCase().replace(/[_\s]+/g, " ");
}

function combatLevel(skills: ReadonlyMap<string, number>): number {
  const level = (name: string) => skills.get(normalized(name)) ?? 1;
  const base = 0.25 * (level("Defence") + level("Hitpoints") + Math.floor(level("Prayer") / 2));
  const melee = 0.325 * (level("Attack") + level("Strength"));
  const ranged = 0.325 * (Math.floor(level("Ranged") / 2) + level("Ranged"));
  const magic = 0.325 * (Math.floor(level("Magic") / 2) + level("Magic"));
  return Math.floor(base + Math.max(melee, ranged, magic));
}

function bankIndexes(bank: readonly MoneyMethodBankItem[]): {
  byId: Map<number, number>;
  byName: Map<string, number>;
} {
  const byId = new Map<number, number>();
  const byName = new Map<string, number>();
  for (const item of bank) {
    const quantity = Math.max(0, Math.floor(item.quantity));
    const id = Math.abs(Math.trunc(item.id));
    if (id > 0) byId.set(id, (byId.get(id) ?? 0) + quantity);
    const name = normalized(item.name);
    if (name) byName.set(name, (byName.get(name) ?? 0) + quantity);
  }
  return { byId, byName };
}

function bankQuantity(
  indexes: ReturnType<typeof bankIndexes>,
  item: { itemIds: readonly number[]; name: string }
): number {
  if (item.itemIds.length > 0) {
    return item.itemIds.reduce((total, id) => total + (indexes.byId.get(Math.abs(id)) ?? 0), 0);
  }
  return indexes.byName.get(normalized(item.name)) ?? 0;
}

function livePrice(itemIds: readonly number[], prices: ReadonlyMap<number, number>): number | null {
  let cheapest: number | null = null;
  for (const itemId of itemIds) {
    const price = prices.get(Math.abs(itemId));
    if (!price || price <= 0) continue;
    if (cheapest === null || price < cheapest) cheapest = price;
  }
  return cheapest;
}

function hourlyQuantity(item: WikiMoneyItem, killsPerHour: number): number {
  return item.quantity * (item.perHour ? 1 : Math.max(1, killsPerHour));
}

function hourlyValue(
  items: readonly WikiMoneyItem[],
  killsPerHour: number,
  prices: ReadonlyMap<number, number>
): number {
  return items.reduce((total, item) => {
    const price = livePrice(item.itemIds, prices) ?? item.wikiUnitValue;
    return total + Math.max(0, price) * hourlyQuantity(item, killsPerHour);
  }, 0);
}

function currentGpPerHour(method: WikiMoneyMethod, prices: ReadonlyMap<number, number>): number {
  if (prices.size === 0 || method.outputs.length === 0) return Math.max(0, Math.round(method.wikiGpPerHour));
  const output = hourlyValue(method.outputs, method.killsPerHour, prices);
  const input = hourlyValue(method.inputs, method.killsPerHour, prices);
  return Math.max(0, Math.round(output - input));
}

interface LoadoutEvaluation {
  style: string | null;
  banked: string[];
  buyable: string[];
  purchaseCost: number;
  missing: string[];
}

function evaluateLoadout(
  loadout: WikiMoneyLoadout,
  indexes: ReturnType<typeof bankIndexes>,
  prices: ReadonlyMap<number, number>,
  cannotBuy: boolean
): LoadoutEvaluation {
  const result: LoadoutEvaluation = {
    style: loadout.style,
    banked: [],
    buyable: [],
    purchaseCost: 0,
    missing: []
  };
  for (const slot of loadout.slots) {
    const owned = slot.alternatives.find((alternative) => bankQuantity(indexes, alternative) > 0);
    if (owned) {
      result.banked.push(owned.name);
      continue;
    }
    const purchasable = cannotBuy
      ? null
      : slot.alternatives
          .map((alternative) => ({ alternative, price: alternative.tradeable ? livePrice(alternative.itemIds, prices) : null }))
          .filter((entry): entry is { alternative: WikiMoneyEquipmentAlternative; price: number } => entry.price !== null)
          .sort((left, right) => left.price - right.price)[0] ?? null;
    if (purchasable) {
      result.buyable.push(purchasable.alternative.name);
      result.purchaseCost += purchasable.price;
    } else {
      result.missing.push(slot.slot);
    }
  }
  return result;
}

function firstUsableLoadout(
  loadouts: readonly WikiMoneyLoadout[],
  indexes: ReturnType<typeof bankIndexes>,
  prices: ReadonlyMap<number, number>,
  cannotBuy: boolean,
  availableCoins: number
): { selected: LoadoutEvaluation | null; missing: string[] } {
  if (loadouts.length === 0) return { selected: null, missing: [] };
  const evaluations = loadouts.map((loadout) => evaluateLoadout(loadout, indexes, prices, cannotBuy));
  // Preserve the wiki's row order. A fully banked explicit loadout wins; if
  // none is banked, take the first explicit loadout the account can afford.
  const selected = evaluations.find((evaluation) => evaluation.missing.length === 0 && evaluation.purchaseCost === 0)
    ?? evaluations.find((evaluation) => evaluation.missing.length === 0 && evaluation.purchaseCost <= availableCoins)
    ?? null;
  if (selected) return { selected, missing: [] };
  const first = evaluations[0];
  return {
    selected: null,
    missing: first
      ? [...first.missing, ...(first.purchaseCost > availableCoins ? first.buyable : [])]
      : []
  };
}

function evaluateMethod(
  method: WikiMoneyMethod,
  input: BuildMoneyMethodFilterInput,
  skills: ReadonlyMap<string, number>,
  indexes: ReturnType<typeof bankIndexes>,
  completedQuests: ReadonlySet<string>,
  coins: number
): EvaluatedMoneyMethod {
  const missing: MoneyMethodMissing = { skills: [], quests: [], items: [], equipment: [] };
  const banked: string[] = [];
  const buyable: string[] = [];
  let purchaseCost = 0;

  for (const requirement of method.skillRequirements) {
    const actual = normalized(requirement.skill) === "combat level"
      ? combatLevel(skills)
      : skills.get(normalized(requirement.skill)) ?? 1;
    if (actual < requirement.level) missing.skills.push(`${requirement.skill} ${requirement.level}`);
  }
  for (const quest of method.questRequirements) {
    if (!completedQuests.has(normalized(quest))) missing.quests.push(quest);
  }

  for (const item of method.inputs) {
    const required = Math.max(1, Math.ceil(item.requiredToStart));
    const owned = bankQuantity(indexes, item);
    if (owned >= required) {
      banked.push(item.name);
      continue;
    }
    const short = required - owned;
    const price = item.tradeable && item.itemIds.some((id) => Math.abs(id) !== 995)
      ? livePrice(item.itemIds, input.prices)
      : null;
    if (!input.cannotBuy && price !== null) {
      buyable.push(item.name);
      purchaseCost += price * short;
    } else {
      missing.items.push(item.name);
    }
  }

  const loadout = firstUsableLoadout(
    method.loadouts,
    indexes,
    input.prices,
    input.cannotBuy,
    Math.max(0, coins - purchaseCost)
  );
  if (loadout.selected) {
    banked.push(...loadout.selected.banked);
    buyable.push(...loadout.selected.buyable);
    purchaseCost += loadout.selected.purchaseCost;
  } else {
    missing.equipment.push(...loadout.missing);
  }

  if (purchaseCost > coins) {
    // The proposed GE cover is not actually in the bank. Keep the concrete
    // item names in the explanation rather than claiming coins can stretch.
    missing.items.push(...buyable);
  }
  const startable = missing.skills.length === 0
    && missing.quests.length === 0
    && missing.items.length === 0
    && missing.equipment.length === 0
    && purchaseCost <= coins;

  return {
    id: method.id,
    page: method.page,
    activity: method.activity,
    category: method.category,
    intensity: method.intensity,
    gpPerHour: currentGpPerHour(method, input.prices),
    startable,
    banked: [...new Set(banked)],
    buyable: startable ? [...new Set(buyable)] : [],
    purchaseCost: startable ? purchaseCost : 0,
    loadoutStyle: loadout.selected?.style ?? null,
    missing
  };
}

export function buildMoneyMethodFilter(input: BuildMoneyMethodFilterInput): MoneyMethodFilterReport {
  const methods = input.methods ?? WIKI_MONEY_METHODS;
  const skills = new Map(input.skills.map((skill) => [normalized(skill.name), Math.max(1, Math.floor(skill.level))]));
  const completedQuests = new Set(input.questsCompleted.map(normalized));
  const indexes = bankIndexes(input.bank);
  const coins = indexes.byId.get(995) ?? 0;
  const evaluated = methods.map((method) => evaluateMethod(method, input, skills, indexes, completedQuests, coins));
  const startable = evaluated
    .filter((method) => method.startable)
    .sort(input.cannotBuy
      ? (left, right) => left.activity.localeCompare(right.activity)
      : (left, right) => right.gpPerHour - left.gpPerHour || left.activity.localeCompare(right.activity));
  return {
    totalMethods: methods.length,
    startableCount: startable.length,
    cannotBuy: input.cannotBuy,
    livePricesUsed: input.prices.size > 0,
    methods: evaluated,
    startable
  };
}

export function moneyMethodCountLine(report: MoneyMethodFilterReport): string {
  return `Of ${report.totalMethods.toLocaleString("en-US")} Wiki money methods, ${report.startableCount.toLocaleString("en-US")} you can start right now with what is in your bank.`;
}
