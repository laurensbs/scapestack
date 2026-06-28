"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ICON_URL, cn } from "@/lib/utils";

interface ItemSpriteProps {
  id: number;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  size?: number;
  fallbackId?: number;
  loading?: "eager" | "lazy";
}

const DEFAULT_FILTER = "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))";

export function ItemSprite({
  id,
  alt = "",
  className,
  style,
  size,
  fallbackId = 0,
  loading = "lazy"
}: ItemSpriteProps) {
  const [stage, setStage] = useState<"primary" | "fallback" | "dot">("primary");
  const cleanId = Number.isFinite(id) ? Math.abs(Math.trunc(id)) : 0;
  const cleanFallbackId = Number.isFinite(fallbackId) ? Math.abs(Math.trunc(fallbackId)) : 0;
  const spriteId = stage === "primary" ? cleanId : cleanFallbackId;
  const fallbackLabel = alt
    ? `${alt} sprite unavailable${cleanId ? ` · item ID ${cleanId}` : ""}`
    : undefined;

  useEffect(() => {
    setStage("primary");
  }, [cleanId, cleanFallbackId]);

  if (!spriteId || stage === "dot") {
    return (
      <span
        role={fallbackLabel ? "img" : undefined}
        aria-label={fallbackLabel}
        aria-hidden={alt ? undefined : true}
        title={fallbackLabel}
        data-sprite-fallback="missing"
        data-sprite-missing-id={cleanId || undefined}
        className={cn(
          "inline-flex flex-col items-center justify-center gap-0.5 rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)]/80 text-[9px] font-black leading-none text-[var(--color-accent)] shadow-[0_0_10px_rgba(15, 118, 110,0.2)]",
          className
        )}
        style={{
          width: size ?? 18,
          height: size ?? 18,
          ...style
        }}
      >
        <span aria-hidden="true">?</span>
        <span aria-hidden="true" className="max-w-full truncate px-0.5 text-[5.5px] leading-none text-[var(--color-text-muted)]">
          {cleanId ? `#${cleanId}` : "ID ?"}
        </span>
      </span>
    );
  }

  return (
    <img
      src={ICON_URL(spriteId)}
      alt={alt}
      loading={loading}
      decoding="async"
      className={cn("pixelated shrink-0", className)}
      style={{
        width: size,
        height: size,
        imageRendering: "pixelated",
        filter: DEFAULT_FILTER,
        objectFit: "contain",
        ...style
      }}
      onError={() => {
        if (stage === "primary" && cleanFallbackId && cleanFallbackId !== cleanId) {
          setStage("fallback");
        } else {
          setStage("dot");
        }
      }}
    />
  );
}
