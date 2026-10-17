import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role === "KASIR") {
      return NextResponse.json({ error: "Forbidden: Kasir tidak memiliki akses laporan penjualan." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const cashierId = searchParams.get("cashierId");

    // Acceptance Test 9: Only transactions in range are calculated
    const dateFilter: Record<string, unknown> = {};
    if (startDateParam) {
      dateFilter.gte = new Date(startDateParam);
    } else {
      // Default to last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);
      dateFilter.gte = thirtyDaysAgo;
    }

    if (endDateParam) {
      const end = new Date(endDateParam);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    const whereSales: Record<string, unknown> = {
      date: dateFilter,
    };
    if (cashierId) {
      whereSales.cashierId = cashierId;
    }

    const allSales = await prisma.sale.findMany({
      where: whereSales,
      include: {
        items: {
          include: {
            product: { include: { category: true } },
          },
        },
        payments: true,
        returns: { include: { items: true } },
      },
      orderBy: { date: "asc" },
    });

    // Separate active completed vs cancelled sales
    const validSales = allSales.filter((s) => s.status !== "CANCELLED");
    const cancelledSales = allSales.filter((s) => s.status === "CANCELLED");

    let grossSales = 0;
    let totalDiscount = 0;
    let netSales = 0;
    let totalCogs = 0;
    let totalRefunds = 0;

    const cashierBreakdown: Record<string, { cashierName: string; count: number; total: number }> = {};
    const categoryBreakdown: Record<string, { count: number; revenue: number }> = {};
    const productBreakdown: Record<string, { name: string; quantity: number; revenue: number; cogs: number }> = {};
    const tierBreakdown: Record<string, { quantity: number; revenue: number }> = {
      Eceran: { quantity: 0, revenue: 0 },
      Grosir: { quantity: 0, revenue: 0 },
    };

    for (const sale of validSales) {
      grossSales += sale.subtotal;
      totalDiscount += sale.discount;
      netSales += sale.totalAmount;

      // Cashier
      if (!cashierBreakdown[sale.cashierId]) {
        cashierBreakdown[sale.cashierId] = {
          cashierName: sale.cashierName,
          count: 0,
          total: 0,
        };
      }
      cashierBreakdown[sale.cashierId].count += 1;
      cashierBreakdown[sale.cashierId].total += sale.totalAmount;

      // Returns refund for this sale
      for (const ret of sale.returns) {
        totalRefunds += ret.totalRefund;
      }

      // Items
      for (const item of sale.items) {
        const itemCogs = (item.costPrice || 0) * item.quantity;
        totalCogs += itemCogs;

        // Category
        const catName = item.product?.category?.name || "Lainnya";
        if (!categoryBreakdown[catName]) {
          categoryBreakdown[catName] = { count: 0, revenue: 0 };
        }
        categoryBreakdown[catName].count += item.quantity;
        categoryBreakdown[catName].revenue += item.subtotal;

        // Product
        if (!productBreakdown[item.productName]) {
          productBreakdown[item.productName] = {
            name: item.productName,
            quantity: 0,
            revenue: 0,
            cogs: 0,
          };
        }
        productBreakdown[item.productName].quantity += item.quantity;
        productBreakdown[item.productName].revenue += item.subtotal;
        productBreakdown[item.productName].cogs += itemCogs;

        // Wholesale vs Retail breakdown
        const isWholesale = item.tierUsed && item.tierUsed.toLowerCase().includes("grosir");
        const bucket = isWholesale ? "Grosir" : "Eceran";
        tierBreakdown[bucket].quantity += item.quantity;
        tierBreakdown[bucket].revenue += item.subtotal;
      }
    }

    // Formula: Gross Profit = Net Revenue (after refunds) - COGS
    const adjustedNetSales = netSales - totalRefunds;
    const grossProfit = adjustedNetSales - totalCogs;

    return NextResponse.json({
      period: {
        startDate: startDateParam || null,
        endDate: endDateParam || null,
      },
      summary: {
        totalTransactions: validSales.length,
        cancelledTransactions: cancelledSales.length,
        grossSales,
        totalDiscount,
        netSales: adjustedNetSales,
        totalRefunds,
        totalCogs,
        grossProfit,
      },
      cashierBreakdown: Object.values(cashierBreakdown),
      categoryBreakdown: Object.entries(categoryBreakdown).map(([name, data]) => ({ name, ...data })),
      productBreakdown: Object.values(productBreakdown).sort((a, b) => b.revenue - a.revenue),
      tierBreakdown,
      transactions: allSales.map((s) => ({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        date: s.date,
        cashierName: s.cashierName,
        customerName: s.customerName,
        itemCount: s.items.length,
        totalAmount: s.totalAmount,
        paymentMethod: s.paymentMethod,
        status: s.status,
        cancelReason: s.cancelReason,
      })),
    });
  } catch (error) {
    console.error("Sales report error:", error);
    return NextResponse.json({ error: "Gagal menyusun laporan penjualan." }, { status: 500 });
  }
}
