import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

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
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        unit: true,
        inventory: true,
        priceTiers: {
          orderBy: { minQty: "asc" },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });
    }

    if (user.role === "KASIR") {
      return NextResponse.json({
        product: {
          ...product,
          costPrice: 0,
        },
      });
    }

    return NextResponse.json({ product });
  } catch (error) {
    console.error("Failed to get product:", error);
    return NextResponse.json({ error: "Gagal memuat detail produk." }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user || user.role === "KASIR") {
      return NextResponse.json(
        { error: "Forbidden: Kasir tidak memiliki izin mengubah data produk." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const {
      name,
      sku,
      barcode,
      categoryId,
      unitId,
      brand,
      description,
      costPrice,
      retailPrice,
      minStock,
      allowDecimal,
      isActive,
      priceTiers,
    } = body;

    const existingProduct = await prisma.product.findUnique({
      where: { id },
      include: { priceTiers: true },
    });

    if (!existingProduct) {
      return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });
    }

    // Check SKU if changed
    if (sku && sku !== existingProduct.sku) {
      const duplicateSku = await prisma.product.findUnique({
        where: { sku: sku.trim() },
      });
      if (duplicateSku && duplicateSku.id !== id) {
        return NextResponse.json(
          { error: `SKU "${sku}" sudah digunakan produk lain.` },
          { status: 400 }
        );
      }
    }

    const parsedCost = costPrice !== undefined ? parseFloat(costPrice) : existingProduct.costPrice;
    const parsedRetail = retailPrice !== undefined ? parseFloat(retailPrice) : existingProduct.retailPrice;
    const parsedMinStock = minStock !== undefined ? parseFloat(minStock) : existingProduct.minStock;

    const updated = await prisma.$transaction(async (tx) => {
      // Update product fields
      const p = await tx.product.update({
        where: { id },
        data: {
          name: name ? name.trim() : existingProduct.name,
          sku: sku ? sku.trim() : existingProduct.sku,
          barcode: barcode !== undefined ? (barcode ? barcode.trim() : null) : existingProduct.barcode,
          categoryId: categoryId || existingProduct.categoryId,
          unitId: unitId || existingProduct.unitId,
          brand: brand !== undefined ? (brand ? brand.trim() : null) : existingProduct.brand,
          description: description !== undefined ? (description ? description.trim() : null) : existingProduct.description,
          costPrice: parsedCost,
          retailPrice: parsedRetail,
          minStock: parsedMinStock,
          allowDecimal: allowDecimal !== undefined ? !!allowDecimal : existingProduct.allowDecimal,
          isActive: isActive !== undefined ? !!isActive : existingProduct.isActive,
        },
      });

      // Update price tiers if provided
      if (Array.isArray(priceTiers)) {
        await tx.priceTier.deleteMany({
          where: { productId: id },
        });

        for (const tier of priceTiers) {
          if (tier.minQty && tier.price) {
            await tx.priceTier.create({
              data: {
                productId: id,
                minQty: parseFloat(tier.minQty),
                maxQty: tier.maxQty ? parseFloat(tier.maxQty) : null,
                price: parseFloat(tier.price),
                tierName: tier.tierName || null,
              },
            });
          }
        }
      }

      return p;
    });

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "UPDATE_PRODUCT",
      entity: "PRODUCT",
      entityId: id,
      details: {
        name: updated.name,
        oldPrice: existingProduct.retailPrice,
        newPrice: updated.retailPrice,
        oldCost: existingProduct.costPrice,
        newCost: updated.costPrice,
      },
    });

    return NextResponse.json({ success: true, product: updated });
  } catch (error) {
    console.error("Failed to update product:", error);
    return NextResponse.json({ error: "Gagal memperbarui produk." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Hanya Admin yang dapat menghapus data produk." },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Rule: Check if used in transactions
    const salesCount = await prisma.saleItem.count({ where: { productId: id } });
    const purchasesCount = await prisma.purchaseItem.count({ where: { productId: id } });

    if (salesCount > 0 || purchasesCount > 0) {
      return NextResponse.json(
        {
          error:
            "Produk tidak dapat dihapus karena sudah memiliki riwayat transaksi penjualan/pembelian. Silakan nonaktifkan produk agar tidak muncul di kasir.",
        },
        { status: 400 }
      );
    }

    await prisma.product.delete({ where: { id } });

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "DELETE_PRODUCT",
      entity: "PRODUCT",
      entityId: id,
    });

    return NextResponse.json({ success: true, message: "Produk berhasil dihapus." });
  } catch (error) {
    console.error("Failed to delete product:", error);
    return NextResponse.json({ error: "Gagal menghapus produk." }, { status: 500 });
  }
}
