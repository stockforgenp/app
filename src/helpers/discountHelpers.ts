/**
 * Discount Calculation Helper Functions
 * Calculates monetary line-item or bill discounts with safe boundaries,
 * including proportional distribution across multiple items.
 */

export interface ItemForDiscount {
  gross: number; // in minor units
  individualDiscount?: number; // in minor units
}

export interface DistributedDiscountResult {
  allocatedWholeDiscount: number; // in minor units
  totalDiscount: number; // individual + allocated whole, capped at gross
  effectiveNet: number; // gross - totalDiscount
}

export function calculateDiscountAmount(
  type: 'FIXED' | 'PERCENT',
  value: number,
  baseSubtotalMinor: number
): number {
  if (value <= 0 || baseSubtotalMinor <= 0) return 0;

  if (type === 'PERCENT') {
    const cappedPercent = Math.min(100, Math.max(0, value));
    return Math.round((baseSubtotalMinor * cappedPercent) / 100);
  }

  // FIXED monetary discount (value is expected in minor units or converted)
  return Math.min(baseSubtotalMinor, Math.max(0, Math.round(value)));
}

export function validateDiscount(discountMinor: number, subtotalMinor: number): number {
  if (discountMinor < 0) return 0;
  if (discountMinor > subtotalMinor) return subtotalMinor;
  return discountMinor;
}

/**
 * Distribute whole discount across items proportionally based on item gross.
 * Uses exact integer remainder allocation to prevent any rounding discrepancies.
 */
export function calculateProportionalDiscounts(
  items: ItemForDiscount[],
  wholeDiscountMinor: number
): DistributedDiscountResult[] {
  if (items.length === 0) return [];

  const wholeDisc = Math.max(0, Math.floor(wholeDiscountMinor));
  const totalGross = items.reduce((sum, item) => sum + Math.max(0, item.gross), 0);

  if (wholeDisc === 0 || totalGross === 0) {
    return items.map((item) => {
      const indiv = Math.max(0, Math.floor(item.individualDiscount || 0));
      const cappedIndiv = Math.min(Math.max(0, item.gross), indiv);
      return {
        allocatedWholeDiscount: 0,
        totalDiscount: cappedIndiv,
        effectiveNet: Math.max(0, item.gross - cappedIndiv),
      };
    });
  }

  // Cap total whole discount to total gross
  const cappedWholeDiscount = Math.min(wholeDisc, totalGross);

  // Proportional distribution in minor units
  let accumulatedWhole = 0;
  const rawWholeShares: number[] = [];

  // Find the index of the last item with positive gross
  let lastPositiveIndex = -1;
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].gross > 0) {
      lastPositiveIndex = i;
      break;
    }
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.gross <= 0) {
      rawWholeShares.push(0);
      continue;
    }

    if (i === lastPositiveIndex) {
      const remainder = Math.max(0, cappedWholeDiscount - accumulatedWhole);
      rawWholeShares.push(remainder);
      accumulatedWhole += remainder;
    } else {
      const share = Math.round((cappedWholeDiscount * item.gross) / totalGross);
      rawWholeShares.push(share);
      accumulatedWhole += share;
    }
  }

  return items.map((item, idx) => {
    const gross = Math.max(0, item.gross);
    const indiv = Math.max(0, Math.floor(item.individualDiscount || 0));
    const wholeShare = rawWholeShares[idx] || 0;
    const totalDisc = Math.min(gross, indiv + wholeShare);
    const net = Math.max(0, gross - totalDisc);

    return {
      allocatedWholeDiscount: wholeShare,
      totalDiscount: totalDisc,
      effectiveNet: net,
    };
  });
}
