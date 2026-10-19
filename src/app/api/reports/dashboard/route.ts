import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // Sales today (excluding CANCELLED)
    const salesToday = await prisma.sale.findMany({
      where: {
        date: { gte: startOfToday, lte: endOfToday },
        status: { not: "CANCELLED" },
      },
      include: {
        items: true,
        payments: true,
      },
    });

    const totalRevenueToday = salesToday.reduce((sum, s) => sum + s.totalAmount, 0);
    const transactionCountToday = salesToday.length;
    const averageOrderValue = transactionCountToday > 0 ? Math.round(totalRevenueToday / transactionCountToday) : 0;

    // Gross Profit calculation today: Net Revenue - COGS
    let totalCogsToday = 0;
    for (const s of salesToday) {
      for (const it of s.items) {
        totalCogsToday += (it.costPrice || 0) * it.quantity;
      }
    }
    const estimatedGrossProfitToday = totalRevenueToday - totalCogsToday;

    // Payment method breakdown today
    const paymentMethodsToday: Record<string, number> = {};
    for (const s of salesToday) {
      paymentMethodsToday[s.paymentMethod] = (paymentMethodsToday[s.paymentMethod] || 0) + s.totalAmount;
    }

    // Top selling products all-time / recent 30 days
    const recentCompletedSaleItems = await prisma.saleItem.findMany({
      where: {
        sale: { status: { not: "CANCELLED" } },
      },
      select: {
        productName: true,
        quantity: true,
        subtotal: true,
      },
    });

    const productSalesMap: Record<string, { quantity: number; revenue: number }> = {};
    for (const it of recentCompletedSaleItems) {
      if (!productSalesMap[it.productName]) {
        productSalesMap[it.productName] = { quantity: 0, revenue: 0 };
      }
      productSalesMap[it.productName].quantity += it.quantity;
      productSalesMap[it.productName].revenue += it.subtotal;
    }

    const topProducts = Object.entries(productSalesMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // Last 7 days revenue breakdown
    const last7Days: { date: string; revenue: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date();
      dayEnd.setDate(dayEnd.getDate() - i);
      dayEnd.setHours(23, 59, 59, 999);

      const daySales = await prisma.sale.findMany({
        where: {
          date: { gte: dayStart, lte: dayEnd },
          status: { not: "CANCELLED" },
        },
        select: { totalAmount: true },
      });

      const dayRevenue = daySales.reduce((sum, s) => sum + s.totalAmount, 0);
      const label = dayStart.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
      last7Days.push({ date: label, revenue: dayRevenue });
    }

    // Low stock items (currentStock <= minStock)
    const productsWithStock = await prisma.product.findMany({
      where: { isActive: true },
      include: { inventory: true, unit: true, category: true },
    });

    const lowStockItems = productsWithStock
      .filter((p) => {
        const qty = p.inventory?.quantity ?? 0;
        return qty <= p.minStock;
      })
      .map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category.name,
        unit: p.unit.name,
        quantity: p.inventory?.quantity ?? 0,
        minStock: p.minStock,
        status: (p.inventory?.quantity ?? 0) <= 0 ? "HABIS" : "MENIPIS",
      }))
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 10);

    return NextResponse.json({
      summary: {
        revenueToday: totalRevenueToday,
        transactionsToday: transactionCountToday,
        averageOrderValue,
        grossProfitToday: user.role === "KASIR" ? 0 : estimatedGrossProfitToday,
        paymentMethods: paymentMethodsToday,
      },
      topProducts,
      lowStockItems,
      last7Days,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json({ error: "Gagal memuat data dashboard." }, { status: 500 });
  }
}
