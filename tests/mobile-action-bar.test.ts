import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/mobile-action-bar.tsx"), "utf8");
const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");

describe("mobile action bar", () => {
  it("keeps the core account flow thumb-first on mobile", () => {
    expect(source).toContain('aria-label="Mobile quick actions"');
    expect(source).toContain('import { usePathname } from "next/navigation";');
    expect(source).toContain('if (pathname === "/") return null;');
    expect(source).toContain("Plan");
    expect(source).toContain("Add bank");
    expect(source).toContain("RuneLite");
    expect(source).toContain("Mood");
    expect(source).toContain("SessionMoodPicker");
    expect(source).toContain("<SessionMoodPicker rsn={rsn} label={mood} mobileTile />");
    expect(source).toContain("loadSavedBank(nextRsn)");
    expect(source).toContain("loadMood(nextRsn)");
    expect(source).toContain("SAVED_BANK_EVENT");
    expect(source).toContain("fixed inset-x-0 bottom-0");
    expect(layout).toContain('import { MobileActionBar } from "@/components/mobile-action-bar";');
    expect(layout).toContain("<MobileActionBar />");
  });
});
