// Dev-only smoke endpoint. POST a Bank Memory TSV in the request body,
// receive { stats, tabSummaries, sample } for inspection.

import { organize, exportTabs } from "@/lib/organizer";

export async function POST(req: Request) {
  const input = await req.text();
  try {
    const result = await organize({ input, includePrices: true });
    const strings = exportTabs(result.tabs);
    const placeholderNames = result.tabs
      .flatMap((t) => t.items)
      .filter((i) => /^Item \d+$/.test(i.name))
      .map((i) => i.id);
    return Response.json({
      ok: true,
      stats: result.stats,
      source: result.source,
      tabs: result.tabs.map((t) => ({
        name: t.name,
        iconItemId: t.iconItemId,
        itemCount: t.items.length,
        value: t.value,
        quantity: t.quantity,
        firstFiveItems: t.items.slice(0, 5).map((it) => ({
          id: it.id, name: it.name, subtab: it.subtab, qty: it.quantity, price: it.unitPrice
        }))
      })),
      strings,
      placeholderNames
    });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
