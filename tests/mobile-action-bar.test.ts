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
    expect(source).toContain('selected: pathname === "/next"');
    expect(source).toContain('label: "Bank"');
    expect(source).toContain("complete: hasBank");
    expect(source).toContain("RuneLite");
    expect(source).toContain("complete: hasRunelite");
    expect(source).toContain("Mood");
    expect(source).toContain("SessionMoodPicker");
    expect(source).toContain("loadAccountSnapshot");
    expect(source).toContain("const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null);");
    expect(source).toContain("setSnapshot(loadAccountSnapshot());");
    expect(source).toContain("const nextHref = snapshot?.planHref");
    expect(source).toContain('<SessionMoodPicker rsn={rsn} label={snapshot?.moodLabel ?? "Mood"} mobileTile />');
    expect(source).toContain("SAVED_BANK_EVENT");
    expect(source).toContain("fixed inset-x-0 bottom-0");
    expect(source).toContain('aria-current={action.selected ? "page" : undefined}');
    expect(source).not.toContain("action.helper");
    expect(layout).toContain('import { MobileActionBar } from "@/components/mobile-action-bar";');
    expect(layout).toContain("mobile-content-safe");
    expect(layout).toContain("mobile-footer-safe");
    expect(layout).toContain("<MobileActionBar />");
  });
});
