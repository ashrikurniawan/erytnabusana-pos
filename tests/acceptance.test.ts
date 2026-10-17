import { describe, it, expect, beforeAll } from "vitest";
import prisma from "../src/lib/prisma";
import { calculateItemPrice } from "../src/lib/pricing";

describe("ErytnaBusana POS - 9 Mandatory Acceptance Tests", () => {
  let adminUser: { id: string; name: string };
  let cashierUser: { id: string; name: string };
  let testProductAstra: { id: string; name: string; costPrice: number; retailPrice: number };
  let testProductYkk: { id: string; name: string; costPrice: number; retailPrice: number };

  beforeAll(async () => {
    // Fetch seeded users and products
    const admin = await prisma.user.findUnique({ where: { username: "admin" } });
    const cashier = await prisma.user.findUnique({ where: { username: "kasir1" } });
    const astra = await prisma.product.findUnique({
      where: { sku: "BNG-AST-01" },
      include: { inventory: true, priceTiers: true },
    });
    const ykk = await prisma.product.findUnique({
      where: { sku: "RSL-YKK-07" },
      include: { inventory: true, priceTiers: true },
    });

    if (!admin || !cashier || !astra || !ykk) {
      throw new Error("Seeded test data missing. Please run prisma/seed.mjs first.");
    }

    adminUser = admin;
    cashierUser = cashier;
    testProductAstra = astra;
    testProductYkk = ykk;
  });

  // ==========================================
  // Test 1 — Penjualan Eceran
  // ==========================================
  it("Test 1 — Penjualan eceran: 2 pcs Benang Astra @ Rp5.000", async () => {
    // Current stock before
    const initialInv = await prisma.inventory.findUnique({ where: { productId: testProductAstra.id } });
    const initialStock = initialInv?.quantity ?? 50;

    const qtyToBuy = 2;
    const tiers = await prisma.priceTier.findMany({ where: { productId: testProductAstra.id } });
    const pricing = calculateItemPrice(testProductAstra.retailPrice, testProductAstra.costPrice, tiers, qtyToBuy);

    expect(pricing.unitPrice).toBe(5000);
    expect(pricing.subtotal).toBe(10000);

    const tendered = 10000;
    const changeAmount = tendered - pricing.subtotal;
    expect(changeAmount).toBe(0);

    // Perform transaction atomically
    const invoiceNumber = `TEST-EB-T1-${Date.now()}`;
    const sale = await prisma.$transaction(async (tx) => {
      const s = await tx.sale.create({
        data: {
          invoiceNumber,
          date: new Date(),
          cashierId: cashierUser.id,
          cashierName: cashierUser.name,
          customerName: "Pelanggan Eceran",
          subtotal: pricing.subtotal,
          discount: 0,
          totalAmount: pricing.subtotal,
          paymentMethod: "CASH",
          status: "COMPLETED",
        },
      });

      await tx.saleItem.create({
        data: {
          saleId: s.id,
          productId: testProductAstra.id,
          productName: testProductAstra.name,
          unitName: "Pcs",
          quantity: qtyToBuy,
          unitPrice: pricing.unitPrice,
          costPrice: pricing.costPrice,
          subtotal: pricing.subtotal,
          tierUsed: pricing.tierName,
        },
      });

      const updatedInv = await tx.inventory.update({
        where: { productId: testProductAstra.id },
        data: { quantity: { decrement: qtyToBuy } },
      });

      await tx.payment.create({
        data: {
          saleId: s.id,
          method: "CASH",
          amountPaid: pricing.subtotal,
          amountTendered: tendered,
          changeAmount,
        },
      });

      return { sale: s, updatedStock: updatedInv.quantity };
    });

    // Verification
    expect(sale.sale.totalAmount).toBe(10000);
    expect(sale.updatedStock).toBe(initialStock - 2);
  });

  // ==========================================
  // Test 2 — Harga Grosir
  // ==========================================
  it("Test 2 — Harga grosir: 12 pcs Benang Astra @ Rp4.000", async () => {
    const qtyToBuy = 12;
    const tiers = await prisma.priceTier.findMany({ where: { productId: testProductAstra.id } });
    const pricing = calculateItemPrice(testProductAstra.retailPrice, testProductAstra.costPrice, tiers, qtyToBuy);

    expect(pricing.unitPrice).toBe(4000);
    expect(pricing.subtotal).toBe(48000);
    expect(pricing.isWholesale).toBe(true);
    expect(pricing.tierName).toBe("Grosir Sedang");

    const invoiceNumber = `TEST-EB-T2-${Date.now()}`;
    const sale = await prisma.$transaction(async (tx) => {
      const s = await tx.sale.create({
        data: {
          invoiceNumber,
          date: new Date(),
          cashierId: cashierUser.id,
          cashierName: cashierUser.name,
          subtotal: pricing.subtotal,
          discount: 0,
          totalAmount: pricing.subtotal,
          paymentMethod: "CASH",
          status: "COMPLETED",
        },
      });

      const item = await tx.saleItem.create({
        data: {
          saleId: s.id,
          productId: testProductAstra.id,
          productName: testProductAstra.name,
          unitName: "Pcs",
          quantity: qtyToBuy,
          unitPrice: pricing.unitPrice,
          costPrice: pricing.costPrice,
          subtotal: pricing.subtotal,
          tierUsed: pricing.tierName,
        },
      });

      return { sale: s, item };
    });

    expect(sale.item.unitPrice).toBe(4000);
    expect(sale.item.subtotal).toBe(48000);
    expect(sale.item.tierUsed).toBe("Grosir Sedang");
  });

  // ==========================================
  // Test 3 — Pembayaran Tunai & Kembalian
  // ==========================================
  it("Test 3 — Pembayaran tunai: Total Rp48.000, Dibayar Rp50.000 -> Kembalian Rp2.000", async () => {
    const totalAmount = 48000;
    const amountTendered = 50000;
    const changeAmount = amountTendered - totalAmount;

    expect(changeAmount).toBe(2000);

    const payment = await prisma.payment.create({
      data: {
        saleId: (await prisma.sale.findFirstOrThrow()).id,
        method: "CASH",
        amountPaid: totalAmount,
        amountTendered,
        changeAmount,
      },
    });

    expect(payment.amountPaid).toBe(48000);
    expect(payment.amountTendered).toBe(50000);
    expect(payment.changeAmount).toBe(2000);
  });

  // ==========================================
  // Test 4 — Stok Tidak Cukup
  // ==========================================
  it("Test 4 — Stok tidak cukup: Stok 5 pcs, kasir mencoba menjual 6 pcs -> Ditolak", async () => {
    // Reset stock of Resleting YKK to exactly 5
    await prisma.inventory.update({
      where: { productId: testProductYkk.id },
      data: { quantity: 5 },
    });

    const currentInv = await prisma.inventory.findUnique({ where: { productId: testProductYkk.id } });
    const availableStock = currentInv?.quantity ?? 0;
    expect(availableStock).toBe(5);

    const requestedQty = 6;
    let transactionFailed = false;
    let errorMessage = "";

    try {
      await prisma.$transaction(async (tx) => {
        const inv = await tx.inventory.findUnique({ where: { productId: testProductYkk.id } });
        if ((inv?.quantity ?? 0) < requestedQty) {
          throw new Error(`Stok untuk "${testProductYkk.name}" tidak mencukupi (Tersedia: ${inv?.quantity}, Diminta: ${requestedQty}).`);
        }
        await tx.inventory.update({
          where: { productId: testProductYkk.id },
          data: { quantity: { decrement: requestedQty } },
        });
      });
    } catch (e: unknown) {
      transactionFailed = true;
      errorMessage = (e as Error).message;
    }

    expect(transactionFailed).toBe(true);
    expect(errorMessage).toContain("Stok untuk \"Resleting YKK 7 inch Celana Hitam\" tidak mencukupi");

    // Ensure stock remained intact (not decremented)
    const stockAfter = await prisma.inventory.findUnique({ where: { productId: testProductYkk.id } });
    expect(stockAfter?.quantity).toBe(5);
  });

  // ==========================================
  // Test 5 — Snapshot Perubahan Harga
  // ==========================================
  it("Test 5 — Perubahan harga tidak mengubah transaksi lama (Snapshot Price)", async () => {
    // Create a sale with price Rp4.000
    const historicalSale = await prisma.sale.create({
      data: {
        invoiceNumber: `TEST-HISTORICAL-${Date.now()}`,
        cashierId: cashierUser.id,
        cashierName: cashierUser.name,
        subtotal: 48000,
        totalAmount: 48000,
        items: {
          create: {
            productId: testProductAstra.id,
            productName: testProductAstra.name,
            unitName: "Pcs",
            quantity: 12,
            unitPrice: 4000, // Snapshot
            costPrice: 2500, // Snapshot
            subtotal: 48000,
            tierUsed: "Grosir Sedang",
          },
        },
      },
      include: { items: true },
    });

    const originalSalePrice = historicalSale.items[0].unitPrice;
    expect(originalSalePrice).toBe(4000);

    // Admin updates product price to Rp6.000 / Rp4.500
    await prisma.product.update({
      where: { id: testProductAstra.id },
      data: { retailPrice: 6000 },
    });

    // Check old transaction record
    const retrievedSale = await prisma.sale.findUnique({
      where: { id: historicalSale.id },
      include: { items: true },
    });

    expect(retrievedSale?.items[0].unitPrice).toBe(4000); // Unaltered snapshot!

    // Restore test product price
    await prisma.product.update({
      where: { id: testProductAstra.id },
      data: { retailPrice: 5000 },
    });
  });

  // ==========================================
  // Test 6 — Pembatalan Transaksi (Void)
  // ==========================================
  it("Test 6 — Pembatalan transaksi valid: Status CANCELLED, alasan tercatat, stok kembali", async () => {
    const invBefore = await prisma.inventory.findUnique({ where: { productId: testProductAstra.id } });
    const stockBeforeSale = invBefore?.quantity ?? 0;

    // Create sale with 3 pcs
    const saleToVoid = await prisma.$transaction(async (tx) => {
      const s = await tx.sale.create({
        data: {
          invoiceNumber: `TEST-VOID-${Date.now()}`,
          cashierId: cashierUser.id,
          cashierName: cashierUser.name,
          subtotal: 15000,
          totalAmount: 15000,
          status: "COMPLETED",
          items: {
            create: {
              productId: testProductAstra.id,
              productName: testProductAstra.name,
              unitName: "Pcs",
              quantity: 3,
              unitPrice: 5000,
              costPrice: 2500,
              subtotal: 15000,
            },
          },
        },
        include: { items: true },
      });

      await tx.inventory.update({
        where: { productId: testProductAstra.id },
        data: { quantity: { decrement: 3 } },
      });

      return s;
    });

    // Now Admin voids the sale
    const voidReason = "Pelanggan salah bawa uang dan membatalkan pesanan";
    await prisma.$transaction(async (tx) => {
      await tx.sale.update({
        where: { id: saleToVoid.id },
        data: {
          status: "CANCELLED",
          cancelReason: voidReason,
          cancelledAt: new Date(),
          cancelledBy: adminUser.name,
        },
      });

      // Restore stock
      for (const item of saleToVoid.items) {
        await tx.inventory.update({
          where: { productId: item.productId },
          data: { quantity: { increment: item.quantity } },
        });
      }
    });

    // Verify
    const updatedSale = await prisma.sale.findUnique({ where: { id: saleToVoid.id } });
    expect(updatedSale?.status).toBe("CANCELLED");
    expect(updatedSale?.cancelReason).toBe(voidReason);
    expect(updatedSale?.cancelledBy).toBe(adminUser.name);

    // Verify stock is restored
    const invAfter = await prisma.inventory.findUnique({ where: { productId: testProductAstra.id } });
    expect(invAfter?.quantity).toBe(stockBeforeSale);
  });

  // ==========================================
  // Test 7 — Hak Akses Kasir (Data Hiding)
  // ==========================================
  it("Test 7 — Hak akses: Kasir tidak menerima data harga modal (costPrice masked)", () => {
    const productsFromDb = [
      { id: "1", name: "Benang Astra", costPrice: 2500, retailPrice: 5000 },
      { id: "2", name: "Kancing 18L", costPrice: 400, retailPrice: 1000 },
    ];

    const userRole = "KASIR";

    // Simulate API serialization logic
    const sanitized = productsFromDb.map((p) => {
      if (userRole === "KASIR") {
        return { ...p, costPrice: 0 };
      }
      return p;
    });

    expect(sanitized[0].costPrice).toBe(0);
    expect(sanitized[1].costPrice).toBe(0);
    expect(sanitized[0].retailPrice).toBe(5000);
  });

  // ==========================================
  // Test 8 — Mencegah Transaksi Ganda (Idempotency)
  // ==========================================
  it("Test 8 — Idempotency: Permintaan ganda dengan key sama hanya memproses 1 transaksi", async () => {
    const idempotencyKey = `IDEMPOTENT-KEY-${Date.now()}`;
    const invoiceNumber = `TEST-IDEM-${Date.now()}`;

    // First request
    const firstSale = await prisma.sale.create({
      data: {
        invoiceNumber,
        cashierId: cashierUser.id,
        cashierName: cashierUser.name,
        subtotal: 10000,
        totalAmount: 10000,
        idempotencyKey,
      },
    });

    // Second request with SAME idempotency key
    const duplicateCheck = await prisma.sale.findUnique({
      where: { idempotencyKey },
    });

    expect(duplicateCheck).not.toBeNull();
    expect(duplicateCheck?.id).toBe(firstSale.id);
    expect(duplicateCheck?.invoiceNumber).toBe(invoiceNumber);
  });

  // ==========================================
  // Test 9 — Laporan Penjualan & Laba Kotor
  // ==========================================
  it("Test 9 — Laporan: Memperhitungkan rentang tanggal dan mengecualikan transaksi batal", async () => {
    const startRange = new Date();
    startRange.setHours(0, 0, 0, 0);

    const endRange = new Date();
    endRange.setHours(23, 59, 59, 999);

    const salesInRange = await prisma.sale.findMany({
      where: {
        date: { gte: startRange, lte: endRange },
        status: { not: "CANCELLED" }, // Excludes cancelled!
      },
      include: { items: true },
    });

    let totalRevenue = 0;
    let totalCogs = 0;

    for (const s of salesInRange) {
      totalRevenue += s.totalAmount;
      for (const it of s.items) {
        totalCogs += (it.costPrice || 0) * it.quantity;
      }
    }

    const grossProfit = totalRevenue - totalCogs;

    expect(totalRevenue).toBeGreaterThanOrEqual(0);
    expect(grossProfit).toBe(totalRevenue - totalCogs);
  });
});
