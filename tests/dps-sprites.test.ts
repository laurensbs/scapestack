import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const bossDetailModalSource = readFileSync(
  join(process.cwd(), "src/components/boss-detail-modal.tsx"),
  "utf8",
);
const dpsClientSource = readFileSync(
  join(process.cwd(), "src/app/dps/dps-client.tsx"),
  "utf8",
);
const bossPickerSource = readFileSync(
  join(process.cwd(), "src/components/boss-picker.tsx"),
  "utf8",
);

describe("DPS and boss sprites", () => {
  it("routes gear and boss item sprites through the resilient ItemSprite component", () => {
    expect(bossDetailModalSource).toContain(
      'import { ItemSprite } from "@/components/item-sprite";',
    );
    expect(bossDetailModalSource).toContain("<ItemSprite");
    expect(bossDetailModalSource).not.toContain("ICON_URL");

    expect(dpsClientSource).toContain(
      'import { ItemSprite } from "@/components/item-sprite";',
    );
    expect(dpsClientSource).toContain("<ItemSprite");
    expect(dpsClientSource).not.toContain("ICON_URL");
  });

  it("uses the shared labelled BossSprite fallback in DPS rows", () => {
    expect(dpsClientSource).toContain('import { BossSprite } from "@/components/boss-picker";');
    expect(dpsClientSource).toContain("<BossSprite boss={boss} size={36} />");
    expect(dpsClientSource).toContain("DPS rows never fall back to");
    expect(dpsClientSource).not.toContain('useState<"portrait" | "drop" | "dot">("portrait")');
    expect(dpsClientSource).not.toContain('className="size-9 shrink-0 rounded-full bg-[var(--color-text-muted)]/40 inline-block"');
  });

  it("labels boss sprite fallbacks instead of rendering an anonymous dot", () => {
    expect(bossPickerSource).toContain("data-boss-sprite-fallback=\"missing\"");
    expect(bossPickerSource).toContain("data-boss-sprite-missing-slug={boss.slug}");
    expect(bossPickerSource).toContain("sprite unavailable · boss");
    expect(bossPickerSource).toContain("role=\"img\"");
    expect(bossPickerSource).toContain("<span aria-hidden=\"true\">?</span>");
    expect(bossPickerSource).not.toContain("rounded-full bg-[var(--color-accent)]/70");
  });
});
