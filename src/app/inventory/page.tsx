"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { formatNumber, formatDate } from "@/lib/format";
import {
  Boxes,
  ClipboardCheck,
  History,
  AlertTriangle,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  category: string;
  unit: string;
  currentStock: number;
  minStock: number;
  stockStatus: "AMAN" | "MENIPIS" | "HABIS";
  allowDecimal: boolean;
}

interface Movement {
  id: string;
  movementType: string;
  quantity: number;
  previousStock: number;
  resultingStock: number;
  reason?: string | null;
  createdAt: string;
  product: {
    name: string;
    unit: { name: string };
  };
  user?: { name: string } | null;
}

export default function InventoryPage() {
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string;
    name: string;
    role: "ADMIN" | "KASIR" | "PETUGAS_STOK";
  } | null>(null);

  const [activeTab, setActiveTab] = useState<"STOCK" | "MOVEMENTS">("STOCK");
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [search, setSearch] = useState("");
  const [filterLow, setFilterLow] = useState(false);

  // Stock Opname modal state
  const [isOpnameModalOpen, setIsOpnameModalOpen] = useState(false);
  const [opnameSelectedProduct, setOpnameSelectedProduct] = useState<InventoryItem | null>(null);
  const [physicalCount, setPhysicalCount] = useState<number>(0);
  const [opnameReason, setOpnameReason] = useState("");
  const [opnameLoading, setOpnameLoading] = useState(false);
  const [opnameMsg, setOpnameMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

    loadInventory();
    loadMovements();
  }, []);

  const loadInventory = async () => {
    try {
      const res = await fetch("/api/inventory");
      const data = await res.json();
      if (data.inventory) setInventoryList(data.inventory);
    } catch (e) {
      console.error(e);
    }
  };

  const loadMovements = async () => {
    try {
      const res = await fetch("/api/inventory/movements");
      const data = await res.json();
      if (data.movements) setMovements(data.movements);
    } catch (e) {
      console.error(e);
    }
  };

  const filteredInventory = inventoryList.filter((item) => {
    const matchSearch =
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase());
    const matchLow = filterLow ? item.stockStatus !== "AMAN" : true;
    return matchSearch && matchLow;
  });

  const openOpnameModal = (item: InventoryItem) => {
    setOpnameSelectedProduct(item);
    setPhysicalCount(item.currentStock);
    setOpnameReason("");
    setOpnameMsg(null);
    setIsOpnameModalOpen(true);
  };

  const handleSaveOpname = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opnameSelectedProduct) return;

    if (!opnameReason.trim()) {
      setOpnameMsg({ type: "error", text: "Alasan penyesuaian stok opname wajib diisi." });
      return;
    }

    setOpnameLoading(true);
    setOpnameMsg(null);

    try {
      const res = await fetch("/api/inventory/opname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              productId: opnameSelectedProduct.id,
              physicalStock: physicalCount,
              reason: opnameReason,
            },
          ],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setOpnameMsg({ type: "error", text: data.error || "Gagal memproses stok opname." });
        setOpnameLoading(false);
        return;
      }

      setOpnameMsg({ type: "success", text: "Stok opname berhasil disimpan dan diperbarui!" });
      loadInventory();
      loadMovements();
      setTimeout(() => {
        setIsOpnameModalOpen(false);
      }, 1000);
    } catch {
      setOpnameMsg({ type: "error", text: "Terjadi kesalahan koneksi." });
    } finally {
      setOpnameLoading(false);
    }
  };

  if (!currentUser) return null;
  const canOpname = currentUser.role === "ADMIN" || currentUser.role === "PETUGAS_STOK";

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      <Sidebar user={currentUser} />

      <main className="flex-1 flex flex-col overflow-y-auto">
        <header className="p-6 bg-white border-b border-slate-200 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Boxes className="w-6 h-6 text-brand-600" />
              Persediaan & Mutasi Stok
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Pantau jumlah stok real-time, lakukan stok opname fisik, dan audit riwayat pergerakan barang.
            </p>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("STOCK")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "STOCK"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>Stok Saat Ini</span>
            </button>
            <button
              onClick={() => setActiveTab("MOVEMENTS")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "MOVEMENTS"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Riwayat Mutasi</span>
            </button>
          </div>
        </header>

        <div className="p-6 space-y-4">
          {activeTab === "STOCK" && (
            <>
              {/* Filter and Search */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari persediaan produk berdasarkan nama atau SKU..."
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <button
                  onClick={() => setFilterLow(!filterLow)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                    filterLow
                      ? "bg-amber-500 text-white shadow-sm"
                      : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Hanya Stok Menipis/Habis</span>
                </button>
              </div>

              {/* Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Nama Produk & SKU</th>
                      <th className="py-3 px-4">Kategori</th>
                      <th className="py-3 px-4">Stok Saat Ini</th>
                      <th className="py-3 px-4">Batas Min</th>
                      <th className="py-3 px-4">Status Stok</th>
                      {canOpname && <th className="py-3 px-4 text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInventory.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900">{item.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">SKU: {item.sku}</p>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{item.category}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`font-extrabold text-sm ${
                              item.stockStatus === "HABIS"
                                ? "text-rose-600"
                                : item.stockStatus === "MENIPIS"
                                ? "text-amber-600"
                                : "text-slate-800"
                            }`}
                          >
                            {formatNumber(item.currentStock)} {item.unit}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {item.minStock} {item.unit}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.stockStatus === "HABIS"
                                ? "bg-rose-100 text-rose-800"
                                : item.stockStatus === "MENIPIS"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {item.stockStatus}
                          </span>
                        </td>
                        {canOpname && (
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => openOpnameModal(item)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                            >
                              <ClipboardCheck className="w-3.5 h-3.5 text-brand-600" />
                              <span>Stok Opname</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeTab === "MOVEMENTS" && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Waktu</th>
                    <th className="py-3 px-4">Produk</th>
                    <th className="py-3 px-4">Jenis Mutasi</th>
                    <th className="py-3 px-4">Perubahan (Delta)</th>
                    <th className="py-3 px-4">Stok Akhir</th>
                    <th className="py-3 px-4">Alasan & Catatan</th>
                    <th className="py-3 px-4">Operator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Belum ada riwayat mutasi stok tercatat.
                      </td>
                    </tr>
                  ) : (
                    movements.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {formatDate(m.createdAt)}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {m.product.name}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-700">
                            {m.movementType}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`font-bold ${
                              m.quantity > 0
                                ? "text-emerald-600"
                                : m.quantity < 0
                                ? "text-rose-600"
                                : "text-slate-500"
                            }`}
                          >
                            {m.quantity > 0 ? `+${m.quantity}` : m.quantity} {m.product.unit.name}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {m.resultingStock} {m.product.unit.name}
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                          {m.reason || "-"}
                        </td>
                        <td className="py-3 px-4 text-slate-500">{m.user?.name || "Sistem"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Stock Opname Modal */}
      {isOpnameModalOpen && opnameSelectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-brand-600" />
                Penyesuaian Fisik (Stok Opname)
              </h3>
              <button
                onClick={() => setIsOpnameModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOpname} className="p-6 space-y-4">
              {opnameMsg && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    opnameMsg.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-rose-50 text-rose-800 border border-rose-200"
                  }`}
                >
                  {opnameMsg.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{opnameMsg.text}</span>
                </div>
              )}

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <p className="font-bold text-xs text-slate-900">{opnameSelectedProduct.name}</p>
                <p className="text-[10px] text-slate-500">
                  SKU: {opnameSelectedProduct.sku} • Satuan: {opnameSelectedProduct.unit}
                </p>
                <div className="flex justify-between pt-2 border-t border-slate-200 text-xs font-semibold">
                  <span>Stok di Sistem Saat Ini:</span>
                  <span className="text-brand-600 font-bold">
                    {formatNumber(opnameSelectedProduct.currentStock)}{" "}
                    {opnameSelectedProduct.unit}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Hasil Hitung Fisik Sebenarnya ({opnameSelectedProduct.unit}) *
                </label>
                <input
                  type="number"
                  step={opnameSelectedProduct.allowDecimal ? "0.1" : "1"}
                  required
                  value={physicalCount}
                  onChange={(e) => setPhysicalCount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Difference Calculation */}
              <div className="flex justify-between items-center text-xs p-2.5 bg-slate-100 rounded-xl font-medium">
                <span>Selisih Penyesuaian:</span>
                <span
                  className={`font-bold ${
                    physicalCount - opnameSelectedProduct.currentStock > 0
                      ? "text-emerald-700"
                      : physicalCount - opnameSelectedProduct.currentStock < 0
                      ? "text-rose-700"
                      : "text-slate-600"
                  }`}
                >
                  {physicalCount - opnameSelectedProduct.currentStock > 0 ? "+" : ""}
                  {formatNumber(physicalCount - opnameSelectedProduct.currentStock)}{" "}
                  {opnameSelectedProduct.unit}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alasan Penyesuaian *
                </label>
                <textarea
                  required
                  rows={2}
                  value={opnameReason}
                  onChange={(e) => setOpnameReason(e.target.value)}
                  placeholder="Contoh: Selisih hitung fisik bulanan / Barang rusak tercecer..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsOpnameModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={opnameLoading}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  {opnameLoading ? "Menyimpan..." : "Simpan Penyesuaian"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
