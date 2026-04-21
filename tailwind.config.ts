import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        mist: "#f5f7fb",
        brand: "#0f766e",
        accent: "#d97706",
        binance: {
          bg: "#0A0A0A",
          card: "#111111",
          hover: "#1A1A1A",
          border: "#2B3139",
          yellow: "#FCD34D",
          "yellow-hover": "#FDE68A",
          green: "#22C55E",
          red: "#EF4444",
          text: "#EAECEF",
          muted: "#848E9C",
        },
        hyperliquid: {
          bg: "#0B0E14",
          header: "#0F766E",
          row: "#0E1218",
          "row-hover": "#1E2A38",
          border: "#1F2937",
          cyan: "#2DD4BF",
        }
      },
    },
  },
  plugins: [],
};

export default config;
