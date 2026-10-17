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
    const filter = searchParams.get("filter"); // "low" for low stock only
    const search = searchParams.get("search")?.trim() || "";
    const categoryId = searchParams.get("categoryId") || "";

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        ...(categoryId ? { categoryId } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { sku: { contains: search } },
                { barcode: { contains: search } },
              ],
            }
          : {}),
      },
      include: {
        category: true,
        unit: true,
        inventory: true,
      },
      orderBy: { name: "asc" },
    });

    const inventoryList = products.map((p) => {
      const currentStock = p.inventory?.quantity ?? 0;
      const minStock = p.minStock;
      let stockStatus = "AMAN";
      if (currentStock <= 0) {
        stockStatus = "HABIS";
      } else if (currentStock <= minStock) {
        stockStatus = "MENIPIS";
      }

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        category: p.category.name,
        unit: p.unit.name,
        currentStock,
        minStock,
        stockStatus,
        costPrice: user.role === "KASIR" ? 0 : p.costPrice,
        retailPrice: p.retailPrice,
        allowDecimal: p.allowDecimal,
      };
    });

    const filtered = filter === "low"
      ? inventoryList.filter((item) => item.stockStatus === "MENIPIS" || item.stockStatus === "HABIS")
      : inventoryList;

    return NextResponse.json({ inventory: filtered });
  } catch (error) {
    console.error("Failed to load inventory:", error);
    return NextResponse.json({ error: "Gagal memuat persediaan." }, { status: 500 });
  }
}
