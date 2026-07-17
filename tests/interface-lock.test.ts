import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
const css = read("src/app/globals.css");
const lock = read("docs/SCAPESTACK-INTERFACE-LOCK.md");

describe("Scapestack interface lock", () => {
  it("documents the reference synthesis and rejects dashboard composition", () => {
    expect(lock).toContain("## Reference lock");
    expect(lock).toContain("Wayfinder");
    expect(lock).toContain("Pipe");
    expect(lock).toContain("Franco Maria Ricci Editore");
    expect(lock).toContain("Krea");
    expect(lock).toContain("Nested cards");
    expect(lock).toContain("KPI rows");
    expect(lock).toContain("Green success banners");
  });

  it("defines the locked app primitives", () => {
    for (const primitive of [
      ".scape-page",
      ".scape-page-intro",
      ".scape-focus",
      ".scape-dialog",
      ".scape-sheet",
      ".scape-boss-tile",
      ".scape-route-choice",
      ".scape-inventory",
      ".scape-checklist",
      ".scape-primary-action"
    ]) {
      expect(css, primitive).toContain(primitive);
    }
  });

  it("keeps action controls rectangular and the app canvas free of decorative orbs", () => {
    const primaryButton = css.slice(css.indexOf(".btn-primary {"), css.indexOf(".btn-primary:hover"));
    const commandButton = css.slice(css.indexOf(".scapestack-command-button {"), css.indexOf(".scapestack-command-button:hover"));
    expect(primaryButton).toContain("border-radius: var(--radius-control)");
    expect(commandButton).toContain("border-radius: var(--radius-control)");
    expect(css).toContain("Flat app canvas. Boss, reward and item art supply the atmosphere.");
    expect(css).not.toContain("radial-gradient(circle at 50% 14%");
  });

  it("puts every core route on the same page shell", () => {
    for (const file of [
      "src/app/page.tsx",
      "src/app/next/page.tsx",
      "src/app/bank/page.tsx",
      "src/app/dps/page.tsx",
      "src/app/goals/page.tsx",
      "src/app/plugin/page.tsx",
      "src/app/u/[rsn]/page.tsx"
    ]) {
      expect(read(file), file).toContain('className="scape-page');
    }
  });

  it("uses focused sheets and object-led choices instead of bespoke modal cards", () => {
    expect(read("src/components/path-detail-modal.tsx")).toContain('className="scape-sheet');
    expect(read("src/components/path-detail-modal.tsx")).toContain('className="scape-checklist');
    expect(read("src/components/boss-detail-modal.tsx")).toContain('className="scape-sheet');
    expect(read("src/components/add-bank-modal.tsx")).toContain('className="scape-dialog');
    expect(read("src/components/connect-browser-modal.tsx")).toContain('className="scape-dialog');
    expect(read("src/app/dps/dps-client.tsx")).toContain("scape-boss-tile scapestack-boss-tile");
    expect(read("src/app/next/next-client.tsx")).toContain('className="scape-focus');
  });
});
