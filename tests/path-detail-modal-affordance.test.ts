import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/path-detail-modal.tsx"), "utf8");

describe("path detail modal affordance", () => {
  it("exposes the drill-in as a named, described dialog", () => {
    expect(source).toContain('const titleId = "path-modal-title";');
    expect(source).toContain('const descriptionId = "path-modal-description";');
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain("aria-labelledby={titleId}");
    expect(source).toContain("aria-describedby={descriptionId}");
    expect(source).toContain("id={titleId}");
    expect(source).toContain("id={descriptionId}");
    expect(source).toContain("aria-label={`Close ${path.label} path details`}");
    expect(source).toContain('aria-hidden="true"');
  });

  it("labels path search and announces filtered result counts", () => {
    expect(source).toContain('const searchId = "path-modal-search";');
    expect(source).toContain('const searchStatusId = "path-modal-search-status";');
    expect(source).toContain("Search steps in {path.label}");
    expect(source).toContain("id={searchId}");
    expect(source).toContain('name="path-step-search"');
    expect(source).toContain('autoComplete="off"');
    expect(source).toContain("spellCheck={false}");
    expect(source).toContain("aria-describedby={searchStatusId}");
    expect(source).toContain('role="status"');
    expect(source).toContain("path step{filtered.length === 1 ? \"\" : \"s\"} shown");
  });

  it("renders filter chips as pressed controls scoped to the path", () => {
    expect(source).toContain("aria-pressed={filter === f}");
    expect(source).toContain("aria-label={`Show ${f} steps for ${path.label}`}");
  });
});
