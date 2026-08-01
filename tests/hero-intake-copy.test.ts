import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  viewerRsn: null as string | null,
  push: vi.fn(),
  replace: vi.fn(),
  redirect: vi.fn((path: string): never => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  })
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
  redirect: navigation.redirect
}));

vi.mock("@/lib/viewer-account", () => ({
  resolveViewerRsn: async () => navigation.viewerRsn
}));

import HomePage from "@/app/page";
import { HeroIntake } from "@/components/hero-intake";

const source = readFileSync(join(process.cwd(), "src/components/hero-intake.tsx"), "utf8");

describe("Phase 6 homepage intake", () => {
  beforeEach(() => {
    navigation.viewerRsn = null;
    vi.clearAllMocks();
  });

  it("renders the component as exactly one RSN field and one Open my page button", async () => {
    const heroMarkup = renderToStaticMarkup(createElement(HeroIntake));
    const pageMarkup = renderToStaticMarkup(await HomePage());

    expect(heroMarkup.match(/<form\b/g)).toHaveLength(1);
    expect(heroMarkup.match(/<input\b/g)).toHaveLength(1);
    expect(heroMarkup.match(/<button\b/g)).toHaveLength(1);
    expect(heroMarkup).toContain(">Open my page</button>");
    expect(heroMarkup).toContain('name="rsn"');
    expect(heroMarkup).toContain('required=""');
    expect(heroMarkup).not.toContain('role="dialog"');
    expect(pageMarkup.match(/<h1\b/g)).toHaveLength(1);
    expect(pageMarkup.match(/<p\b/g)).toHaveLength(1);
    expect(pageMarkup).not.toContain("HomeSpecimen");

    expect(source).toContain("router.push(playerPath(cleanRsn))");
    expect(source).not.toContain("router.replace(");
    expect(source).not.toContain("getActiveAccount");
    expect(source).not.toContain("loadSavedRsn");
    expect(source).not.toContain("useEffect");
    expect(source).not.toContain("rememberedRsn");
    expect(source).not.toContain("Welcome back");
    expect(source).not.toContain("AddBankModal");
    expect(source).not.toContain("RuneliteOpenButton");
    expect(source).not.toContain("osrs-title-bar");
  });

  it("redirects a server-known account straight to its canonical player document", async () => {
    navigation.viewerRsn = "Lynx Titan";

    await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT:/p/Lynx%20Titan");
    expect(navigation.redirect).toHaveBeenCalledOnce();
    expect(navigation.redirect).toHaveBeenCalledWith("/p/Lynx%20Titan");
  });
});
