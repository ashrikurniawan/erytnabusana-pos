"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { formatRupiah, formatNumber, formatDate } from "@/lib/format";
import {
  BarChart3,
  Calendar,
  Download,
  DollarSign,
  TrendingUp,
  Receipt,
  UserCheck,
  Tag,
  Package,
} from "lucide-react";

interface ReportData {
  summary: {
    totalTransactions: number;
    cancelledTransactions: number;
    grossSales: number;
    totalDiscount: number;
    netSales: number;
    totalRefunds: number;
    totalCogs: number;
    grossProfit: number;
  };
  cashierBreakdown: { cashierName: string; count: number; total: number }[];
  categoryBreakdown: { name: string; count: number; revenue: number }[];
  productBreakdown: { name: string; quantity: number; revenue: number; cogs: number }[];
  tierBreakdown: {
    Eceran: { quantity: number; revenue: number };
    Grosir: { quantity: number; revenue: number };
  };
}

export default function ReportsPage() {
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string;
    name: string;
    role: "ADMIN" | "KASIR" | "PETUGAS_STOK";
  } | null>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) window.location.href = "/login";
        return res.json();
      })
      .then((data) => {
        if (data.user) {
          if (data.user.role !== "ADMIN") {
            window.location.href = "/pos";
            return;
          }
          setCurrentUser(data.user);
        }
      })
      .catch(() => {
        window.location.href = "/login";
      });

    loadReport();
  }, []);

  const loadReport = async (start = "", end = "") => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (start) params.set("startDate", start);
      if (end) params.set("endDate", end);

      const res = await fetch(`/api/reports/sales?${params.toString()}`);
      const data = await res.json();
      if (data.summary) {
        setReport(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    loadReport(startDate, endDate);
  };

  const setQuickPeriod = (type: "TODAY" | "7DAYS" | "THIS_MONTH") => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    if (type === "TODAY") {
      setStartDate(todayStr);
      setEndDate(todayStr);
      loadReport(todayStr, todayStr);
    } else if (type === "7DAYS") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      const startStr = d.toISOString().split("T")[0];
      setStartDate(startStr);
      setEndDate(todayStr);
      loadReport(startStr, todayStr);
    } else if (type === "THIS_MONTH") {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        .toISOString()
        .split("T")[0];
      setStartDate(startOfMonth);
      setEndDate(todayStr);
      loadReport(startOfMonth, todayStr);
    }
  };

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    window.open(`/api/reports/export?${params.toString()}`, "_blank");
  };

  if (!currentUser) return null;

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      <Sidebar user={currentUser} />

      <main className="flex-1 flex flex-col overflow-y-auto">
        <header className="p-6 bg-white border-b border-slate-200 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-brand-600" />
              Laporan Penjualan & Laba Kotor
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Analisis performa omzet toko, harga pokok penjualan (HPP), estimasi margin laba, dan ekspor CSV.
            </p>
          </div>

          <button
            onClick={handleExportCsv}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-md flex items-center space-x-2 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor Laporan (CSV)</span>
          </button>
        </header>

        <div className="p-6 space-y-6">
          {/* Date Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setQuickPeriod("TODAY")}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-colors"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => setQuickPeriod("7DAYS")}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-colors"
              >
                7 Hari Terakhir
              </button>
              <button
                type="button"
                onClick={() => setQuickPeriod("THIS_MONTH")}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-colors"
              >
                Bulan Ini
              </button>
            </div>

            <form onSubmit={handleApplyFilter} className="flex items-center space-x-2 text-xs">
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500 font-medium">Dari:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500 font-medium">Sampai:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <button
                type="submit"
                className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-bold shadow-sm"
              >
                Terapkan Filter
              </button>
            </form>
          </div>

          {loading || !report ? (
            <div className="py-20 text-center text-slate-400">
              <p className="animate-pulse">Menyusun laporan data...</p>
            </div>
          ) : (
            <>
              {/* Summary Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500">Pendapatan Bersih (Net Sales)</p>
                  <h3 className="text-xl font-extrabold text-brand-600 mt-1">
                    {formatRupiah(report.summary.netSales)}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Kotor: {formatRupiah(report.summary.grossSales)} • Diskon: -{formatRupiah(report.summary.totalDiscount)}
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500">Harga Pokok Penjualan (COGS)</p>
                  <h3 className="text-xl font-extrabold text-slate-700 mt-1">
                    {formatRupiah(report.summary.totalCogs)}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Total modal barang yang terjual
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-purple-200 bg-purple-50/20 shadow-sm">
                  <p className="text-xs font-semibold text-purple-700">Estimasi Laba Kotor</p>
                  <h3 className="text-xl font-extrabold text-purple-800 mt-1">
                    {formatRupiah(report.summary.grossProfit)}
                  </h3>
                  <p className="text-[10px] text-purple-600 mt-1">
                    Margin:{" "}
                    {report.summary.netSales > 0
                      ? `${Math.round((report.summary.grossProfit / report.summary.netSales) * 100)}%`
                      : "0%"}
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500">Transaksi Berhasil</p>
                  <h3 className="text-xl font-extrabold text-slate-900 mt-1">
                    {report.summary.totalTransactions}{" "}
                    <span className="text-xs font-normal text-slate-400">nota</span>
                  </h3>
                  <p className="text-[10px] text-rose-500 mt-1">
                    {report.summary.cancelledTransactions} transaksi dibatalkan (void)
                  </p>
                </div>
              </div>

              {/* 2 Grid: Cashier & Tier Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cashier Performance */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <h3 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-brand-600" />
                    Penjualan Berdasarkan Kasir
                  </h3>
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Nama Kasir</th>
                        <th className="py-2.5 px-3">Jumlah Nota</th>
                        <th className="py-2.5 px-3 text-right">Total Transaksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.cashierBreakdown.map((c, idx) => (
                        <tr key={idx}>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {c.cashierName}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{c.count} nota</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900 text-right">
                            {formatRupiah(c.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Wholesale vs Retail Breakdown */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <h3 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-amber-600" />
                    Perbandingan Penjualan Eceran vs Grosir
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-xs font-semibold text-slate-500 block">Penjualan Eceran</span>
                      <span className="text-lg font-bold text-slate-900 mt-1 block">
                        {formatRupiah(report.tierBreakdown.Eceran.revenue)}
                      </span>
                      <span className="text-[11px] text-slate-400 mt-1 block">
                        {formatNumber(report.tierBreakdown.Eceran.quantity)} unit terjual
                      </span>
                    </div>

                    <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200">
                      <span className="text-xs font-semibold text-amber-800 block">Penjualan Grosir</span>
                      <span className="text-lg font-bold text-amber-900 mt-1 block">
                        {formatRupiah(report.tierBreakdown.Grosir.revenue)}
                      </span>
                      <span className="text-[11px] text-amber-700 mt-1 block">
                        {formatNumber(report.tierBreakdown.Grosir.quantity)} unit grosir
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Product Breakdown Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <h3 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-brand-600" />
                  Rincian Penjualan per Produk & Estimasi Laba
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Nama Produk</th>
                        <th className="py-2.5 px-3">Kuantitas Terjual</th>
                        <th className="py-2.5 px-3">Total Omzet</th>
                        <th className="py-2.5 px-3">Total HPP Modal</th>
                        <th className="py-2.5 px-3 text-right">Laba Kotor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.productBreakdown.map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{p.name}</td>
                          <td className="py-2.5 px-3 text-slate-600">{formatNumber(p.quantity)}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {formatRupiah(p.revenue)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{formatRupiah(p.cogs)}</td>
                          <td className="py-2.5 px-3 font-bold text-emerald-700 text-right">
                            {formatRupiah(p.revenue - p.cogs)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
