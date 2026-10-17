import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const movementType = searchParams.get("movementType");
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const where: Record<string, unknown> = {};
    if (productId) where.productId = productId;
    if (movementType) where.movementType = movementType;

    const movements = await prisma.inventoryMovement.findMany({
      where,
      include: {
        product: {
          include: { unit: true },
        },
        user: {
          select: { name: true, username: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ movements });
  } catch (error) {
    console.error("Failed to load movements:", error);
    return NextResponse.json({ error: "Gagal memuat riwayat mutasi stok." }, { status: 500 });
  }
}
