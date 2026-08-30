"use client";

import Image from "next/image";
import { useState } from "react";
import { getAssetPalette } from "@/lib/utils/asset";

type AssetAvatarProps = {
  symbol: string;
  logoUrl: string | null;
  size?: "sm" | "md" | "lg";
  dark?: boolean;
  assetType?: string;
};

const SIZE_MAP = {
  sm: { px: 28, cls: "h-7 w-7 text-[0.625rem]" },
  md: { px: 32, cls: "h-8 w-8 text-[0.72rem]" },
  lg: { px: 48, cls: "h-12 w-12 text-[0.86rem]" },
} as const;

// Emoji fallbacks for asset types that don't have a photographic logo to
// display (government/corporate bonds have no issuer logo, indices are
// baskets rather than a single entity). Everything else — including
// CRYPTO without a resolved logo — falls back to the initials+color avatar.
const TYPE_FALLBACK_ICON: Record<string, string> = {
  GOVERNMENT_BOND: "🏛",
  CORPORATE_BOND: "🏛",
  INDEX: "📈",
};

export function AssetAvatar({ symbol, logoUrl, size = "md", dark = false, assetType }: AssetAvatarProps) {
  const [failed, setFailed] = useState(false);
  const palette = getAssetPalette(symbol);
  const initials = symbol.slice(0, 2).toUpperCase();
  const { px, cls } = SIZE_MAP[size];
  const shadowCls = dark
    ? "shadow-[0_10px_20px_rgba(0,0,0,0.34)]"
    : "shadow-[0_8px_18px_rgba(0,0,0,0.28)]";
  const fallbackIcon = assetType ? TYPE_FALLBACK_ICON[assetType.trim().toUpperCase()] : undefined;

  if (logoUrl && !failed) {
    return (
      <Image
        alt={symbol}
        className={`${cls} shrink-0 rounded-full bg-[#0f131b] object-cover`}
        height={px}
        onError={() => setFailed(true)}
        src={logoUrl}
        unoptimized
        width={px}
      />
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${cls} ${shadowCls}`}
      style={{ background: `radial-gradient(circle at 30% 30%, ${palette.highlight}, ${palette.base})`, color: palette.text }}
    >
      {fallbackIcon ?? initials}
    </span>
  );
}
