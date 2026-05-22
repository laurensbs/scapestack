// RuneLite Bank Tags + Bank Memory parsers / exporters.

const MAGIC = "banktags";
const VERSION = "1";
const NAME_FILTER = /[^A-Za-z0-9_\- ]/g;

export interface ParsedTag {
  name: string;
  iconItemId: number;
  items: number[];
  layout: Record<number, number>;
}

export interface BankMemoryRow {
  id: number;
  name: string;
  quantity: number;
}

export function parseTag(str: string): ParsedTag {
  if (!str) throw new Error("Empty Bank Tags string");
  const parts = str.trim().split(",");
  if (parts[0] !== MAGIC) throw new Error('Not a Bank Tags string (missing "banktags" prefix)');
  if (parts[1] !== VERSION) throw new Error(`Unsupported Bank Tags version "${parts[1]}"`);
  const name = sanitizeName(parts[2] ?? "imported");
  const iconItemId = toInt(parts[3]) ?? 995;

  const items: number[] = [];
  const layout: Record<number, number> = {};
  let i = 4;
  while (i < parts.length && parts[i] !== "layout") {
    const id = toInt(parts[i]);
    if (id !== null) items.push(id);
    i++;
  }
  if (parts[i] === "layout") {
    i++;
    while (i + 1 < parts.length) {
      const slot = toInt(parts[i]);
      const itemId = toInt(parts[i + 1]);
      if (slot !== null && itemId !== null) {
        layout[slot] = itemId;
        if (!items.includes(itemId)) items.push(itemId);
      }
      i += 2;
    }
  }
  return { name, iconItemId, items, layout };
}

export interface ExportableTab {
  name: string;
  iconItemId: number;
  items: Array<number | { id: number }>;
  layout?: Record<number, number>;
}

export function exportTag({ name, iconItemId, items = [], layout = {} }: ExportableTab): string {
  const ids = items
    .map((it) => (typeof it === "object" && it !== null ? it.id : it))
    .map(Number)
    .filter((n) => Number.isFinite(n));
  const fallbackIcon = ids[0] ?? 995;
  const parts = [MAGIC, VERSION, sanitizeName(name || "tab"), String(iconItemId || fallbackIcon)];

  const layoutSlots = Object.keys(layout)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  const layoutItemIds = new Set(layoutSlots.map((s) => layout[s]));

  for (const id of ids) if (!layoutItemIds.has(id)) parts.push(String(id));
  if (layoutSlots.length) {
    parts.push("layout");
    for (const slot of layoutSlots) parts.push(String(slot), String(layout[slot]));
  }
  return parts.join(",");
}

export function exportTags(tabs: ExportableTab[]): string[] {
  return tabs.map(exportTag);
}

// Bank Memory plugin TSV format (clipboard export):
//   Item id\tItem name\tItem quantity
//   4151\tAbyssal whip\t1
export function parseBankMemoryTsv(str: string): BankMemoryRow[] {
  const lines = String(str).replace(/\r\n/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) throw new Error("Empty Bank Memory export");
  const header = lines[0].toLowerCase();
  if (!header.includes("item id") || !header.includes("quantity")) {
    throw new Error('Bank Memory TSV needs a header row with "Item id" and "Item quantity"');
  }
  const rows: BankMemoryRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    if (cols.length < 3) continue;
    const id = toInt(cols[0]);
    const qty = toInt(cols[2]);
    if (id === null || qty === null) continue;
    rows.push({ id, name: String(cols[1] || "").trim(), quantity: qty });
  }
  if (!rows.length) throw new Error("Bank Memory TSV contained no item rows");
  return rows;
}

export function looksLikeBankMemoryTsv(str: string): boolean {
  if (!str) return false;
  const firstLine = str.split(/\r?\n/, 1)[0].toLowerCase();
  return firstLine.includes("\t") && firstLine.includes("item id");
}

function toInt(v: string | undefined | null): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function sanitizeName(name: string): string {
  return String(name).replace(NAME_FILTER, "").trim() || "tab";
}
