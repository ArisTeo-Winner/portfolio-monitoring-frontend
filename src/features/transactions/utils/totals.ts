export function calculateBuyTotal(quantity: number, pricePerUnit: number, fee = 0) {
  return quantity * pricePerUnit + fee;
}

export function calculateSellTotal(quantity: number, pricePerUnit: number, fee = 0) {
  return quantity * pricePerUnit - fee;
}
