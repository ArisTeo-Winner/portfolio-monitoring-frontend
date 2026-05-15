"use client";

import Image from "next/image";
import { useState } from "react";
import { getAssetPalette } from "@/lib/utils/asset";

type AssetAvatarProps = {
  symbol: string;
  logoUrl: string | null;
  size?: "sm" | "md" | "lg";
  dark?: boolean;
};

const SIZE_MAP = {
  sm: { px: 28, cls: "h-7 w-7 text-[0.625rem]" },
  md: { px: 32, cls: "h-8 w-8 text-[0.72rem]" },
  lg: { px: 48, cls: "h-12 w-12 text-[0.86rem]" },
} as const;

export function AssetAvatar({ symbol, logoUrl, size = "md", dark = false }: AssetAvatarProps) {
  const [failed, setFailed] = useState(false);
  const palette = getAssetPalette(symbol);
  const initials = symbol.slice(0, 2).toUpperCase();
  const { px, cls } = SIZE_MAP[size];
  const shadowCls = dark
    ? "shadow-[0_10px_20px_rgba(0,0,0,0.34)]"
    : "shadow-[0_8px_18px_rgba(0,0,0,0.28)]";

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
      {initials}
    </span>
  );
}
