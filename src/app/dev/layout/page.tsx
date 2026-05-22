// Dev-only layout preview. Renders each fixture bank as a compact grid so
// changes to the organizer/use-case sort are visually verifiable without
// pasting an export. Server component — fetches no prices, only reads
// data/items.json and runs organize().

import { organize } from "@/lib/organizer";
import { buildUseCaseTabs, explainBucket, type BucketExplanation } from "@/lib/use-case-tabs";
import { SMALL_MAIN_BANK, MAX_MAIN_BANK, SKILLER_BANK, IRONMAN_BANK } from "@/lib/fixtures";
import { ICON_URL, formatGp, formatQty } from "@/lib/utils";
import type { Archetype } from "@/lib/archetype";

interface FixtureSpec {
  name: string;
  description: string;
  ids: number[];
  archetypes: Archetype[];
}

const FIXTURES: FixtureSpec[] = [
  {
    name: "MAX_MAIN_BANK",
    description: "Endgame main with BIS gear, full potion suite, skilling supplies.",
    ids: MAX_MAIN_BANK,
    archetypes: ["unspecified", "main", "pvm", "ironman"]
  },
  {
    name: "SMALL_MAIN_BANK",
    description: "Low-mid level main bank (~30 items). Triggers the consolidated-tab fallback.",
    ids: SMALL_MAIN_BANK,
    archetypes: ["unspecified"]
  },
  {
    name: "IRONMAN_BANK",
    description: "Compact ironman bank with mixed gear/skilling/teleports.",
    ids: IRONMAN_BANK,
    archetypes: ["ironman"]
  },
  {
    name: "SKILLER_BANK",
    description: "Pure skiller bank — herbs, ores, seeds, no combat gear.",
    ids: SKILLER_BANK,
    archetypes: ["skiller", "unspecified"]
  }
];

async function renderFixture(spec: FixtureSpec, archetype: Archetype) {
  const result = await organize({ itemIds: spec.ids, includePrices: false });
  const tabs = buildUseCaseTabs(result.tabs, archetype);

  // Build a map of bucketing decisions for every item, keyed by item id, so
  // the UI can surface "why is this item in this tab?" on hover.
  const explanations = new Map<number, BucketExplanation>();
  for (const typeTab of result.tabs) {
    for (const it of typeTab.items) {
      explanations.set(it.id, explainBucket(it, typeTab.name));
    }
  }
  return { tabs, explanations };
}

// Group reasons into a coarser bucket-source for the summary chart. Keeps the
// summary readable when there are dozens of distinct reasons.
function reasonSource(reason: string): string {
  if (reason.startsWith("id-override")) return "id-override";
  if (reason.startsWith("pvm-db")) return "pvm-db";
  if (reason.includes("pattern")) return "regex-pattern";
  if (reason.startsWith("typeTab=")) return "classifier-typeTab";
  if (reason.includes("subtab=")) return "classifier-subtab";
  if (reason.includes("fallback")) return "slot-fallback";
  if (reason.includes("amulet") || reason.includes("ring")) return "inline-regex";
  if (reason.includes("ammo-suffix")) return "inline-regex";
  if (reason.includes("combat-untradeable") || reason.includes("non-combat untradeable")) return "untradeable-split";
  if (reason.includes("holiday") || reason.includes("3rd-age")) return "inline-regex";
  if (reason === "no rule matched") return "fallback-misc";
  return "other";
}

function DecisionSummary({ explanations }: { explanations: Map<number, BucketExplanation> }) {
  const counts = new Map<string, number>();
  for (const ex of explanations.values()) {
    const src = reasonSource(ex.reason);
    counts.set(src, (counts.get(src) || 0) + 1);
  }
  const total = explanations.size;
  const rows = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  return (
    <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
      {rows.map(([src, n]) => (
        <span
          key={src}
          className="px-1.5 py-0.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-muted)]"
        >
          {src}: <strong className="text-[var(--color-text-secondary)]">{n}</strong>
          <span className="opacity-60"> ({Math.round((n / total) * 100)}%)</span>
        </span>
      ))}
    </div>
  );
}

// Item-position diff between two archetypes for the same fixture. For each
// item that exists in both renders, compute its (tab, slot) location under
// archetype A and B. Highlight items that moved tabs or shifted >3 slots.
// This makes the per-archetype sort logic concretely visible.
interface PositionRow {
  itemId: number;
  name: string;
  posA: { tab: string; slot: number } | null;
  posB: { tab: string; slot: number } | null;
}

async function buildPositionDiff(spec: FixtureSpec, a: Archetype, b: Archetype): Promise<PositionRow[]> {
  const { tabs: tabsA } = await renderFixture(spec, a);
  const { tabs: tabsB } = await renderFixture(spec, b);
  const posA = new Map<number, { tab: string; slot: number }>();
  const posB = new Map<number, { tab: string; slot: number }>();
  for (const t of tabsA) for (let i = 0; i < t.items.length; i++) posA.set(t.items[i].id, { tab: String(t.name), slot: i });
  for (const t of tabsB) for (let i = 0; i < t.items.length; i++) posB.set(t.items[i].id, { tab: String(t.name), slot: i });
  const allIds = new Set([...posA.keys(), ...posB.keys()]);
  const nameById = new Map<number, string>();
  for (const t of tabsA) for (const it of t.items) nameById.set(it.id, it.name);
  for (const t of tabsB) for (const it of t.items) nameById.set(it.id, it.name);
  return Array.from(allIds)
    .map((id) => ({ itemId: id, name: nameById.get(id) || `#${id}`, posA: posA.get(id) ?? null, posB: posB.get(id) ?? null }))
    .filter((r) => {
      // Only show rows where the position actually differs (different tab OR
      // slot moved by ≥1 position). Everything else is noise.
      if (!r.posA || !r.posB) return true;
      if (r.posA.tab !== r.posB.tab) return true;
      return Math.abs(r.posA.slot - r.posB.slot) >= 1;
    });
}

async function ArchetypeDiff({ fixture, a, b }: { fixture: FixtureSpec; a: Archetype; b: Archetype }) {
  const rows = await buildPositionDiff(fixture, a, b);
  return (
    <section className="mb-10 border border-[var(--color-border)] rounded-lg p-5 bg-[var(--color-surface)]">
      <h2 className="text-lg font-semibold mb-2">
        Item-position diff — <code>{a}</code> vs <code>{b}</code>
      </h2>
      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        Where the same item lands differently between the two archetypes for
        {" "}<strong>{fixture.name}</strong>. Tab changes are highlighted; slot
        shifts within the same tab are listed underneath.
      </p>
      <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1 text-xs">
        <div className="font-medium text-[var(--color-text-muted)]">Item</div>
        <div className="font-medium text-[var(--color-text-muted)]">{a}</div>
        <div className="font-medium text-[var(--color-text-muted)]">{b}</div>
        {rows.slice(0, 40).map((r) => {
          const tabChanged = r.posA && r.posB && r.posA.tab !== r.posB.tab;
          return (
            <>
              <div key={`n${r.itemId}`} className="flex items-center gap-1.5 truncate" title={r.name}>
                <img src={ICON_URL(r.itemId)} alt="" className="size-3.5" />
                <span className="truncate">{r.name}</span>
              </div>
              <div
                key={`a${r.itemId}`}
                className={tabChanged ? "text-[var(--color-text-secondary)]" : "text-[var(--color-text-muted)]"}
              >
                {r.posA ? `${r.posA.tab} · #${r.posA.slot}` : <em className="opacity-50">absent</em>}
              </div>
              <div
                key={`b${r.itemId}`}
                className={tabChanged ? "text-[var(--color-text-secondary)]" : "text-[var(--color-text-muted)]"}
              >
                {r.posB ? `${r.posB.tab} · #${r.posB.slot}` : <em className="opacity-50">absent</em>}
              </div>
            </>
          );
        })}
        {rows.length > 40 && (
          <div className="col-span-3 text-[var(--color-text-muted)] italic text-[11px] mt-2">
            +{rows.length - 40} more positional diffs (showing first 40)
          </div>
        )}
        {rows.length === 0 && (
          <div className="col-span-3 text-[var(--color-text-muted)] italic">
            No positional differences — both archetypes produce identical layouts for this fixture.
          </div>
        )}
      </div>
    </section>
  );
}

// Compact archetype comparison: same fixture, all archetypes side-by-side, so
// you can spot tab-order and per-tab-sort differences at a glance.
async function renderArchetypeDiff(spec: FixtureSpec) {
  const archetypes: Archetype[] = ["unspecified", "pvm", "skiller", "ironman", "main"];
  const rows = await Promise.all(
    archetypes.map(async (a) => {
      const { tabs } = await renderFixture(spec, a);
      return { archetype: a, tabs };
    })
  );
  return rows;
}

export default async function DevLayoutPage() {
  const [allRenders, archetypeDiff] = await Promise.all([
    Promise.all(
      FIXTURES.flatMap((f) =>
        f.archetypes.map(async (a) => {
          const { tabs, explanations } = await renderFixture(f, a);
          return { spec: f, archetype: a, tabs, explanations };
        })
      )
    ),
    renderArchetypeDiff(FIXTURES[0]) // MAX_MAIN_BANK
  ]);

  return (
    <main className="mx-auto max-w-7xl px-5 py-7 pb-20">
      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Layout dev preview</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Renders each test fixture through the organizer + use-case tabs builder.
          Use this to visually verify layout changes before pasting a real bank export.
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Total fixtures × archetypes rendered: <strong>{allRenders.length}</strong>
        </p>
      </header>

      <ArchetypeDiff fixture={FIXTURES[0]} a="pvm" b="skiller" />

      <section className="mb-10 border border-[var(--color-border)] rounded-lg p-5 bg-[var(--color-surface)]">
        <h2 className="text-lg font-semibold mb-3">
          Archetype comparison — MAX_MAIN_BANK
        </h2>
        <p className="text-xs text-[var(--color-text-muted)] mb-4">
          Same bank, different archetype. Tab order + intra-tab sort vary by
          player profile. Each column shows the resulting tab list with item
          counts.
        </p>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${archetypeDiff.length}, minmax(0, 1fr))` }}>
          {archetypeDiff.map(({ archetype, tabs }) => (
            <div key={archetype} className="border border-[var(--color-border)] rounded p-3 bg-[var(--color-bg)]">
              <h3 className="text-sm font-medium mb-2 capitalize">
                <code className="text-xs">{archetype}</code>
              </h3>
              <ol className="space-y-1 text-xs">
                {tabs.map((t, idx) => (
                  <li key={String(t.name)} className="flex items-center gap-2">
                    <span className="text-[var(--color-text-muted)] w-4">{idx + 1}.</span>
                    <img src={ICON_URL(t.iconItemId)} alt="" className="size-4" />
                    <span className="flex-1 truncate">{String(t.name)}</span>
                    <span className="text-[var(--color-text-muted)]">{t.items.length}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <div className="space-y-12">
        {allRenders.map(({ spec, archetype, tabs, explanations }, i) => (
          <section key={i} className="border border-[var(--color-border)] rounded-lg p-5 bg-[var(--color-surface)]">
            <header className="mb-4">
              <h2 className="text-lg font-semibold">
                {spec.name}{" "}
                <span className="text-xs font-normal text-[var(--color-text-muted)]">
                  · archetype: <code>{archetype}</code>
                </span>
              </h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">{spec.description}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {tabs.length} tab{tabs.length === 1 ? "" : "s"} · {tabs.reduce((s, t) => s + t.items.length, 0)} items
              </p>
              <DecisionSummary explanations={explanations} />
            </header>

            <div className="space-y-5">
              {tabs.map((tab) => (
                <div key={String(tab.name)}>
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <img src={ICON_URL(tab.iconItemId)} alt="" className="size-5" />
                    <span>{String(tab.name)}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {tab.items.length} items
                    </span>
                  </h3>
                  <div
                    className="grid gap-0.5 bg-[var(--color-bg)] p-1 rounded border border-[var(--color-border)]"
                    style={{ gridTemplateColumns: "repeat(8, minmax(0, 1fr))" }}
                  >
                    {Array.from({ length: Math.max(8, Math.ceil(tab.items.length / 8) * 8) }).map((_, slot) => {
                      const item = tab.items[slot];
                      if (!item) {
                        return (
                          <div
                            key={slot}
                            className="aspect-square border border-[var(--color-border)] opacity-30"
                          />
                        );
                      }
                      const expl = explanations.get(item.id);
                      const title = expl
                        ? `${item.name}\n→ ${expl.bucket} (${expl.reason})`
                        : item.name;
                      return (
                        <div
                          key={slot}
                          className="aspect-square border border-[var(--color-border)] bg-[var(--color-surface)] relative flex items-center justify-center"
                          title={title}
                        >
                          <img
                            src={ICON_URL(item.id)}
                            alt={item.name}
                            className="max-w-[80%] max-h-[80%]"
                          />
                          {item.quantity > 1 && (
                            <span
                              className="absolute top-0 left-0 text-[9px] px-0.5 leading-tight"
                              style={{ color: "var(--color-osrs-qty-yellow)" }}
                            >
                              {formatQty(item.quantity)}
                            </span>
                          )}
                          {item.stackValue > 0 && (
                            <span className="absolute bottom-0 right-0 text-[9px] px-0.5 leading-tight text-[var(--color-text-muted)]">
                              {formatGp(item.stackValue)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
