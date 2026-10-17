import { describe, it, expect } from "vitest";
import { calculateItemPrice, PriceTierInput } from "../src/lib/pricing";

describe("Pricing Engine - Retail and Wholesale Tiers", () => {
  const retailPrice = 5000;
  const costPrice = 2500;
  const testTiers: PriceTierInput[] = [
    { minQty: 1, maxQty: 11, price: 5000, tierName: "Eceran" },
    { minQty: 12, maxQty: 99, price: 4000, tierName: "Grosir Sedang" },
    { minQty: 100, maxQty: null, price: 3500, tierName: "Grosir Besar" },
  ];

  // Acceptance Test 1: Penjualan Eceran
  // Diberikan produk dengan harga Rp5.000 per pcs. Kasir menjual 2 pcs.
  // Hasil yang diharapkan: Subtotal Rp10.000
  it("Acceptance Test 1: calculates retail price for 2 pcs correctly", () => {
    const result = calculateItemPrice(retailPrice, costPrice, testTiers, 2);
    expect(result.unitPrice).toBe(5000);
    expect(result.subtotal).toBe(10000);
    expect(result.tierName).toBe("Eceran");
    expect(result.profitEstimate).toBe(5000); // 10000 - (2500 * 2)
  });

  // Acceptance Test 2: Harga Grosir
  // Kasir menjual 12 pcs.
  // Hasil yang diharapkan: Harga Rp4.000 per pcs, Total Rp48.000, Tingkat harga tersimpan.
  it("Acceptance Test 2: calculates wholesale price for exactly 12 pcs correctly", () => {
    const result = calculateItemPrice(retailPrice, costPrice, testTiers, 12);
    expect(result.unitPrice).toBe(4000);
    expect(result.subtotal).toBe(48000);
    expect(result.tierName).toBe("Grosir Sedang");
    expect(result.isWholesale).toBe(true);
  });

  // Wajib: Unit test untuk setiap batas harga:
  // Satu unit di bawah ambang, tepat pada ambang, dan satu unit di atas ambang.

  // Threshold 1: 12 pcs
  it("Threshold 12: satu unit di bawah ambang (qty = 11)", () => {
    const result = calculateItemPrice(retailPrice, costPrice, testTiers, 11);
    expect(result.unitPrice).toBe(5000);
    expect(result.subtotal).toBe(55000);
    expect(result.tierName).toBe("Eceran");
  });

  it("Threshold 12: tepat pada ambang (qty = 12)", () => {
    const result = calculateItemPrice(retailPrice, costPrice, testTiers, 12);
    expect(result.unitPrice).toBe(4000);
    expect(result.subtotal).toBe(48000);
    expect(result.tierName).toBe("Grosir Sedang");
  });

  it("Threshold 12: satu unit di atas ambang (qty = 13)", () => {
    const result = calculateItemPrice(retailPrice, costPrice, testTiers, 13);
    expect(result.unitPrice).toBe(4000);
    expect(result.subtotal).toBe(52000);
    expect(result.tierName).toBe("Grosir Sedang");
  });

  // Threshold 2: 100 pcs
  it("Threshold 100: satu unit di bawah ambang (qty = 99)", () => {
    const result = calculateItemPrice(retailPrice, costPrice, testTiers, 99);
    expect(result.unitPrice).toBe(4000);
    expect(result.subtotal).toBe(396000);
    expect(result.tierName).toBe("Grosir Sedang");
  });

  it("Threshold 100: tepat pada ambang (qty = 100)", () => {
    const result = calculateItemPrice(retailPrice, costPrice, testTiers, 100);
    expect(result.unitPrice).toBe(3500);
    expect(result.subtotal).toBe(350000);
    expect(result.tierName).toBe("Grosir Besar");
  });

  it("Threshold 100: satu unit di atas ambang (qty = 101)", () => {
    const result = calculateItemPrice(retailPrice, costPrice, testTiers, 101);
    expect(result.unitPrice).toBe(3500);
    expect(result.subtotal).toBe(353500);
    expect(result.tierName).toBe("Grosir Besar");
  });

  // Decimal quantity test for fabrics
  it("supports decimal quantities for fabric per meter", () => {
    const fabricRetail = 35000;
    const fabricCost = 24000;
    const fabricTiers: PriceTierInput[] = [
      { minQty: 1, maxQty: 9.9, price: 35000, tierName: "Eceran Meteran" },
      { minQty: 10, maxQty: null, price: 30000, tierName: "Grosir Roll" },
    ];

    const result2_5m = calculateItemPrice(fabricRetail, fabricCost, fabricTiers, 2.5);
    expect(result2_5m.unitPrice).toBe(35000);
    expect(result2_5m.subtotal).toBe(87500);

    const result10m = calculateItemPrice(fabricRetail, fabricCost, fabricTiers, 10);
    expect(result10m.unitPrice).toBe(30000);
    expect(result10m.subtotal).toBe(300000);
  });
});
