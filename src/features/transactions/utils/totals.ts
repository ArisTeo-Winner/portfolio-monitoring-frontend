export function calculateBuyTotal(quantity: number, pricePerUnit: number, fee = 0) {
  return quantity * pricePerUnit + fee;
}

export function calculateSellTotal(quantity: number, pricePerUnit: number, fee = 0) {
  return quantity * pricePerUnit - fee;
}

/**
 * The fee that actually reduces/adds to the total. In the manual commission/IVA
 * split path the effective fee is commission + IVA; otherwise it's the single
 * fee the user typed.
 */
export function resolveEffectiveFee(usesSplit: boolean, commission: number, iva: number, fee: number) {
  return usesSplit ? commission + iva : fee;
}

/**
 * Picks the fee shape to send to the backend, enforcing the ADR-0005 rule that
 * the split fields and the single `fee` are mutually exclusive: when the split
 * is active AND the user entered a commission or IVA, send the split (backend
 * derives `fee` from the sum); otherwise send the single `fee` (undefined when 0
 * so it is omitted from the request body).
 */
export function buildFeePayload(
  usesSplit: boolean,
  commission: number,
  iva: number,
  fee: number,
): { brokerCommission: number; brokerIva: number } | { fee: number | undefined } {
  if (usesSplit && (commission > 0 || iva > 0)) {
    return { brokerCommission: commission, brokerIva: iva };
  }
  return { fee: fee || undefined };
}
