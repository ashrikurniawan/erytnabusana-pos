export interface PriceTierInput {
  id?: string;
  minQty: number;
  maxQty?: number | null;
  price: number;
  tierName?: string | null;
}

export interface PricingCalculationResult {
  unitPrice: number;
  subtotal: number;
  retailPrice: number;
  costPrice: number;
  profitEstimate: number;
  tierName: string;
  isWholesale: boolean;
  savingsPerUnit: number;
  totalSavings: number;
}

/**
 * Calculates effective unit price and subtotal based on quantity and wholesale tiers.
 * Supports decimal quantities (e.g. 2.5 meters).
 */
export function calculateItemPrice(
  retailPrice: number,
  costPrice: number,
  tiers: PriceTierInput[] = [],
  quantity: number
): PricingCalculationResult {
  if (quantity <= 0) {
    return {
      unitPrice: retailPrice,
      subtotal: 0,
      retailPrice,
      costPrice,
      profitEstimate: 0,
      tierName: "Eceran",
      isWholesale: false,
      savingsPerUnit: 0,
      totalSavings: 0,
    };
  }

  // Sort tiers by minQty ascending
  const sortedTiers = [...tiers].sort((a, b) => a.minQty - b.minQty);

  // Find matching tier
  // A tier matches if quantity >= minQty AND (maxQty is null/undefined OR quantity <= maxQty)
  let matchedTier: PriceTierInput | null = null;

  for (const tier of sortedTiers) {
    const min = tier.minQty;
    const max = tier.maxQty !== null && tier.maxQty !== undefined ? tier.maxQty : Infinity;

    if (quantity >= min && quantity <= max) {
      matchedTier = tier;
      break;
    }
  }

  const unitPrice = matchedTier ? matchedTier.price : retailPrice;
  const isWholesale = !!matchedTier && unitPrice < retailPrice;
  const subtotal = Math.round(unitPrice * quantity);
  const totalCost = costPrice * quantity;
  const profitEstimate = subtotal - totalCost;
  const savingsPerUnit = Math.max(0, retailPrice - unitPrice);
  const totalSavings = savingsPerUnit * quantity;

  let tierName = "Eceran";
  if (matchedTier) {
    if (matchedTier.tierName) {
      tierName = matchedTier.tierName;
    } else if (matchedTier.maxQty) {
      tierName = `Grosir (${matchedTier.minQty}-${matchedTier.maxQty})`;
    } else {
      tierName = `Grosir (≥${matchedTier.minQty})`;
    }
  }

  return {
    unitPrice,
    subtotal,
    retailPrice,
    costPrice,
    profitEstimate,
    tierName,
    isWholesale,
    savingsPerUnit,
    totalSavings,
  };
}
