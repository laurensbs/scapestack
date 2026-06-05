import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("bank item click affordance", () => {
  it("makes item tiles visibly actionable for Wiki, GE price and ID lookup", () => {
    const source = readFileSync(join(process.cwd(), "src/components/bank-result.tsx"), "utf8");

    expect(source).toContain("Click item for Wiki, GE price and ID");
    expect(source).toContain("Open OSRS Wiki");
    expect(source).toContain("GE price page");
    expect(source).toContain("Copy item ID");
    expect(source).toContain("Copy debug packet");
    expect(source).toContain("Scapestack item debug");
    expect(source).toContain("Search: #${item.id}");
    expect(source).toContain("Wiki: ${wikiHref}");
    expect(source).toContain("GE: ${priceHref}");
    expect(source).toContain("item debug packet");
    expect(source).toContain("Copy ${item.name} item debug packet with ID, Wiki, GE and bank search");
    expect(source).toContain('useState<"id" | "name" | "debug" | "error" | null>(null)');
    expect(source).toContain("setManualItemCopy({");
    expect(source).toContain("Clipboard failed — copy {manualItemCopy.label} manually");
    expect(source).toContain("Manual copy fallback for");
    expect(source).toContain("event.currentTarget.select()");
    expect(source).toContain("aria-label={`Open ${item.name} details. OSRS item #${item.id}`}");
    expect(source).toContain("const isUnknownFallbackTile = /^unknown item #?\\d+$/i.test(item.name) || /^item id #?\\d+$/i.test(item.name);");
    expect(source).toContain("unknown OSRS IDs stay visible as labelled fallback tiles instead.");
    expect(source).toContain('data-testid="unknown-item-id-badge"');
    expect(source).toContain("Unknown OSRS item ID #${item.id} kept as a fallback tile");
    expect(source).toContain("unknown ID fallback");
    expect(source).toContain("const target = event.target as HTMLElement;");
    expect(source).toContain('if (target !== event.currentTarget && target.closest("button,a")) return;');
    expect(source).toContain("const tileDragAttributes = {");
    expect(source).toContain("role: undefined");
    expect(source).toContain("tabIndex: undefined");
    expect(source).toContain("{...tileDragAttributes}");
    expect(source).toContain("<button\n        type=\"button\"\n        onClick={openDetail}");
    expect(source).toContain("key={`${i}:${item.id}`}");
    expect(source).toContain('className="group relative touch-none"');
    expect(source).toContain("relative h-full w-full cursor-grab active:cursor-grabbing");
    expect(source).toContain("aria-label={`Open item ID details for ${item.name}`}");
    expect(source).toContain("title={`Open item ID details for ${item.name}`}");
    expect(source).toContain("absolute right-0 top-0 z-20 flex size-3");
    expect(source).toContain('<span className="sr-only">ID</span>');
    expect(source).toContain("absolute right-0 bottom-0 z-20 flex size-3 sm:hidden sm:group-hover:flex sm:group-focus-within:flex");
    expect(source).toContain('<span className="sr-only">Wiki</span>');
    expect(source).toContain("onPointerDown={stopWikiDrag}");
    expect(source).not.toContain("onKeyDown={openDetailFromKeyboard}");
    expect(source).not.toContain(`role="button"
        tabIndex={0}
        aria-label={\`Open \${item.name} details. OSRS item #\${item.id}\`}`);

    const wrapperIndex = source.indexOf('className="group relative touch-none"');
    const tileIndex = source.indexOf("relative h-full w-full cursor-grab active:cursor-grabbing");
    const detailButtonIndex = source.indexOf("aria-label={`Open item ID details for ${item.name}`}");
    const wikiButtonIndex = source.indexOf("aria-label={`Open ${item.name} on the OSRS Wiki`}", detailButtonIndex);

    expect(wrapperIndex).toBeGreaterThan(-1);
    expect(tileIndex).toBeGreaterThan(wrapperIndex);
    expect(detailButtonIndex).toBeGreaterThan(tileIndex);
    expect(wikiButtonIndex).toBeGreaterThan(detailButtonIndex);
  });
});
