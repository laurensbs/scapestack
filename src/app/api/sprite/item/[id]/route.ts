const REMOTE_SPRITE = (id: number) =>
  `https://chisel.weirdgloop.org/static/img/osrs-sprite/${id}.png`;

const SPRITE_FETCH_TIMEOUT_MS = 2_500;
type SpriteSource = "primary";

function parseItemId(raw: string): number | null {
  const match = raw.match(/^-?\d+/);
  if (!match) return null;
  const id = Math.abs(Number(match[0]));
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

function fallbackSvg(itemId?: number): Response {
  const label = itemId ? `Item ${itemId}` : "Unknown item";
  const idLabel = itemId ? `#${itemId}` : "ID ?";
  return new Response(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="6" fill="#F5F0E6"/>
      <rect x="4" y="4" width="24" height="24" rx="4" fill="#FFFCF6" stroke="#BDAE93"/>
      <text x="16" y="15" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="12" font-weight="900" fill="#0F766E">?</text>
      <text x="16" y="25" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="6.5" font-weight="800" fill="#65736D">${idLabel}</text>
      <title>${label} sprite unavailable</title>
    </svg>`,
    {
      headers: {
        "content-type": "image/svg+xml",
        "cache-control": "public, max-age=86400",
        "x-scapestack-sprite-source": "generated-fallback",
        "x-scapestack-sprite-label": `${label} sprite unavailable`,
        ...(itemId ? { "x-scapestack-missing-sprite-id": String(itemId) } : {})
      }
    }
  );
}

async function fetchSprite(id: number, source: SpriteSource): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SPRITE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(REMOTE_SPRITE(id), {
      headers: { "user-agent": "scapestack/0.6 (+https://www.scapestack.org)" },
      next: { revalidate: 60 * 60 * 24 * 7 },
      signal: controller.signal
    });
    if (!response.ok) return null;
    return new Response(response.body, {
      headers: {
        "content-type": response.headers.get("content-type") ?? "image/png",
        "cache-control": "public, max-age=604800, stale-while-revalidate=2592000",
        "x-scapestack-sprite-source": source,
        "x-scapestack-sprite-id": String(id)
      }
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await context.params;
  const itemId = parseItemId(rawId);
  if (!itemId) return fallbackSvg();

  const primary = await fetchSprite(itemId, "primary");
  if (primary) return primary;
  return fallbackSvg(itemId);
}
