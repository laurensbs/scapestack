import type { BankSnapshot } from "./diff";
import type { BankHandoffItem } from "./next-bank-handoff";

export function bankHandoffItemsFromSnapshot(snap: BankSnapshot): BankHandoffItem[] {
  return snap.items.map((item, index) => {
    const quantity = Math.max(1, Math.trunc(Number(item.quantity)) || 1);
    const stackValue = Math.max(0, Math.trunc(Number(item.stackValue)) || 0);

    return {
      id: item.id,
      name: item.name,
      quantity,
      unitPrice: stackValue > 0 ? Math.round(stackValue / quantity) : 0,
      stackValue,
      subtab: "Profile snapshot",
      slot: null,
      weight: index
    };
  });
}
