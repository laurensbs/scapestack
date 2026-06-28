import { ImageResponse } from "next/og";
import { BRAND_ACCENT_COLOR, BRAND_BACKGROUND_COLOR, BRAND_IMAGE_FONT_FAMILY } from "@/lib/brand";

export const size = {
  width: 180,
  height: 180
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 38,
          background: `radial-gradient(circle at 28% 18%, ${BRAND_ACCENT_COLOR}38, transparent 42%), ${BRAND_BACKGROUND_COLOR}`,
          color: BRAND_ACCENT_COLOR,
          fontFamily: BRAND_IMAGE_FONT_FAMILY
        }}
      >
        <div
          style={{
            width: 128,
            height: 128,
            borderRadius: 32,
            border: `3px solid ${BRAND_ACCENT_COLOR}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 52,
            fontWeight: 900,
            letterSpacing: -4,
            background: "rgba(214, 168, 58,0.11)"
          }}
        >
          SS
        </div>
      </div>
    ),
    size
  );
}
