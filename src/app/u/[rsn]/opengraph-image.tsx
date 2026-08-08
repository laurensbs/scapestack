import { ImageResponse } from "next/og";
import {
  fetchHiscores, computeCombatLevel, computeTotalLevel,
  totalXp, topSkills, formatXp, normalizeRsn,
  type PlayerHiscores
} from "@/lib/hiscores";
import { BRAND_IMAGE_FONT_FAMILY, BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";

export const runtime = "edge";
export const alt = "OSRS player profile · Scapestack";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface Props {
  params: Promise<{ rsn: string }>;
}

// Satori (next/og) requires `display: flex` on EVERY div, no exceptions.
// Below, every container is explicit.

export default async function OpenGraphImage({ params }: Props) {
  const { rsn } = await params;
  const decoded = normalizeRsn(decodeURIComponent(rsn));
  // Strict and bounded, because this image is cached by whoever embeds it:
  // a Discord or Slack crawler that fetches during a hiscores outage would
  // otherwise keep showing "{rsn} not found" long after the outage ends.
  // Only Jagex's own 404 may say that. 900ms matches
  // PLANNING_SOURCE_DEADLINES_MS.hiscores — not imported, because
  // planning-context pulls server-only modules into this edge bundle.
  let hi: PlayerHiscores | null = null;
  let unanswered = false;
  try {
    hi = await fetchHiscores(decoded, { strict: true, signal: AbortSignal.timeout(900) });
  } catch {
    unanswered = true;
  }

  if (unanswered) {
    // Two lines, and neither is a claim about the account. This card gets
    // cached by whoever's Discord fetched it, so it has to still be true in a
    // week: the name is what the URL says, and the lookup did not answer.
    // Nothing about levels, nothing about existing. A bare name on a gradient
    // would meet that bar too, but reads as a broken image rather than a
    // deliberate one — the second line is what makes it look on purpose.
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #5B4632, #28201A)",
            fontFamily: BRAND_IMAGE_FONT_FAMILY
          }}
        >
          <div style={{ display: "flex", fontSize: 72, fontWeight: 900, color: "#FF981F", lineHeight: 1 }}>
            <span>{decoded}</span>
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#b8a382", marginTop: 20 }}>
            <span>Hiscores didn&apos;t answer</span>
          </div>
        </div>
      ),
      size
    );
  }

  if (!hi) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #5B4632, #28201A)",
            color: "#FF981F",
            fontSize: 48,
            fontWeight: 900
          }}
        >
          <span>{decoded} not found</span>
        </div>
      ),
      size
    );
  }

  const cb = computeCombatLevel(hi.skills);
  const total = computeTotalLevel(hi.skills);
  const xp = totalXp(hi.skills);
  const top = topSkills(hi.skills, 3);
  const slug = hi.name.toLowerCase().replace(/\s/g, "_");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "60px 70px",
          background: "linear-gradient(135deg, #5B4632 0%, #28201A 60%, #1a1208 100%)",
          color: "#F4E4C1",
          fontFamily: BRAND_IMAGE_FONT_FAMILY
        }}
      >
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 36 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 48,
              height: 48,
              borderRadius: 24,
              background: "linear-gradient(135deg, #ffe28a, #c98a18 60%, #6e4a08)",
              color: "#1a1208",
              fontSize: 26,
              fontWeight: 900,
              border: "2px solid #6e4a08",
              marginRight: 14
            }}
          >
            <span>S</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 26, fontWeight: 900, color: "#FFDB6C", lineHeight: 1 }}>
                <span>{BRAND_NAME}</span>
              </div>
              <div style={{ display: "flex", fontSize: 14, color: "#b8a382", marginTop: 4, letterSpacing: 4 }}>
                <span>{BRAND_TAGLINE.toUpperCase()}</span>
              </div>
            </div>
          </div>

        {/* Player name */}
        <div
          style={{
            display: "flex",
            fontSize: 110,
            fontWeight: 900,
            color: "#FF981F",
            lineHeight: 1,
            marginBottom: 24,
            letterSpacing: -2
          }}
        >
          <span>{hi.name}</span>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", marginBottom: 50 }}>
          <Stat label="COMBAT" value={String(cb)} />
          <Stat label="TOTAL" value={total.toLocaleString()} />
          <Stat label="XP" value={formatXp(xp)} />
        </div>

        {/* Top 3 skills */}
        <div style={{ display: "flex", marginTop: "auto" }}>
          {top.map((s, i) => (
            <div
              key={s.id}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                background: "rgba(0,0,0,0.4)",
                border: "1px solid #6e4a08",
                borderRadius: 12,
                padding: "16px 22px",
                marginRight: i < top.length - 1 ? 24 : 0
              }}
            >
              <div style={{ display: "flex", fontSize: 14, color: "#b8a382", letterSpacing: 3 }}>
                <span>{s.name.toUpperCase()}</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", marginTop: 6 }}>
                <div style={{ display: "flex", fontSize: 48, fontWeight: 900, color: "#FFDB6C", lineHeight: 1, marginRight: 8 }}>
                  <span>{s.level}</span>
                </div>
                <div style={{ display: "flex", fontSize: 18, color: "#b8a382" }}>
                  <span>{formatXp(s.xp)} xp</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            right: 70,
            bottom: 35,
            fontSize: 16,
            color: "#b8a382"
          }}
        >
          <span>{`scapestack · /u/${slug}`}</span>
        </div>
      </div>
    ),
    size
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", marginRight: 50 }}>
      <div style={{ display: "flex", fontSize: 14, color: "#b8a382", letterSpacing: 3 }}>
        <span>{label}</span>
      </div>
      <div style={{ display: "flex", fontSize: 56, fontWeight: 900, color: "#F4E4C1", lineHeight: 1, marginTop: 4 }}>
        <span>{value}</span>
      </div>
    </div>
  );
}
