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
    if (!user || user.role === "KASIR") {
      return NextResponse.json(
        { error: "Forbidden: Kasir tidak memiliki akses konfirmasi penerimaan barang." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!purchase) {
      return NextResponse.json({ error: "Pembelian tidak ditemukan." }, { status: 404 });
    }

    if (purchase.status === "RECEIVED") {
      return NextResponse.json(
        { error: "Pembelian ini sudah diterima sebelumnya." },
        { status: 400 }
      );
    }

    if (purchase.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Pembelian yang dibatalkan tidak dapat diterima." },
        { status: 400 }
      );
    }

    const updatedPurchase = await prisma.$transaction(async (tx) => {
      // 1. Update purchase status
      const updated = await tx.purchase.update({
        where: { id },
        data: {
          status: "RECEIVED",
          receivedDate: new Date(),
        },
      });

      // 2. Increment stock for all items
      for (const item of purchase.items) {
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

        // 3. Record movement
        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            movementType: "PURCHASE_IN",
            quantity: item.quantity,
            previousStock,
            resultingStock,
            referenceId: purchase.id,
            reason: `Konfirmasi barang masuk faktur #${purchase.invoiceNumber}`,
            userId: user.id,
          },
        });
      }

      return updated;
    });

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "RECEIVE_PURCHASE",
      entity: "PURCHASE",
      entityId: purchase.id,
      details: { invoiceNumber: purchase.invoiceNumber },
    });

    return NextResponse.json({
      success: true,
      purchase: updatedPurchase,
      message: `Penerimaan barang faktur #${purchase.invoiceNumber} berhasil dikonfirmasi. Stok telah diperbarui.`,
    });
  } catch (error) {
    console.error("Receive purchase error:", error);
    return NextResponse.json({ error: "Gagal memproses penerimaan barang." }, { status: 500 });
  }
}
