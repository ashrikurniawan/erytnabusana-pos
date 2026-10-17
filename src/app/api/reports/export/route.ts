import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role === "KASIR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const dateFilter: Record<string, unknown> = {};
    if (startDateParam) dateFilter.gte = new Date(startDateParam);
    if (endDateParam) {
      const end = new Date(endDateParam);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    const sales = await prisma.sale.findMany({
      where: Object.keys(dateFilter).length > 0 ? { date: dateFilter } : undefined,
      include: { items: true },
      orderBy: { date: "desc" },
    });

    // Generate CSV lines
    const headers = [
      "No. Nota",
      "Tanggal",
      "Kasir",
      "Pelanggan",
      "Status",
      "Item Produk",
      "Kuantitas",
      "Harga Satuan (IDR)",
      "Subtotal (IDR)",
      "Metode Pembayaran",
      "Total Belanja (IDR)",
    ];

    const rows: string[] = [];
    rows.push(headers.join(","));

    for (const s of sales) {
      const dateStr = new Date(s.date).toISOString().replace("T", " ").substring(0, 19);
      for (const it of s.items) {
        const row = [
          `"${s.invoiceNumber}"`,
          `"${dateStr}"`,
          `"${s.cashierName}"`,
          `"${s.customerName}"`,
          `"${s.status}"`,
          `"${it.productName.replace(/"/g, '""')}"`,
          it.quantity,
          it.unitPrice,
          it.subtotal,
          `"${s.paymentMethod}"`,
          s.totalAmount,
        ];
        rows.push(row.join(","));
      }
    }

    const csvContent = rows.join("\r\n");

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="laporan_penjualan_erytnabusana_${new Date().toISOString().substring(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Gagal mengekspor laporan CSV." }, { status: 500 });
  }
}
