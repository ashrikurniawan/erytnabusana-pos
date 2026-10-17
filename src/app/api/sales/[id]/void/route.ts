import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Hanya Admin / Pemilik yang berhak membatalkan transaksi." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { reason, restoreStock = true } = body;

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { error: "Alasan pembatalan transaksi wajib diisi." },
        { status: 400 }
      );
    }

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!sale) {
      return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
    }

    if (sale.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Transaksi ini sudah dibatalkan sebelumnya." },
        { status: 400 }
      );
    }

    const cancelledSale = await prisma.$transaction(async (tx) => {
      // 1. Mark sale as CANCELLED with reason and timestamp
      const updated = await tx.sale.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelReason: reason.trim(),
          cancelledAt: new Date(),
          cancelledBy: user.name,
        },
      });

      // 2. Restore stock if policy dictates
      if (restoreStock) {
        for (const item of sale.items) {
          const inv = await tx.inventory.findUnique({
            where: { productId: item.productId },
          });

          const previousStock = inv?.quantity ?? 0;
          const resultingStock = previousStock + item.quantity;

          await tx.inventory.upsert({
            where: { productId: item.productId },
            update: { quantity: resultingStock },
            create: { productId: item.productId, quantity: resultingStock },
          });

          await tx.inventoryMovement.create({
            data: {
              productId: item.productId,
              movementType: "ADJUSTMENT",
              quantity: item.quantity,
              previousStock,
              resultingStock,
              referenceId: sale.id,
              reason: `Pengembalian stok dari pembatalan nota #${sale.invoiceNumber}. Alasan: ${reason.trim()}`,
              userId: user.id,
            },
          });
        }
      }

      return updated;
    });

    // 3. Audit trail (Acceptance Test 6)
    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "VOID_SALE",
      entity: "SALE",
      entityId: sale.id,
      details: {
        invoiceNumber: sale.invoiceNumber,
        reason: reason.trim(),
        totalAmount: sale.totalAmount,
        restoreStock,
      },
    });

    return NextResponse.json({
      success: true,
      sale: cancelledSale,
      message: `Transaksi #${sale.invoiceNumber} berhasil dibatalkan dan stok dikembalikan.`,
    });
  } catch (error) {
    console.error("Void sale failed:", error);
    return NextResponse.json({ error: "Gagal membatalkan transaksi." }, { status: 500 });
  }
}
