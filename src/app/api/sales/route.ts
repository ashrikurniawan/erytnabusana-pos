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

    // Fetch all requested products and their related data in ONE query outside the transaction
    const cartProductIds = (items as CartItemPayload[]).map((i) => i.productId).filter(Boolean);
    const productsFromDb = await prisma.product.findMany({
      where: { id: { in: cartProductIds } },
      include: {
        unit: true,
        inventory: true,
        priceTiers: { orderBy: { minQty: "asc" } },
      },
    });

    const productMap = new Map(productsFromDb.map((p) => [p.id, p]));

    let calculatedSubtotal = 0;
    const validatedItems: {
      product: (typeof productsFromDb)[0];
      quantity: number;
      unitPrice: number;
      costPrice: number;
      subtotal: number;
      tierUsed: string;
      currentStock: number;
    }[] = [];

    for (const cartItem of items as CartItemPayload[]) {
      if (!cartItem.productId || !cartItem.quantity || cartItem.quantity <= 0) {
        return NextResponse.json({ error: "Item produk atau jumlah tidak valid." }, { status: 400 });
      }

      const product = productMap.get(cartItem.productId);
      if (!product || !product.isActive) {
        return NextResponse.json(
          { error: `Produk tidak ditemukan atau berstatus tidak aktif.` },
          { status: 400 }
        );
      }

      const currentStock = product.inventory?.quantity ?? 0;

      // Validate stock
      if (!allowNegativeStock && currentStock < cartItem.quantity) {
        return NextResponse.json(
          {
            error: `Stok untuk "${product.name}" tidak mencukupi (Tersedia: ${currentStock} ${product.unit.name}, Diminta: ${cartItem.quantity} ${product.unit.name}).`,
          },
          { status: 400 }
        );
      }

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

    // Cash tendered validation
    if (paymentMethod === "CASH") {
      if (tendered < totalAmount) {
        return NextResponse.json(
          {
            error: `Nominal uang yang diserahkan (Rp ${tendered.toLocaleString("id-ID")}) kurang dari total belanja (Rp ${totalAmount.toLocaleString("id-ID")}).`,
          },
          { status: 400 }
        );
      }
    }

    const changeAmount = paymentMethod === "CASH" ? Math.max(0, tendered - totalAmount) : 0;

    // Generate invoice prefix outside transaction
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const prefix = `EB-${yyyy}${mm}${dd}`;

    // 2. Atomic Database Transaction with generous timeout configuration
    const createdSaleId = await prisma.$transaction(
      async (tx) => {
        const countToday = await tx.sale.count({
          where: {
            invoiceNumber: { startsWith: prefix },
          },
        });
        const invoiceNumber = `${prefix}-${String(countToday + 1).padStart(4, "0")}`;

        // 1. Create Sale, Items, and Payment in a SINGLE nested create query
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
            items: {
              create: validatedItems.map((item) => ({
                productId: item.product.id,
                productName: item.product.name,
                unitName: item.product.unit.name,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                costPrice: item.costPrice,
                subtotal: item.subtotal,
                tierUsed: item.tierUsed,
              })),
            },
            payments: {
              create: {
                method: paymentMethod,
                amountPaid: totalAmount,
                amountTendered: paymentMethod === "CASH" ? tendered : totalAmount,
                changeAmount,
                referenceNumber: paymentMethod !== "CASH" ? `PAY-${invoiceNumber}` : null,
                notes: notes || null,
              },
            },
          },
        });

        // 2. Update Inventory and Record Movements atomically
        for (const item of validatedItems) {
          const newStock = item.currentStock - item.quantity;

          await tx.inventory.upsert({
            where: { productId: item.product.id },
            update: { quantity: newStock },
            create: { productId: item.product.id, quantity: newStock },
          });

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

        return sale.id;
      },
      {
        maxWait: 15000,
        timeout: 30000,
      }
    );

    // Fetch complete sale details with relations OUTSIDE the transaction
    const completedSale = await prisma.sale.findUnique({
      where: { id: createdSaleId },
      include: {
        items: true,
        payments: true,
        customer: true,
      },
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
