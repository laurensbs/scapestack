import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import {
  BRAND_ACCENT_COLOR,
  BRAND_BACKGROUND_COLOR,
  BRAND_IMAGE_FONT_FAMILY,
  BRAND_NAME
} from "@/lib/brand";
import { formatGpExact } from "@/lib/bank-affordability";
import { loadPublicBankShare } from "./data";

export const alt = "What this OSRS bank can finish";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function BankShareOpenGraphImage({
  params
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const share = await loadPublicBankShare(shareId);
  if (!share) notFound();
  const { snapshot } = share;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "44px 54px",
          background: `radial-gradient(circle at 14% 10%, ${BRAND_ACCENT_COLOR}2f, transparent 32%), ${BRAND_BACKGROUND_COLOR}`,
          color: "#F5EBD8",
          fontFamily: BRAND_IMAGE_FONT_FAMILY
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", color: BRAND_ACCENT_COLOR, fontSize: 18, fontWeight: 900, letterSpacing: 3 }}>
              WHAT MY BANK CAN FINISH
            </div>
            <div style={{ display: "flex", marginTop: 8, fontSize: 40, fontWeight: 900 }}>
              {snapshot.displayName} · {formatGpExact(snapshot.gp)} banked
            </div>
          </div>
          <div style={{ display: "flex", color: "#D8CCB3", fontSize: 22, fontWeight: 800 }}>{BRAND_NAME}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 30, border: "1px solid rgba(224,174,55,0.34)" }}>
          <ShareRow header cells={["SET", "MISSING", "COST", "VERDICT"]} />
          {snapshot.rows.slice(0, 6).map((row) => (
            <ShareRow
              key={`${row.setName}:${row.owned}`}
              cells={[
                `${row.setName} ${row.owned}/${row.total}`,
                row.missing.join(", "),
                formatGpExact(row.cost),
                row.verdict
              ]}
              ready={row.gate === "ready"}
            />
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "auto", color: "#AFA38B", fontSize: 15 }}>
          <div style={{ display: "flex" }}>Exact insta-buy prices frozen for this image</div>
          <div style={{ display: "flex" }}>No raw bank is published</div>
        </div>
      </div>
    ),
    size
  );
}

function ShareRow({
  cells,
  header = false,
  ready = false
}: {
  cells: [string, string, string, string];
  header?: boolean;
  ready?: boolean;
}) {
  const widths = [260, 430, 190, 190];
  return (
    <div
      style={{
        display: "flex",
        minHeight: header ? 42 : 63,
        alignItems: "center",
        borderBottom: "1px solid rgba(224,174,55,0.22)",
        background: header ? "rgba(224,174,55,0.10)" : "rgba(255,255,255,0.025)",
        color: header ? BRAND_ACCENT_COLOR : "#F5EBD8",
        fontSize: header ? 14 : 18,
        fontWeight: header ? 900 : 700,
        letterSpacing: header ? 2 : 0
      }}
    >
      {cells.map((cell, index) => (
        <div
          key={index}
          style={{
            display: "flex",
            width: widths[index],
            padding: "0 14px",
            color: index === 3 && !header ? (ready ? "#9BCB89" : "#E4BE63") : undefined,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          }}
        >
          {cell}
        </div>
      ))}
    </div>
  );
}
