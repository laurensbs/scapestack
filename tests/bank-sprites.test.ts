import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const bankResultSource = readFileSync(
  join(process.cwd(), "src/components/bank-result.tsx"),
  "utf8",
);

describe("bank sprites", () => {
  it("routes bank grid, tab, drag, preset, and detail sprites through ItemSprite", () => {
    expect(bankResultSource).toContain('import { ItemSprite } from "./item-sprite";');
    expect(bankResultSource).toContain("<ItemSprite");
    expect(bankResultSource).toContain("id={spriteIdForItem(item.id, item.quantity)}");
    expect(bankResultSource).toContain("id={spriteIdForItem(dragging.id, dragging.quantity)}");
    expect(bankResultSource).toContain("id={BANK_FILLER_ID}");
    expect(bankResultSource).not.toContain("ICON_URL");
    expect(bankResultSource).not.toContain("src={ICON_URL");
  });
});
