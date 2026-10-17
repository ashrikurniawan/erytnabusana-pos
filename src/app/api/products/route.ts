import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const categoryId = searchParams.get("categoryId") || "";
    const activeOnly = searchParams.get("activeOnly") === "true";

    const whereClause: Record<string, unknown> = {};

    if (activeOnly) {
      whereClause.isActive = true;
    }

    if (categoryId) {
      whereClause.categoryId = categoryId;
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
        { brand: { contains: search } },
      ];
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        category: true,
        unit: true,
        inventory: true,
        priceTiers: {
          orderBy: { minQty: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    // Security check: Kasir cannot see cost price (Acceptance Test 7)
    const sanitizedProducts = products.map((p) => {
      if (user.role === "KASIR") {
        return {
          ...p,
          costPrice: 0, // Masked from cashier
        };
      }
      return p;
    });

    return NextResponse.json({ products: sanitizedProducts });
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return NextResponse.json({ error: "Gagal memuat produk." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role === "KASIR") {
      return NextResponse.json(
        { error: "Forbidden: Kasir tidak memiliki akses membuat produk." },
        { status: 403 }
      );
    }

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
      initialStock,
      allowDecimal,
      priceTiers,
    } = body;

    if (!name || !sku || !categoryId || !unitId) {
      return NextResponse.json(
        { error: "Nama produk, SKU, kategori, dan satuan wajib diisi." },
        { status: 400 }
      );
    }

    // Check SKU uniqueness
    const existingSku = await prisma.product.findUnique({
      where: { sku: sku.trim() },
    });
    if (existingSku) {
      return NextResponse.json(
        { error: `SKU "${sku}" sudah digunakan oleh produk lain.` },
        { status: 400 }
      );
    }

    const parsedCost = parseFloat(costPrice) || 0;
    const parsedRetail = parseFloat(retailPrice) || 0;
    const parsedMinStock = parseFloat(minStock) || 0;
    const parsedInitialStock = parseFloat(initialStock) || 0;

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name: name.trim(),
          sku: sku.trim(),
          barcode: barcode ? barcode.trim() : null,
          categoryId,
          unitId,
          brand: brand ? brand.trim() : null,
          description: description ? description.trim() : null,
          costPrice: parsedCost,
          retailPrice: parsedRetail,
          minStock: parsedMinStock,
          allowDecimal: !!allowDecimal,
          inventory: {
            create: {
              quantity: parsedInitialStock,
              minStock: parsedMinStock,
            },
          },
        },
      });

      // Create Price Tiers
      if (Array.isArray(priceTiers) && priceTiers.length > 0) {
        for (const tier of priceTiers) {
          if (tier.minQty && tier.price) {
            await tx.priceTier.create({
              data: {
                productId: created.id,
                minQty: parseFloat(tier.minQty),
                maxQty: tier.maxQty ? parseFloat(tier.maxQty) : null,
                price: parseFloat(tier.price),
                tierName: tier.tierName || null,
              },
            });
          }
        }
      }

      // Record initial inventory movement if stock > 0
      if (parsedInitialStock > 0) {
        await tx.inventoryMovement.create({
          data: {
            productId: created.id,
            movementType: "INITIAL",
            quantity: parsedInitialStock,
            previousStock: 0,
            resultingStock: parsedInitialStock,
            reason: "Stok awal produk baru",
            userId: user.id,
          },
        });
      }

      return created;
    });

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "CREATE_PRODUCT",
      entity: "PRODUCT",
      entityId: product.id,
      details: { name: product.name, sku: product.sku },
    });

    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error) {
    console.error("Failed to create product:", error);
    return NextResponse.json({ error: "Gagal menyimpan produk." }, { status: 500 });
  }
}
