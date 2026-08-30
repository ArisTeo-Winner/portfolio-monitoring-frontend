import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        mist: "#F9FAFB",
        brand: "#2563EB",
        accent: "#16C784",
        fintech: {
          bg: "#0B0F17",
          surface: "#111827",
          elevated: "#1A2233",
          border: "#1F2937",
          primary: "#F9FAFB",
          secondary: "#9CA3AF",
          accent: "#2563EB",
          positive: "#16C784",
          negative: "#EA3943",
          card: "#111317",
          input: "#0f1217",
          deep: "#0d1016",
          muted: "#7f8aa3",
          dim: "#71819b",
          grid: "#1a1f29",
          active: "#151d2a",
          loss: "#ff5b6e",
        },
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
