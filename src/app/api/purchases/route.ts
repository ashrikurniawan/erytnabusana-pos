import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

interface PurchaseItemInput {
  productId: string;
  quantity: number;
  unitCost: number;
}

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role === "KASIR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const purchases = await prisma.purchase.findMany({
      where: status ? { status } : undefined,
      include: {
        supplier: true,
        user: { select: { name: true } },
        items: {
          include: {
            product: { include: { unit: true } },
          },
        },
      },
      orderBy: { purchaseDate: "desc" },
    });

    return NextResponse.json({ purchases });
  } catch (error) {
    console.error("Failed to load purchases:", error);
    return NextResponse.json({ error: "Gagal memuat pembelian." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role === "KASIR") {
      return NextResponse.json(
        { error: "Forbidden: Kasir tidak memiliki akses membuat pembelian." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { supplierId, invoiceNumber, items, notes, autoReceive } = body;

    if (!supplierId || !invoiceNumber || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Supplier, no. faktur pembelian, dan item barang wajib diisi." },
        { status: 400 }
      );
    }

    const existingInvoice = await prisma.purchase.findUnique({
      where: { invoiceNumber: invoiceNumber.trim() },
    });
    if (existingInvoice) {
      return NextResponse.json(
        { error: `Nomor faktur "${invoiceNumber}" sudah ada dalam sistem.` },
        { status: 400 }
      );
    }

    let totalAmount = 0;
    const validatedItems: {
      productId: string;
      quantity: number;
      unitCost: number;
      subtotal: number;
    }[] = [];

    for (const it of items as PurchaseItemInput[]) {
      const qty = parseFloat(String(it.quantity)) || 0;
      const cost = parseFloat(String(it.unitCost)) || 0;
      if (qty <= 0 || cost < 0) {
        return NextResponse.json(
          { error: "Jumlah barang dan harga beli harus berupa angka positif." },
          { status: 400 }
        );
      }
      const sub = Math.round(qty * cost);
      totalAmount += sub;
      validatedItems.push({
        productId: it.productId,
        quantity: qty,
        unitCost: cost,
        subtotal: sub,
      });
    }

    const initialStatus = autoReceive ? "RECEIVED" : "DRAFT";

    const purchase = await prisma.$transaction(async (tx) => {
      const p = await tx.purchase.create({
        data: {
          supplierId,
          invoiceNumber: invoiceNumber.trim(),
          purchaseDate: new Date(),
          totalAmount,
          status: initialStatus,
          receivedDate: autoReceive ? new Date() : null,
          notes: notes ? notes.trim() : null,
          userId: user.id,
        },
      });

      for (const vItem of validatedItems) {
        await tx.purchaseItem.create({
          data: {
            purchaseId: p.id,
            productId: vItem.productId,
            quantity: vItem.quantity,
            unitCost: vItem.unitCost,
            subtotal: vItem.subtotal,
          },
        });

        // If autoReceive is true, add to inventory immediately
        if (autoReceive) {
          const inv = await tx.inventory.findUnique({
            where: { productId: vItem.productId },
          });
          const previousStock = inv?.quantity ?? 0;
          const resultingStock = previousStock + vItem.quantity;

          await tx.inventory.upsert({
            where: { productId: vItem.productId },
            update: { quantity: resultingStock },
            create: { productId: vItem.productId, quantity: resultingStock },
          });

          await tx.inventoryMovement.create({
            data: {
              productId: vItem.productId,
              movementType: "PURCHASE_IN",
              quantity: vItem.quantity,
              previousStock,
              resultingStock,
              referenceId: p.id,
              reason: `Penerimaan pembelian faktur #${p.invoiceNumber}`,
              userId: user.id,
            },
          });
        }
      }

      return p;
    });

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "CREATE_PURCHASE",
      entity: "PURCHASE",
      entityId: purchase.id,
      details: {
        invoiceNumber: purchase.invoiceNumber,
        status: purchase.status,
        totalAmount: purchase.totalAmount,
      },
    });

    return NextResponse.json({ success: true, purchase }, { status: 201 });
  } catch (error) {
    console.error("Failed to create purchase:", error);
    return NextResponse.json({ error: "Gagal membuat pembelian." }, { status: 500 });
  }
}
