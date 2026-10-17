import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

interface ReturnItemPayload {
  saleItemId: string;
  quantity: number;
  condition: "RESTOCKABLE" | "DAMAGED";
  notes?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user || user.role === "KASIR") {
      return NextResponse.json(
        { error: "Forbidden: Retur memerlukan otorisasi Admin atau Petugas Stok." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { items, reason } = body;

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json({ error: "Alasan retur wajib diisi." }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Pilih minimal 1 item untuk diretur." }, { status: 400 });
    }

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        items: true,
        returns: { include: { items: true } },
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
    }

    if (sale.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Transaksi yang sudah dibatalkan tidak dapat diretur." },
        { status: 400 }
      );
    }

    // Calculate previously returned quantities per saleItemId
    const previouslyReturnedMap: Record<string, number> = {};
    for (const ret of sale.returns) {
      for (const retItem of ret.items) {
        previouslyReturnedMap[retItem.saleItemId] =
          (previouslyReturnedMap[retItem.saleItemId] || 0) + retItem.quantity;
      }
    }

    const returnResult = await prisma.$transaction(async (tx) => {
      let totalRefund = 0;
      const validatedReturnItems: {
        saleItem: (typeof sale.items)[0];
        quantity: number;
        refundAmount: number;
        condition: string;
        notes?: string;
      }[] = [];

      for (const itemPayload of items as ReturnItemPayload[]) {
        const saleItem = sale.items.find((i) => i.id === itemPayload.saleItemId);
        if (!saleItem) {
          throw new Error("Item tidak ditemukan dalam transaksi asli.");
        }

        const prevReturned = previouslyReturnedMap[saleItem.id] || 0;
        const remainingReturnable = saleItem.quantity - prevReturned;

        if (itemPayload.quantity <= 0 || itemPayload.quantity > remainingReturnable) {
          throw new Error(
            `Jumlah retur untuk "${saleItem.productName}" tidak valid. Maksimal retur yang diperbolehkan: ${remainingReturnable}.`
          );
        }

        const itemRefund = Math.round(saleItem.unitPrice * itemPayload.quantity);
        totalRefund += itemRefund;

        validatedReturnItems.push({
          saleItem,
          quantity: itemPayload.quantity,
          refundAmount: itemRefund,
          condition: itemPayload.condition || "RESTOCKABLE",
          notes: itemPayload.notes,
        });
      }

      // Generate Return Number
      const retCount = await tx.saleReturn.count();
      const returnNumber = `RET-${String(retCount + 1).padStart(5, "0")}`;

      const createdReturn = await tx.saleReturn.create({
        data: {
          returnNumber,
          saleId: sale.id,
          reason: reason.trim(),
          totalRefund,
          userId: user.id,
        },
      });

      for (const rItem of validatedReturnItems) {
        await tx.returnItem.create({
          data: {
            returnId: createdReturn.id,
            saleItemId: rItem.saleItem.id,
            productId: rItem.saleItem.productId,
            quantity: rItem.quantity,
            refundAmount: rItem.refundAmount,
            condition: rItem.condition,
            notes: rItem.notes || null,
          },
        });

        // If condition is RESTOCKABLE, increment inventory
        if (rItem.condition === "RESTOCKABLE") {
          const inv = await tx.inventory.findUnique({
            where: { productId: rItem.saleItem.productId },
          });
          const previousStock = inv?.quantity ?? 0;
          const resultingStock = previousStock + rItem.quantity;

          await tx.inventory.upsert({
            where: { productId: rItem.saleItem.productId },
            update: { quantity: resultingStock },
            create: { productId: rItem.saleItem.productId, quantity: resultingStock },
          });

          await tx.inventoryMovement.create({
            data: {
              productId: rItem.saleItem.productId,
              movementType: "CUSTOMER_RETURN",
              quantity: rItem.quantity,
              previousStock,
              resultingStock,
              referenceId: createdReturn.id,
              reason: `Retur pelanggan nota #${sale.invoiceNumber}. Barang layak jual kembali.`,
              userId: user.id,
            },
          });
        } else {
          // If DAMAGED, record damaged movement without incrementing salable stock
          const inv = await tx.inventory.findUnique({
            where: { productId: rItem.saleItem.productId },
          });
          const currentStock = inv?.quantity ?? 0;

          await tx.inventoryMovement.create({
            data: {
              productId: rItem.saleItem.productId,
              movementType: "DAMAGED",
              quantity: 0,
              previousStock: currentStock,
              resultingStock: currentStock,
              referenceId: createdReturn.id,
              reason: `Retur pelanggan nota #${sale.invoiceNumber} (Barang Rusak/Cacat).`,
              userId: user.id,
            },
          });
        }
      }

      // Check if partially or fully returned
      let totalAllOriginal = 0;
      let totalAllReturned = 0;
      for (const sItem of sale.items) {
        totalAllOriginal += sItem.quantity;
        const previously = previouslyReturnedMap[sItem.id] || 0;
        const current = validatedReturnItems.find((i) => i.saleItem.id === sItem.id)?.quantity || 0;
        totalAllReturned += previously + current;
      }

      const newStatus = totalAllReturned >= totalAllOriginal ? "RETURNED" : "PARTIALLY_RETURNED";
      await tx.sale.update({
        where: { id: sale.id },
        data: { status: newStatus },
      });

      return createdReturn;
    });

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "SALE_RETURN",
      entity: "SALE_RETURN",
      entityId: returnResult.id,
      details: {
        invoiceNumber: sale.invoiceNumber,
        returnNumber: returnResult.returnNumber,
        reason: reason.trim(),
        totalRefund: returnResult.totalRefund,
      },
    });

    return NextResponse.json({
      success: true,
      returnRecord: returnResult,
      message: `Retur #${returnResult.returnNumber} berhasil diproses. Total pengembalian dana: Rp ${returnResult.totalRefund.toLocaleString("id-ID")}`,
    });
  } catch (error: unknown) {
    console.error("Return failed:", error);
    const message = error instanceof Error ? error.message : "Terjadi kesalahan saat memproses retur.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
