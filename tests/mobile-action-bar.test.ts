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
    expect(source).toContain("Trip");
    expect(source).toContain('active: pathname === "/next"');
    expect(source).toContain("Add bank");
    expect(source).toContain("Setup");
    expect(source).toContain("RuneLite");
    expect(source).toContain("Mood");
    expect(source).toContain("SessionMoodPicker");
    expect(source).toContain("loadAccountSnapshot");
    expect(source).toContain("const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null);");
    expect(source).toContain("setSnapshot(loadAccountSnapshot());");
    expect(source).toContain("const nextHref = snapshot?.planHref");
    expect(source).toContain('<SessionMoodPicker rsn={rsn} label={snapshot?.moodLabel ?? "Mood"} mobileTile />');
    expect(source).toContain("SAVED_BANK_EVENT");
    expect(source).toContain("fixed inset-x-0 bottom-0");
    expect(layout).toContain('import { MobileActionBar } from "@/components/mobile-action-bar";');
    expect(layout).toContain("pb-24 sm:pb-0");
    expect(layout).toContain("<MobileActionBar />");
  });
});
