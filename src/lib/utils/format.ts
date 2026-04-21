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
