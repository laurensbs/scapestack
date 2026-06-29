import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const bankResultSource = readFileSync(join(process.cwd(), "src/components/bank-result.tsx"), "utf8");

describe("snapshot single compare UX", () => {
  it("explains why one snapshot cannot compare yet", () => {
    expect(bankResultSource).toContain('data-testid="snapshot-single-compare-hint"');
    expect(bankResultSource).toContain("Compare needs two save points.");
    expect(bankResultSource).toContain("Save second snapshot");
  });

  it("manual save creates a separate compare point", () => {
    expect(bankResultSource).toContain("appendSnapshot(inferredRsn, snap, { forceNew: true })");
  });

  it("previews snapshot deltas before compare is clicked", () => {
    expect(bankResultSource).toContain("Compare preview:");
    expect(bankResultSource).toContain("snapshotDeltaPreview(previewDiff)");
    expect(bankResultSource).toContain("title={previewSummary.headline}");
  });

  it("recommends the best baseline before compare is selected", () => {
    expect(bankResultSource).toContain('data-testid="snapshot-baseline-recommendation"');
    expect(bankResultSource).toContain("Recommended baseline:");
    expect(bankResultSource).toContain("Compare recommended");
    expect(bankResultSource).toContain('aria-label="Compare the recommended bank baseline"');
    expect(bankResultSource).toContain("const recommendedBaseline = !compareSnapshot");
    expect(bankResultSource).toContain("hasSnapshotDelta(diffSnapshots(snap, currentSnapshot))");
  });

  it("turns a compare result into follow-up actions", () => {
    expect(bankResultSource).toContain('data-testid="snapshot-compare-action-rail"');
    expect(bankResultSource).toContain("Do something with this diff");
    expect(bankResultSource).toContain("Open next upgrades using this bank");
    expect(bankResultSource).toContain("Check kill using this bank");
    expect(bankResultSource).toContain("Copy bank compare summary");
    expect(bankResultSource).toContain("buildSnapshotCompareShareText(compare)");
    expect(bankResultSource).toContain("recommendSnapshotCompareActions(diff)");
    expect(bankResultSource).toContain("snapshot action brief");
    expect(bankResultSource).toContain("bank:snapshot_compare_copy");
    expect(bankResultSource).toContain("Save current bank as new compare baseline");
    expect(bankResultSource).toContain('onOpenNext={() => openBankHandoffRoute(bankToolUrl("/next", inferredRsn))}');
    expect(bankResultSource).toContain('onOpenDps={() => openBankHandoffRoute(bankToolUrl("/dps", inferredRsn, dpsHandoffOptions))}');
  });

  it("turns compare item rows into concrete actions", () => {
    expect(bankResultSource).toContain("<SnapshotDiffDetails diff={compareDiff} onSearchItems={onSearchItems} />");
    expect(bankResultSource).toContain('action="search" onSearchItems={onSearchItems}');
    expect(bankResultSource).toContain('action="wiki"');
    expect(bankResultSource).toContain("onSearchItems(`#${item.id}`, `snapshot ${title.toLowerCase()} item`)");
    expect(bankResultSource).toContain("wikiSearchUrl(item.name)");
    expect(bankResultSource).toContain("Show ${item.name} item ID ${item.id} in the current bank");
    expect(bankResultSource).toContain("Open ${item.name} on the OSRS Wiki");
    expect(bankResultSource).toContain('<span className="font-mono text-[var(--color-text-dim)]">#{item.id}</span>');
  });

  it("uses impact-oriented compare labels", () => {
    expect(bankResultSource).toContain("Compare impact");
    expect(bankResultSource).toContain("Viewing impact");
  });

  it("keeps latest autosave comparable after manual edits", () => {
    expect(bankResultSource).toContain("const isCurrentSnapshot = !hasSnapshotDelta(previewDiff)");
    expect(bankResultSource).toContain("{isCurrentSnapshot ? (");
    expect(bankResultSource).not.toContain("{isLatest ? (");
  });
});
