export function formatCurrency(value: string | number) {
  const amount = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatQuantity(value: string | number) {
  const amount = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 8,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatSignedCurrency(value: string | number) {
  const amount = typeof value === "string" ? Number(value) : value;
  const prefix = amount >= 0 ? "+" : "-";
  return `${prefix}${formatCurrency(Math.abs(amount))}`;
}

export function formatFeeCurrency(value: string | number, currency: string = "USD"): string {
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(amount);
}

export function formatMarketPrice(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "--";
  if (Math.abs(value) >= 1) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 8,
  }).format(value);
}
