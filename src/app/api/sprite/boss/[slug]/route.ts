import {
  homepageBossRenderBySlug,
  type HomepageBossRender
} from "@/lib/homepage-boss-renders";

const FETCH_TIMEOUT_MS = 3_500;
const CACHE_CONTROL = "public, max-age=2592000, stale-while-revalidate=31536000";
const FORCED_MISSING_RENDER = "https://oldschool.runescape.wiki/images/Scapestack_forced_missing_boss_render.png";
// A valid transparent PNG keeps next/image's optimizer on the same path when
// the wiki is unavailable. The reserved image box and quiet boss name remain,
// so the page degrades to its former text-only look without a broken glyph.
const FALLBACK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

function fallbackPng(label: string): Response {
  return new Response(FALLBACK_PNG, {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=86400",
      "x-scapestack-boss-source": "generated-fallback",
      "x-scapestack-boss-label": `${label} render unavailable`
    }
  });
}

async function fetchRender(boss: HomepageBossRender, force404: boolean): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(force404 ? FORCED_MISSING_RENDER : boss.originalUrl, {
      headers: {
        "user-agent": "scapestack-boss-render-proxy/1.0 (+https://www.scapestack.org)"
      },
      next: { revalidate: 60 * 60 * 24 * 30 },
      signal: controller.signal
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.startsWith("image/")) return null;

    return new Response(response.body, {
      headers: {
        "content-type": contentType,
        "cache-control": CACHE_CONTROL,
        "x-scapestack-boss-source": "osrs-wiki-original",
        "x-scapestack-boss-slug": boss.slug
      }
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const boss = homepageBossRenderBySlug(slug);
  if (!boss) return fallbackPng("Unknown boss");

  const force404 = new URL(request.url).searchParams.get("force404") === "1";
  const render = await fetchRender(boss, force404);
  return render ?? fallbackPng(boss.name);
}
