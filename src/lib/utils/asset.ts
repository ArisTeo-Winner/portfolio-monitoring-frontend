const KNOWN_STOCKS = ["MSFT", "AAPL", "GOOGL", "AMZN", "TSLA", "META", "NVDA", "CRCL"];
const KNOWN_INDICES = ["SPY", "QQQ", "DIA"];

export function getAssetDisplayName(symbol: string): string {
  const key = symbol.toUpperCase();
  const names: Record<string, string> = {
    BTC: "Bitcoin",
    ETH: "Ethereum",
    SOL: "Solana",
    BNB: "BNB",
    XRP: "XRP",
    USDT: "Tether",
    USDC: "USD Coin",
    ADA: "Cardano",
    DOGE: "Dogecoin",
    PEPE: "Pepe",
    AAPL: "Apple Inc.",
    MSFT: "Microsoft Corp.",
    GOOGL: "Alphabet Inc.",
    NVDA: "NVIDIA Corp",
    AMZN: "Amazon",
    TSLA: "Tesla",
    SPY: "SPDR S&P 500 ETF",
    QQQ: "Invesco QQQ Trust",
    META: "Meta Platforms",
    HYPE: "Hyperliquid",
  };
  return names[key] ?? key;
}

export function getAssetPalette(symbol: string): { base: string; highlight: string; text: string } {
  const palettes = [
    { base: "#3861fb", highlight: "#7b97ff", text: "#f8fbff" },
    { base: "#16c784", highlight: "#6ce4b0", text: "#f7fff8" },
    { base: "#8b5cf6", highlight: "#b898ff", text: "#fff7ff" },
    { base: "#f59e0b", highlight: "#ffc45f", text: "#fff9f5" },
    { base: "#ef4444", highlight: "#ff9a9a", text: "#fff7f7" },
  ];
  const index = symbol.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % palettes.length;
  return palettes[index];
}

export function normalizeAssetType(assetType: string, assetSymbol?: string): string {
  if (assetSymbol) {
    const symbol = assetSymbol.toUpperCase();
    if (KNOWN_STOCKS.includes(symbol)) return "STOCK";
    if (KNOWN_INDICES.includes(symbol)) return "INDEX";
  }
  const normalized = assetType.trim().toUpperCase();
  if (normalized === "STOCKS") return "STOCK";
  if (normalized === "ETFS") return "ETF";
  return normalized;
}
