import { ImageResponse } from "next/og";
import { BRAND_ACCENT_COLOR, BRAND_BACKGROUND_COLOR, BRAND_IMAGE_FONT_FAMILY, BRAND_NAME } from "@/lib/brand";

export const size = {
  width: 512,
  height: 512
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `radial-gradient(circle at 30% 20%, ${BRAND_ACCENT_COLOR}33, transparent 38%), ${BRAND_BACKGROUND_COLOR}`,
          color: BRAND_ACCENT_COLOR,
          fontFamily: BRAND_IMAGE_FONT_FAMILY
        }}
      >
        <div
          style={{
            width: 376,
            height: 376,
            borderRadius: 92,
            border: `6px solid ${BRAND_ACCENT_COLOR}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 80px ${BRAND_ACCENT_COLOR}22, inset 0 0 38px ${BRAND_ACCENT_COLOR}1f`,
            background: "linear-gradient(145deg, rgba(15, 118, 110,0.12), rgba(255,255,255,0.02))"
          }}
        >
          <div style={{ fontSize: 128, fontWeight: 900, letterSpacing: -8, lineHeight: 1 }}>
            SS
          </div>
          <div style={{ marginTop: 18, fontSize: 30, fontWeight: 800, letterSpacing: 6, textTransform: "uppercase" }}>
            {BRAND_NAME}
          </div>
        </div>
      </div>
    ),
    size
  );
}
