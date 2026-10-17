import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { calculateItemPrice } from "@/lib/pricing";
import { logAudit } from "@/lib/audit";

interface CartItemPayload {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const status = searchParams.get("status");
    const cashierId = searchParams.get("cashierId");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (cashierId) {
      where.cashierId = cashierId;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        (where.date as Record<string, unknown>).gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        (where.date as Record<string, unknown>).lte = end;
      }
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        items: true,
        payments: true,
        customer: true,
      },
      orderBy: { date: "desc" },
      take: limit,
    });

    return NextResponse.json({ sales });
  } catch (error) {
    console.error("Failed to fetch sales:", error);
    return NextResponse.json({ error: "Gagal memuat riwayat transaksi." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Silakan login." }, { status: 401 });
    }

    const body = await request.json();
    const {
      customerId,
      customerName,
      items,
      discount = 0,
      paymentMethod = "CASH",
      amountTendered = 0,
      idempotencyKey,
      notes,
    } = body;

    // 1. Idempotency Check (Acceptance Test 8)
    if (idempotencyKey) {
      const existingSale = await prisma.sale.findUnique({
        where: { idempotencyKey },
        include: { items: true, payments: true },
      });
      if (existingSale) {
        // Return existing transaction without duplicate decrement
        return NextResponse.json({
          success: true,
          sale: existingSale,
          message: "Transaksi telah berhasil diproses sebelumnya (Idempotent).",
        });
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Keranjang belanja kosong." }, { status: 400 });
    }

    const setting = await prisma.storeSetting.findUnique({ where: { id: "default" } });
    const allowNegativeStock = setting?.allowNegativeStock ?? false;

    // 2. Atomic Database Transaction
    const completedSale = await prisma.$transaction(async (tx) => {
      let calculatedSubtotal = 0;
      const validatedItems: {
        product: { id: string; name: string; costPrice: number; retailPrice: number; unit: { name: string } };
        quantity: number;
        unitPrice: number;
        costPrice: number;
        subtotal: number;
        tierUsed: string;
        currentStock: number;
      }[] = [];

      for (const cartItem of items as CartItemPayload[]) {
        if (!cartItem.productId || !cartItem.quantity || cartItem.quantity <= 0) {
          throw new Error("Item produk atau jumlah tidak valid.");
        }

        const product = await tx.product.findUnique({
          where: { id: cartItem.productId },
          include: {
            unit: true,
            inventory: true,
            priceTiers: { orderBy: { minQty: "asc" } },
          },
        });

        if (!product || !product.isActive) {
          throw new Error(`Produk tidak ditemukan atau berstatus tidak aktif.`);
        }

        const currentStock = product.inventory?.quantity ?? 0;

        // Acceptance Test 4: Validate stock
        if (!allowNegativeStock && currentStock < cartItem.quantity) {
          throw new Error(
            `Stok untuk "${product.name}" tidak mencukupi (Tersedia: ${currentStock} ${product.unit.name}, Diminta: ${cartItem.quantity} ${product.unit.name}).`
          );
        }

        // Authoritative server-side price tier calculation (Acceptance Test 1 & 2)
        const pricing = calculateItemPrice(
          product.retailPrice,
          product.costPrice,
          product.priceTiers,
          cartItem.quantity
        );

        calculatedSubtotal += pricing.subtotal;

        validatedItems.push({
          product,
          quantity: cartItem.quantity,
          unitPrice: pricing.unitPrice,
          costPrice: product.costPrice,
          subtotal: pricing.subtotal,
          tierUsed: pricing.tierName,
          currentStock,
        });
      }

      const parsedDiscount = Math.max(0, parseFloat(discount) || 0);
      const totalAmount = Math.max(0, calculatedSubtotal - parsedDiscount);
      const tendered = parseFloat(amountTendered) || 0;

      // Acceptance Test 3: Cash tendered validation
      if (paymentMethod === "CASH") {
        if (tendered < totalAmount) {
          throw new Error(
            `Nominal uang yang diserahkan (Rp ${tendered.toLocaleString("id-ID")}) kurang dari total belanja (Rp ${totalAmount.toLocaleString("id-ID")}).`
          );
        }
      }

      const changeAmount = paymentMethod === "CASH" ? Math.max(0, tendered - totalAmount) : 0;

      // Generate invoice number: EB-YYYYMMDD-XXXX
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      const prefix = `EB-${yyyy}${mm}${dd}`;

      const countToday = await tx.sale.count({
        where: {
          invoiceNumber: { startsWith: prefix },
        },
      });
      const invoiceNumber = `${prefix}-${String(countToday + 1).padStart(4, "0")}`;

      // Create Sale record
      const sale = await tx.sale.create({
        data: {
          invoiceNumber,
          date: today,
          customerId: customerId || null,
          customerName: customerName || "Pelanggan Umum",
          cashierId: user.id,
          cashierName: user.name,
          subtotal: calculatedSubtotal,
          discount: parsedDiscount,
          totalAmount,
          paymentMethod,
          status: "COMPLETED",
          idempotencyKey: idempotencyKey || null,
          notes: notes ? notes.trim() : null,
        },
      });

      // Create Sale Items & Decrement Inventory atomically
      for (const item of validatedItems) {
        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: item.product.id,
            productName: item.product.name,
            unitName: item.product.unit.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            costPrice: item.costPrice,
            subtotal: item.subtotal,
            tierUsed: item.tierUsed,
          },
        });

        const newStock = item.currentStock - item.quantity;

        await tx.inventory.upsert({
          where: { productId: item.product.id },
          update: { quantity: newStock },
          create: { productId: item.product.id, quantity: newStock },
        });

        // Record stock movement (Acceptance Test 1 & 2)
        await tx.inventoryMovement.create({
          data: {
            productId: item.product.id,
            movementType: "SALE_OUT",
            quantity: -item.quantity,
            previousStock: item.currentStock,
            resultingStock: newStock,
            referenceId: sale.id,
            reason: `Penjualan Kasir Nota #${invoiceNumber}`,
            userId: user.id,
          },
        });
      }

      // Record Payment
      await tx.payment.create({
        data: {
          saleId: sale.id,
          method: paymentMethod,
          amountPaid: totalAmount,
          amountTendered: paymentMethod === "CASH" ? tendered : totalAmount,
          changeAmount,
          referenceNumber: paymentMethod !== "CASH" ? `PAY-${invoiceNumber}` : null,
          notes: notes || null,
        },
      });

      return await tx.sale.findUnique({
        where: { id: sale.id },
        include: {
          items: true,
          payments: true,
          customer: true,
        },
      });
    });

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "SALE_CHECKOUT",
      entity: "SALE",
      entityId: completedSale?.id,
      details: {
        invoiceNumber: completedSale?.invoiceNumber,
        total: completedSale?.totalAmount,
        method: completedSale?.paymentMethod,
      },
    });

    return NextResponse.json({
      success: true,
      sale: completedSale,
      message: "Transaksi berhasil diselesaikan.",
    });
  } catch (error: unknown) {
    console.error("Sale transaction failed:", error);
    const message = error instanceof Error ? error.message : "Terjadi kesalahan saat memproses transaksi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
