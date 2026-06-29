import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/item-sprite.tsx"), "utf8");

describe("ItemSprite fallback UX", () => {
  it("does not silently render coins for unknown item IDs", () => {
    expect(source).toContain("fallbackId = 0");
    expect(source).toContain("data-sprite-fallback=\"missing\"");
    expect(source).toContain("data-sprite-missing-id={cleanId || undefined}");
    expect(source).toContain("sprite unavailable");
    expect(source).toContain("<span aria-hidden=\"true\">?</span>");
    expect(source).not.toContain("item ID");
    expect(source).not.toContain("{cleanId ? `#${cleanId}` : \"ID ?\"}");
    expect(source).not.toContain("max-w-full truncate");
  });

  it("resets the fallback stage when a reused sprite receives a new item ID", () => {
    expect(source).toContain("useEffect");
    expect(source).toContain('setStage("primary");');
    expect(source).toContain("[cleanId, cleanFallbackId]");
  });
});
