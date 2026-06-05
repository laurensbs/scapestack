// Dev-only smoke endpoint. POST a Bank Memory TSV in the request body,
// receive { stats, tabSummaries, sample } for inspection.

import { organize, exportTabs } from "@/lib/organizer";

function isSmokeEndpointEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.SCAPESTACK_ENABLE_TEST_ORGANIZE === "1";
}

function disabledResponse(): Response {
  return Response.json(
    { ok: false, error: "Not found" },
    {
      status: 404,
      headers: {
        "cache-control": "no-store"
      }
    }
  );
}

export async function POST(req: Request) {
  if (!isSmokeEndpointEnabled()) return disabledResponse();

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
      importWarnings: result.importWarnings,
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
    }, {
      headers: {
        "cache-control": "no-store"
      }
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      {
        status: 500,
        headers: {
          "cache-control": "no-store"
        }
      }
    );
  }
}
