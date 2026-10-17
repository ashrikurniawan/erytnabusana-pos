import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const settings = await prisma.storeSetting.findUnique({
      where: { id: "default" },
    });
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Failed to load settings:", error);
    return NextResponse.json({ error: "Gagal memuat pengaturan toko." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Hanya Admin yang dapat mengubah pengaturan toko." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { storeName, tagline, phone, address, receiptHeader, receiptFooter, allowNegativeStock } = body;

    const updated = await prisma.storeSetting.upsert({
      where: { id: "default" },
      update: {
        storeName: storeName?.trim() || "ErytnaBusana",
        tagline: tagline?.trim() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        receiptHeader: receiptHeader?.trim() || null,
        receiptFooter: receiptFooter?.trim() || null,
        allowNegativeStock: !!allowNegativeStock,
      },
      create: {
        id: "default",
        storeName: storeName?.trim() || "ErytnaBusana",
        tagline: tagline?.trim() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        receiptHeader: receiptHeader?.trim() || null,
        receiptFooter: receiptFooter?.trim() || null,
        allowNegativeStock: !!allowNegativeStock,
      },
    });

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "UPDATE_SETTINGS",
      entity: "SETTING",
      entityId: "default",
      details: { storeName: updated.storeName, allowNegativeStock: updated.allowNegativeStock },
    });

    return NextResponse.json({
      success: true,
      settings: updated,
      message: "Pengaturan toko berhasil diperbarui.",
    });
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json({ error: "Gagal menyimpan pengaturan toko." }, { status: 500 });
  }
}
