import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

function sourceFiles(root: string): string[] {
  const files: string[] = [];
  const walk = (path: string) => {
    for (const entry of readdirSync(path)) {
      const full = join(path, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
    }
  };
  walk(join(process.cwd(), root));
  return files;
}

describe("the plain-language RuneLite connection", () => {
  it("ships an eight-character /link handoff with one browser approval button", () => {
    const pagePath = "src/app/link/page.tsx";
    const formPath = "src/components/link-account-form.tsx";
    const openRoutePath = "src/app/api/account/pair/open/route.ts";
    for (const path of [pagePath, formPath, openRoutePath]) {
      expect(existsSync(join(process.cwd(), path)), `${path} must exist`).toBe(true);
    }
    if (![pagePath, formPath, openRoutePath].every((path) => existsSync(join(process.cwd(), path)))) return;

    const page = read(pagePath);
    const form = read(formPath);
    const openRoute = read(openRoutePath);
    expect(page).toContain("searchParams: Promise");
    expect(page).toContain("normalizePairingCode");
    expect(page).toContain("<LinkAccountForm code={code}");
    expect(form).toContain("<form action={formAction}");
    expect(form).toContain('name="code"');
    expect(form).toContain("Approve connection");
    expect(form.match(/<button\b/g)).toHaveLength(1);
    expect(form).not.toContain("Get connection code");
    expect(openRoute).toContain("verifyClaim");
    expect(openRoute).toContain("startApprovedAccountPairing");
  });

  it("uses the promptbook explanation, answers RuneLite's warning and keeps coverage in the account header", () => {
    const plugin = read("src/app/plugin/page.tsx");
    const profile = read("src/app/p/[rsn]/page.tsx");
    const deleteControl = read("src/components/delete-account-data-button.tsx");
    const expected = [
      "What Scapestack is",
      "Scapestack remembers what you are working toward and tells you the next step.",
      "What the plugin does",
      "The plugin reads your account from RuneLite and sends it to Scapestack.",
      "Without the plugin",
      "Scapestack only sees your Hiscores: levels and KC.",
      "Connecting takes one button in the game and one in your browser.",
      "What it sends",
      "What it does not send",
      "Turning it off",
      "Delete my data",
      "submits your IP address and comprehensive account data to a 3rd-party server not controlled or verified by RuneLite developers.",
      "That is accurate."
    ];
    for (const copy of expected) expect(plugin).toContain(copy);
    expect(plugin).toContain("<DeleteAccountDataButton");
    expect(deleteControl).toContain('fetch("/api/account/delete", { method: "DELETE" })');
    expect(deleteControl).toContain("window.confirm");
    // The coverage sentence moved out of both routes into
    // AccountCoverageLine on 2026-08-08 — /p and /u each composed their own
    // version and they had drifted into contradicting each other. The plain
    // language promise is unchanged, so the guard follows it to its new home
    // and checks all three states, including the one that was missing.
    const coverageLine = readFileSync(join(process.cwd(), "src/components/account-coverage-line.tsx"), "utf8");
    expect(coverageLine).toMatch(
      /Hiscores only — <Link[^>]+>connect RuneLite for quests, diaries and your bank<\/Link>/
    );
    expect(coverageLine).toContain("This is me");
    expect(coverageLine).toContain("This browser is not connected to it");
    expect(coverageLine).not.toContain("From your Hiscores only");
    expect(profile).toContain("<AccountCoverageLine");

    const playerCopy = ["src/lib", "src/components", "src/app"]
      .flatMap(sourceFiles)
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    for (const disclaimer of [
      "Grand Exchange buying is not assumed.",
      "Unlock is how much of the account this opens, out of a hundred.",
      "Missing lists only requirements Scapestack can see.",
      "Iron route: missing items need source hints, not GE assumptions."
    ]) {
      expect(playerCopy).not.toContain(disclaimer);
    }
  });
});
