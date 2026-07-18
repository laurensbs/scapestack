import { ImageResponse } from "next/og";
import {
  BRAND_ACCENT_COLOR,
  BRAND_BACKGROUND_COLOR,
  BRAND_IMAGE_FONT_FAMILY,
  BRAND_NAME,
  brandUrl
} from "@/lib/brand";

export const runtime = "edge";
export const alt = "Scapestack OSRS trip decision";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type SearchValue = string | string[] | undefined;

function first(value: SearchValue): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function clean(value: SearchValue, fallback: string, max: number): string {
  const text = first(value).replace(/\s+/g, " ").trim();
  if (!text || /\b(rsn|payload|bank rows?|raw stats?|token|claim|login|password|quantity|quantities)\b/i.test(text)) return fallback;
  return text.slice(0, max);
}

export default function TripShareOpenGraphImage({
  searchParams
}: {
  searchParams?: Record<string, SearchValue>;
}) {
  const result = clean(searchParams?.result, "One OSRS trip worth doing now", 96);
  const why = clean(searchParams?.why, "Scapestack found a cleaner next trip.", 130);
  const stop = clean(searchParams?.stop, "Stop at the chosen stop point.", 110);
  const item = Number(first(searchParams?.item));
  const itemId = Number.isFinite(item) && item > 0 ? Math.trunc(item) : 9951;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "54px 62px",
          background: `radial-gradient(circle at 18% 18%, ${BRAND_ACCENT_COLOR}33, transparent 34%), ${BRAND_BACKGROUND_COLOR}`,
          color: "#F5EBD8",
          fontFamily: BRAND_IMAGE_FONT_FAMILY
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 68,
                height: 68,
                borderRadius: 18,
                border: `3px solid ${BRAND_ACCENT_COLOR}`,
                color: BRAND_ACCENT_COLOR,
                fontSize: 28,
                fontWeight: 950,
                background: "rgba(224,174,55,0.10)"
              }}
            >
              SS
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 32, fontWeight: 950 }}>{BRAND_NAME}</div>
              <div style={{ display: "flex", marginTop: 4, color: BRAND_ACCENT_COLOR, fontSize: 18, fontWeight: 850 }}>
                Stop bankstanding
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              border: `2px solid ${BRAND_ACCENT_COLOR}77`,
              borderRadius: 999,
              padding: "12px 18px",
              color: BRAND_ACCENT_COLOR,
              fontSize: 18,
              fontWeight: 900
            }}
          >
            Trip decision
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 38, marginTop: 54 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 172,
              height: 172,
              borderRadius: 24,
              border: `2px solid ${BRAND_ACCENT_COLOR}66`,
              background: "rgba(0,0,0,0.35)"
            }}
          >
            <img src={brandUrl(`/api/sprite/item/${itemId}`)} width={112} height={112} alt="" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", color: BRAND_ACCENT_COLOR, fontSize: 22, fontWeight: 950, letterSpacing: 4 }}>
              WHAT TO DO NOW
            </div>
            <div style={{ display: "flex", marginTop: 12, fontSize: 56, lineHeight: 1.05, fontWeight: 950 }}>
              {result}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 18, marginTop: "auto" }}>
          <Fact label="WHY" value={why} />
          <Fact label="STOP AT" value={stop} />
        </div>
      </div>
    ),
    size
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        border: "1px solid rgba(224,174,55,0.36)",
        borderRadius: 18,
        padding: "18px 20px",
        background: "rgba(255,255,255,0.045)"
      }}
    >
      <div style={{ display: "flex", color: BRAND_ACCENT_COLOR, fontSize: 14, fontWeight: 950, letterSpacing: 3 }}>{label}</div>
      <div style={{ display: "flex", marginTop: 8, color: "#D8CCB3", fontSize: 23, fontWeight: 750, lineHeight: 1.22 }}>{value}</div>
    </div>
  );
}
