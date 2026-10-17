"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { formatRupiah, formatNumber } from "@/lib/format";
import {
  TrendingUp,
  Receipt,
  ShoppingBag,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  Package,
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string;
    name: string;
    role: "ADMIN" | "KASIR" | "PETUGAS_STOK";
  } | null>(null);

  const [dashboardData, setDashboardData] = useState<{
    summary: {
      revenueToday: number;
      transactionsToday: number;
      averageOrderValue: number;
      grossProfitToday: number;
      paymentMethods: Record<string, number>;
    };
    topProducts: { name: string; quantity: number; revenue: number }[];
    lowStockItems: {
      id: string;
      name: string;
      sku: string;
      category: string;
      unit: string;
      quantity: number;
      minStock: number;
      status: string;
    }[];
  } | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) window.location.href = "/login";
        return res.json();
      })
      .then((data) => {
        if (data.user) {
          if (data.user.role === "KASIR") {
            window.location.href = "/pos";
            return;
          }
          setCurrentUser(data.user);
        }
      })
      .catch(() => {
        window.location.href = "/login";
      });

    fetch("/api/reports/dashboard")
      .then((res) => res.json())
      .then((data) => {
        setDashboardData(data);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
      });
  }, []);

  if (loading || !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
        <p className="animate-pulse">Memuat data Dashboard...</p>
      </div>
    );
  }

  const { summary, topProducts, lowStockItems } = dashboardData || {
    summary: { revenueToday: 0, transactionsToday: 0, averageOrderValue: 0, grossProfitToday: 0, paymentMethods: {} },
    topProducts: [],
    lowStockItems: [],
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      <Sidebar user={currentUser} />

      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Top Header */}
        <header className="p-6 bg-white border-b border-slate-200 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Dashboard Operasional
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Pantau performa penjualan, laba kotor, dan persediaan alat jahit hari ini.
            </p>
          </div>

          <Link
            href="/pos"
            className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs rounded-xl shadow-md flex items-center space-x-2 transition-all"
          >
            <span>Buka Kasir POS</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </header>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* 4 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Omzet Hari Ini */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Omzet Hari Ini</p>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {formatRupiah(summary.revenueToday)}
                </h3>
              </div>
            </div>

            {/* Transaksi Hari Ini */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Jumlah Transaksi</p>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {summary.transactionsToday} <span className="text-xs font-normal text-slate-400">nota</span>
                </h3>
              </div>
            </div>

            {/* Rata-rata Belanja */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Rata-rata Nota</p>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {formatRupiah(summary.averageOrderValue)}
                </h3>
              </div>
            </div>

            {/* Estimasi Laba Kotor */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Estimasi Laba Kotor</p>
                <h3 className="text-lg font-bold text-purple-700 mt-0.5">
                  {formatRupiah(summary.grossProfitToday)}
                </h3>
              </div>
            </div>
          </div>

          {/* 2 Columns: Top Products & Low Stock Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Products */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <Package className="w-4 h-4 text-brand-600" />
                  Produk Terlaris
                </h3>
                <Link href="/reports" className="text-xs text-brand-600 hover:underline font-medium">
                  Lihat Semua
                </Link>
              </div>

              {topProducts.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-400">
                  <Package className="w-10 h-10 stroke-[1.5] opacity-40 mb-2" />
                  <p className="text-xs">Belum ada data penjualan tercatat hari ini.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {topProducts.map((p, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-xs text-slate-900">{p.name}</p>
                          <p className="text-[11px] text-slate-500">{formatNumber(p.quantity)} terjual</p>
                        </div>
                      </div>
                      <span className="font-bold text-xs text-slate-900">
                        {formatRupiah(p.revenue)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Low Stock Alerts */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Peringatan Stok Menipis & Habis
                </h3>
                <Link href="/inventory" className="text-xs text-brand-600 hover:underline font-medium">
                  Kelola Stok
                </Link>
              </div>

              {lowStockItems.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-400">
                  <Package className="w-10 h-10 stroke-[1.5] opacity-40 mb-2" />
                  <p className="text-xs text-emerald-600 font-medium">Semua stok barang berada pada level aman!</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {lowStockItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50"
                    >
                      <div>
                        <p className="font-semibold text-xs text-slate-900">{item.name}</p>
                        <p className="text-[10px] text-slate-400">SKU: {item.sku} • {item.category}</p>
                      </div>

                      <div className="text-right flex items-center space-x-2">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            item.status === "HABIS"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {item.status}: {formatNumber(item.quantity)} {item.unit}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
