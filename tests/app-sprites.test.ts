import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const uiSpriteFiles = [
  "src/app/goals/goals-client.tsx",
  "src/app/u/[rsn]/local-bank-summary.tsx",
  "src/components/path-overview.tsx",
  "src/components/path-detail-modal.tsx",
  "src/app/dev/layout/page.tsx",
];

describe("app-wide item sprites", () => {
  it("keeps user-facing item icons behind the resilient ItemSprite component", () => {
    for (const file of uiSpriteFiles) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source, file).toContain("ItemSprite");
      expect(source, file).not.toContain("ICON_URL");
      expect(source, file).not.toContain("src={ICON_URL");
      expect(source, file).not.toContain("backgroundImage: `url(\"${ICON_URL");
    }
  });
});
