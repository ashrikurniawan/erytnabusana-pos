import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

interface OpnameItem {
  productId: string;
  physicalStock: number;
  reason: string;
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role === "KASIR") {
      return NextResponse.json(
        { error: "Forbidden: Kasir tidak memiliki akses stok opname." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { items, opnameNote } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Daftar item stok opname tidak boleh kosong." },
        { status: 400 }
      );
    }

    const adjustments = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const item of items as OpnameItem[]) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          include: { inventory: true, unit: true },
        });

        if (!product) continue;

        const currentStock = product.inventory?.quantity ?? 0;
        const physical = parseFloat(String(item.physicalStock));
        const delta = physical - currentStock;

        // Only record if there is a difference or explicit confirmation
        if (delta !== 0) {
          await tx.inventory.upsert({
            where: { productId: product.id },
            update: { quantity: physical },
            create: { productId: product.id, quantity: physical },
          });

          const mov = await tx.inventoryMovement.create({
            data: {
              productId: product.id,
              movementType: "ADJUSTMENT",
              quantity: delta,
              previousStock: currentStock,
              resultingStock: physical,
              reason: `Stok Opname: Selisih ${delta > 0 ? "+" : ""}${delta} ${product.unit.name}. Alasan: ${item.reason || opnameNote || "Penyesuaian fisik"}`,
              userId: user.id,
            },
          });

          results.push({
            productId: product.id,
            productName: product.name,
            previousStock: currentStock,
            physicalStock: physical,
            delta,
            movementId: mov.id,
          });
        }
      }

      return results;
    });

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "STOCK_OPNAME",
      entity: "INVENTORY",
      details: {
        adjustedItemCount: adjustments.length,
        note: opnameNote,
        adjustments,
      },
    });

    return NextResponse.json({
      success: true,
      adjustments,
      message: `Stok opname berhasil disimpan. Sebanyak ${adjustments.length} item telah disesuaikan.`,
    });
  } catch (error) {
    console.error("Opname failed:", error);
    return NextResponse.json({ error: "Gagal memproses stok opname." }, { status: 500 });
  }
}
