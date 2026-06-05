import { ImageResponse } from "next/og";
import {
  BRAND_ACCENT_COLOR,
  BRAND_BACKGROUND_COLOR,
  BRAND_DESCRIPTION,
  BRAND_IMAGE_FONT_FAMILY,
  BRAND_NAME,
  BRAND_TAGLINE
} from "@/lib/brand";

export const alt = "Scapestack · Smart OSRS copilot";
export const size = {
  width: 1200,
  height: 630
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: `radial-gradient(circle at 22% 20%, ${BRAND_ACCENT_COLOR}30, transparent 36%), radial-gradient(circle at 82% 72%, #6d4b1a66, transparent 34%), ${BRAND_BACKGROUND_COLOR}`,
          color: "#F5E9D2",
          fontFamily: BRAND_IMAGE_FONT_FAMILY
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 76,
                height: 76,
                borderRadius: 22,
                border: `3px solid ${BRAND_ACCENT_COLOR}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: BRAND_ACCENT_COLOR,
                fontSize: 30,
                fontWeight: 900,
                letterSpacing: -2,
                background: "rgba(230,165,47,0.11)"
              }}
            >
              SS
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1 }}>{BRAND_NAME}</div>
              <div style={{ color: BRAND_ACCENT_COLOR, fontSize: 20, fontWeight: 700 }}>{BRAND_TAGLINE}</div>
            </div>
          </div>
          <div
            style={{
              border: "1px solid rgba(230,165,47,0.38)",
              borderRadius: 999,
              padding: "12px 18px",
              color: BRAND_ACCENT_COLOR,
              fontSize: 18,
              fontWeight: 800
            }}
          >
            RuneLite-ready
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div style={{ maxWidth: 850, fontSize: 68, lineHeight: 1.02, fontWeight: 950, letterSpacing: -3 }}>
            Bank, DPS, goals and Slayer in one account plan.
          </div>
          <div style={{ maxWidth: 840, color: "#C9BFAE", fontSize: 26, lineHeight: 1.35 }}>
            {BRAND_DESCRIPTION}
          </div>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          {["Bank Organizer", "Next Up", "DPS", "Slayer", "RuneLite Sync"].map((label) => (
            <div
              key={label}
              style={{
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 14,
                padding: "12px 16px",
                background: "rgba(255,255,255,0.045)",
                color: "#EDE1CA",
                fontSize: 18,
                fontWeight: 750
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
