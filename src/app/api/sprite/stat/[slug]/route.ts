const WIKI_IMAGE_ROOT = "https://oldschool.runescape.wiki/images";
const FORCED_MISSING_ICON = `${WIKI_IMAGE_ROOT}/Scapestack_forced_missing_identity_icon.png`;
const FETCH_TIMEOUT_MS = 2_500;
const CACHE_CONTROL = "public, max-age=604800, stale-while-revalidate=2592000";

const STAT_ICON_FILES = {
  "total-level": "Stats_icon.png",
  combat: "Combat_icon.png",
  quests: "Quest_point_icon.png",
  diaries: "Achievement_Diaries_icon.png",
  "collection-log": "Collection_log.png"
} as const;

type StatIconSlug = keyof typeof STAT_ICON_FILES;

function statIconSlug(raw: string): StatIconSlug | null {
  const slug = raw.endsWith(".png") ? raw.slice(0, -4) : raw;
  return Object.hasOwn(STAT_ICON_FILES, slug) ? slug as StatIconSlug : null;
}

function fallbackSvg(label = "Unknown stat"): Response {
  return new Response(
    `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><title>${label} icon unavailable</title></svg>`,
    {
      headers: {
        "content-type": "image/svg+xml",
        "cache-control": "public, max-age=86400",
        "x-scapestack-stat-icon-source": "generated-fallback",
        "x-scapestack-stat-icon-label": `${label} icon unavailable`
      }
    }
  );
}

async function fetchStatIcon(slug: StatIconSlug, force404: boolean): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const filename = STAT_ICON_FILES[slug];

  try {
    const response = await fetch(
      force404 ? FORCED_MISSING_ICON : `${WIKI_IMAGE_ROOT}/${filename}`,
      {
        headers: { "user-agent": "scapestack/0.6 (+https://www.scapestack.org)" },
        next: { revalidate: 60 * 60 * 24 * 7 },
        signal: controller.signal
      }
    );
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.startsWith("image/")) return null;

    return new Response(response.body, {
      headers: {
        "content-type": contentType,
        "cache-control": CACHE_CONTROL,
        "x-scapestack-stat-icon-source": "osrs-wiki",
        "x-scapestack-stat-icon": slug
      }
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await context.params;
  const slug = statIconSlug(rawSlug);
  if (!slug) return fallbackSvg();

  const force404 = new URL(request.url).searchParams.get("force404") === "1";
  const response = await fetchStatIcon(slug, force404);
  return response ?? fallbackSvg(slug);
}
