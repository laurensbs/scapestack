import { looksLikeBankMemoryTsv, parseBankMemoryTsv, parseTag } from "./bank-tags";

export interface LocalBankItem {
  id: number;
  name: string;
  quantity: number;
}

/**
 * Turn the device-only paste back into the small bank shape used by every
 * profile question. Bank Tags and plain id lists do not carry quantities, so
 * presence counts as one; Bank Memory keeps its exact stack sizes.
 */
export function localBankItemsFromPaste(
  input: string,
  namesById: ReadonlyMap<number, { name: string }>
): LocalBankItem[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  if (looksLikeBankMemoryTsv(trimmed)) {
    return parseBankMemoryTsv(trimmed).map((item) => ({
      id: Math.abs(item.id),
      name: item.name || namesById.get(Math.abs(item.id))?.name || `Unknown item #${Math.abs(item.id)}`,
      quantity: Math.max(0, item.quantity)
    }));
  }

  const ids = trimmed.startsWith("banktags,")
    ? parseTag(trimmed).items
    : trimmed.split(/[,\s]+/).map(Number).filter((id) => Number.isSafeInteger(id) && id !== 0);
  return [...new Set(ids.map((id) => Math.abs(id)))].map((id) => ({
    id,
    name: namesById.get(id)?.name || `Unknown item #${id}`,
    quantity: 1
  }));
}
