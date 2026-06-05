import { describe, expect, it } from "vitest";
import { ICON_URL, spriteIdForItem } from "@/lib/utils";

describe("ICON_URL", () => {
  it("routes item sprites through the Scapestack fallback proxy", () => {
    expect(ICON_URL(4151)).toBe("/api/sprite/item/4151.png");
    expect(ICON_URL(-995)).toBe("/api/sprite/item/995.png");
    expect(ICON_URL(Number.NaN)).toBe("/api/sprite/item/995.png");
  });
});

describe("spriteIdForItem", () => {
  it("uses OSRS coin stack sprite variants", () => {
    expect(spriteIdForItem(995, 1)).toBe(995);
    expect(spriteIdForItem(995, 2)).toBe(996);
    expect(spriteIdForItem(995, 1_000)).toBe(1003);
    expect(spriteIdForItem(995, 10_000)).toBe(1004);
  });

  it("keeps non-coin item IDs stable", () => {
    expect(spriteIdForItem(4151, 10_000)).toBe(4151);
  });
});
