import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const shuffleLoaderSource = readFileSync(join(process.cwd(), "src/components/shuffle-loader.tsx"), "utf8");
const intakeSource = readFileSync(join(process.cwd(), "src/components/intake.tsx"), "utf8");

describe("first impression sprites", () => {
  it("keeps the first-load experience stable without fake progress or item-ID noise", () => {
    expect(shuffleLoaderSource).toContain("<Route");
    expect(shuffleLoaderSource).toContain("Building your next trip");
    expect(shuffleLoaderSource).toContain("One clear pick is next.");
    expect(shuffleLoaderSource).not.toContain("LOADER_BOSSES");
    expect(shuffleLoaderSource).not.toContain("LOADER_STEPS");
    expect(shuffleLoaderSource).not.toContain("Checking {active.label}");
    expect(shuffleLoaderSource).not.toContain("loading=\"eager\"");
    expect(shuffleLoaderSource).not.toContain("ITEM_POOL");
    expect(shuffleLoaderSource).not.toContain("<ItemSprite");
    expect(shuffleLoaderSource).not.toContain('import { ICON_URL } from "@/lib/utils";');
    expect(shuffleLoaderSource).not.toContain("src={ICON_URL(itemId)}");
    expect(shuffleLoaderSource).not.toContain("LORE_QUOTES");
    expect(shuffleLoaderSource).not.toContain("I'm only checking the GE.");
    expect(shuffleLoaderSource).not.toContain("key={quote}");
    expect(shuffleLoaderSource).not.toContain("setQuote");

    expect(intakeSource).toContain('import { ItemSprite } from "@/components/item-sprite";');
    expect(intakeSource).toContain("<ItemSprite");
    expect(intakeSource).not.toContain("ICON_URL");
  });
});
