import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        items: true,
        payments: true,
        customer: true,
        returns: {
          include: { items: true },
        },
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
    }

    // Kasir cannot view costPrice in items (Acceptance Test 7)
    if (user.role === "KASIR") {
      const sanitizedItems = sale.items.map((it) => ({
        ...it,
        costPrice: 0,
      }));
      return NextResponse.json({ sale: { ...sale, items: sanitizedItems } });
    }

    return NextResponse.json({ sale });
  } catch (error) {
    console.error("Failed to get sale:", error);
    return NextResponse.json({ error: "Gagal memuat detail transaksi." }, { status: 500 });
  }
}
