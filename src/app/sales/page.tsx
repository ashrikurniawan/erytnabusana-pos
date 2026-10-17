"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import ReceiptModal, { ReceiptSaleData } from "@/components/ReceiptModal";
import { formatRupiah, formatDate } from "@/lib/format";
import {
  Receipt,
  Search,
  Eye,
  Printer,
  Ban,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";

interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  unitName: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  subtotal: number;
  tierUsed?: string | null;
}

interface Sale {
  id: string;
  invoiceNumber: string;
  date: string;
  customerName: string;
  cashierName: string;
  subtotal: number;
  discount: number;
  totalAmount: number;
  paymentMethod: string;
  status: "COMPLETED" | "CANCELLED" | "PARTIALLY_RETURNED" | "RETURNED";
  cancelReason?: string | null;
  items: SaleItem[];
  payments: {
    method: string;
    amountPaid: number;
    amountTendered: number;
    changeAmount: number;
  }[];
}

export default function SalesPage() {
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string;
    name: string;
    role: "ADMIN" | "KASIR" | "PETUGAS_STOK";
  } | null>(null);

  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Void Modal State
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voidLoading, setVoidLoading] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  // Receipt Modal State
  const [receiptSale, setReceiptSale] = useState<ReceiptSaleData | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [storeSettings, setStoreSettings] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) window.location.href = "/login";
        return res.json();
      })
      .then((data) => {
        if (data.user) setCurrentUser(data.user);
      })
      .catch(() => {
        window.location.href = "/login";
      });

    loadSales();
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) setStoreSettings(d.settings);
      })
      .catch(console.error);
  }, []);

  const loadSales = async () => {
    try {
      const res = await fetch("/api/sales");
      const data = await res.json();
      if (data.sales) setSales(data.sales);
    } catch (e) {
      console.error(e);
    }
  };

  const filteredSales = sales.filter((s) => {
    const matchStatus = statusFilter === "ALL" || s.status === statusFilter;
    const q = search.toLowerCase().trim();
    const matchSearch =
      !q ||
      s.invoiceNumber.toLowerCase().includes(q) ||
      s.customerName.toLowerCase().includes(q) ||
      s.cashierName.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const openDetail = (s: Sale) => {
    setSelectedSale(s);
    setIsDetailModalOpen(true);
  };

  const openReceipt = (s: Sale) => {
    setReceiptSale(s);
    setIsReceiptOpen(true);
  };

  const openVoidModal = (s: Sale) => {
    setSelectedSale(s);
    setVoidReason("");
    setVoidError(null);
    setIsVoidModalOpen(true);
  };

  const handleConfirmVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSale) return;
    if (!voidReason.trim()) {
      setVoidError("Alasan pembatalan transaksi wajib diisi.");
      return;
    }

    setVoidLoading(true);
    setVoidError(null);

    try {
      const res = await fetch(`/api/sales/${selectedSale.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: voidReason, restoreStock: true }),
      });

      const data = await res.json();
      if (!res.ok) {
        setVoidError(data.error || "Gagal membatalkan transaksi.");
        setVoidLoading(false);
        return;
      }

      alert("Transaksi berhasil dibatalkan dan stok telah dikembalikan.");
      setIsVoidModalOpen(false);
      setIsDetailModalOpen(false);
      loadSales();
    } catch {
      setVoidError("Terjadi kesalahan jaringan.");
    } finally {
      setVoidLoading(false);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      <Sidebar user={currentUser} />

      <main className="flex-1 flex flex-col overflow-y-auto">
        <header className="p-6 bg-white border-b border-slate-200 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Receipt className="w-6 h-6 text-brand-600" />
              Riwayat Transaksi Penjualan
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Daftar seluruh nota penjualan, cetak ulang struk, dan pembatalan transaksi kasir.
            </p>
          </div>
        </header>

        <div className="p-6 space-y-4">
          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nota, nama pelanggan, atau nama kasir..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700"
            >
              <option value="ALL">Semua Status</option>
              <option value="COMPLETED">Selesai (Lunas)</option>
              <option value="CANCELLED">Dibatalkan (Void)</option>
              <option value="PARTIALLY_RETURNED">Retur Sebagian</option>
              <option value="RETURNED">Retur Penuh</option>
            </select>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">No. Nota</th>
                  <th className="py-3 px-4">Waktu Transaksi</th>
                  <th className="py-3 px-4">Kasir</th>
                  <th className="py-3 px-4">Pelanggan</th>
                  <th className="py-3 px-4">Metode Bayar</th>
                  <th className="py-3 px-4">Total Belanja</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Tidak ada transaksi ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                        {s.invoiceNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{formatDate(s.date)}</td>
                      <td className="py-3 px-4 font-medium text-slate-700">{s.cashierName}</td>
                      <td className="py-3 px-4 text-slate-600">{s.customerName}</td>
                      <td className="py-3 px-4 font-medium">{s.paymentMethod}</td>
                      <td className="py-3 px-4 font-bold text-brand-600">
                        {formatRupiah(s.totalAmount)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.status === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-800"
                              : s.status === "CANCELLED"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {s.status === "COMPLETED"
                            ? "Selesai"
                            : s.status === "CANCELLED"
                            ? "Dibatalkan"
                            : s.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => openDetail(s)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-brand-600 hover:bg-slate-100 transition-colors"
                            title="Detail Transaksi"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openReceipt(s)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-brand-600 hover:bg-slate-100 transition-colors"
                            title="Cetak Struk Ulang"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          {currentUser.role === "ADMIN" && s.status === "COMPLETED" && (
                            <button
                              onClick={() => openVoidModal(s)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Batalkan Transaksi (Void)"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Transaction Detail Modal */}
      {isDetailModalOpen && selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Rincian Nota #{selectedSale.invoiceNumber}
                </h3>
                <p className="text-[11px] text-slate-500">{formatDate(selectedSale.date)}</p>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {selectedSale.status === "CANCELLED" && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <Ban className="w-4 h-4 text-rose-600" />
                    Transaksi Ini Telah Dibatalkan (Void)
                  </p>
                  <p className="text-[11px]">Alasan: {selectedSale.cancelReason || "-"}</p>
                </div>
              )}

              {/* Items */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700">Daftar Barang Terjual:</h4>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl p-2 bg-slate-50">
                  {selectedSale.items.map((it) => (
                    <div key={it.id} className="py-2 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-semibold text-slate-900">{it.productName}</p>
                        <p className="text-[10px] text-slate-500">
                          {it.quantity} {it.unitName} × {formatRupiah(it.unitPrice)}
                          {it.tierUsed && it.tierUsed !== "Eceran" && (
                            <span className="ml-1 bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-semibold">
                              {it.tierUsed}
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="font-bold text-slate-800">
                        {formatRupiah(it.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="space-y-1 text-xs pt-2 border-t border-slate-200">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>{formatRupiah(selectedSale.subtotal)}</span>
                </div>
                {selectedSale.discount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Diskon:</span>
                    <span>-{formatRupiah(selectedSale.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-1 border-t border-slate-200">
                  <span>Total Belanja:</span>
                  <span className="text-brand-600">{formatRupiah(selectedSale.totalAmount)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                {currentUser.role === "ADMIN" && selectedSale.status === "COMPLETED" && (
                  <button
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      openVoidModal(selectedSale);
                    }}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Batalkan Transaksi (Void)</span>
                  </button>
                )}

                <button
                  onClick={() => openReceipt(selectedSale)}
                  className="ml-auto px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Struk</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Void Modal */}
      {isVoidModalOpen && selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-rose-50 text-rose-900">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Ban className="w-5 h-5 text-rose-600" />
                Konfirmasi Pembatalan Nota #{selectedSale.invoiceNumber}
              </h3>
              <button
                onClick={() => setIsVoidModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmVoid} className="p-6 space-y-4">
              {voidError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{voidError}</span>
                </div>
              )}

              <p className="text-xs text-slate-600">
                Pembatalan transaksi ini tidak akan menghapus data penjualan dari riwayat, tetapi akan
                menandai status sebagai <strong>BATAL (CANCELLED)</strong> dan mengembalikan seluruh
                stok barang terjual ke persediaan toko.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alasan Pembatalan Transaksi *
                </label>
                <textarea
                  required
                  rows={3}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Contoh: Salah input pesanan / pelanggan membatalkan pembelian..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsVoidModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={voidLoading}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  {voidLoading ? "Memproses..." : "Ya, Batalkan Transaksi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        sale={receiptSale}
        storeSettings={storeSettings}
      />
    </div>
  );
}
