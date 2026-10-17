"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { formatRupiah, formatDate } from "@/lib/format";
import {
  Truck,
  Plus,
  CheckCircle,
  Clock,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface PurchaseItem {
  id: string;
  quantity: number;
  unitCost: number;
  subtotal: number;
  product: {
    name: string;
    unit: { name: string };
  };
}

interface Purchase {
  id: string;
  invoiceNumber: string;
  purchaseDate: string;
  totalAmount: number;
  status: "DRAFT" | "RECEIVED" | "CANCELLED";
  receivedDate?: string | null;
  notes?: string | null;
  supplier: { id: string; name: string };
  user?: { name: string } | null;
  items: PurchaseItem[];
}

interface Supplier {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  costPrice: number;
  unit: { name: string };
}

export default function PurchasesPage() {
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string;
    name: string;
    role: "ADMIN" | "KASIR" | "PETUGAS_STOK";
  } | null>(null);

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [autoReceive, setAutoReceive] = useState(true);

  const [poItems, setPoItems] = useState<
    { productId: string; quantity: number; unitCost: number }[]
  >([]);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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

    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [resP, resS, resProd] = await Promise.all([
        fetch("/api/purchases"),
        fetch("/api/suppliers"),
        fetch("/api/products"),
      ]);
      const dataP = await resP.json();
      const dataS = await resS.json();
      const dataProd = await resProd.json();

      if (dataP.purchases) setPurchases(dataP.purchases);
      if (dataS.suppliers) {
        setSuppliers(dataS.suppliers);
        if (dataS.suppliers.length > 0 && !selectedSupplierId) {
          setSelectedSupplierId(dataS.suppliers[0].id);
        }
      }
      if (dataProd.products) setProducts(dataProd.products);
    } catch (e) {
      console.error(e);
    }
  };

  const openCreateModal = () => {
    setInvoiceNumber(`PO-${Date.now().toString().slice(-6)}`);
    setNotes("");
    setAutoReceive(true);
    setPoItems(
      products.length > 0
        ? [{ productId: products[0].id, quantity: 10, unitCost: products[0].costPrice || 1000 }]
        : []
    );
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsModalOpen(true);
  };

  const addPoItem = () => {
    if (products.length === 0) return;
    setPoItems((prev) => [
      ...prev,
      { productId: products[0].id, quantity: 10, unitCost: products[0].costPrice || 1000 },
    ]);
  };

  const removePoItem = (index: number) => {
    setPoItems((prev) => prev.filter((_, i) => i !== index));
  };

  const poTotal = poItems.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (poItems.length === 0) {
      setErrorMsg("Tambahkan minimal 1 item barang yang dibeli.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const payload = {
      supplierId: selectedSupplierId,
      invoiceNumber,
      notes,
      autoReceive,
      items: poItems,
    };

    try {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Gagal membuat pembelian.");
        setLoading(false);
        return;
      }

      setSuccessMsg("Pembelian berhasil disimpan!");
      loadData();
      setTimeout(() => {
        setIsModalOpen(false);
      }, 800);
    } catch {
      setErrorMsg("Terjadi kesalahan jaringan.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReceive = async (purchaseId: string) => {
    if (!confirm("Konfirmasi penerimaan barang? Stok akan otomatis bertambah ke persediaan.")) return;

    try {
      const res = await fetch(`/api/purchases/${purchaseId}/receive`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Gagal mengonfirmasi penerimaan barang.");
        return;
      }

      alert("Barang berhasil diterima dan stok telah bertambah!");
      loadData();
    } catch {
      alert("Terjadi kesalahan koneksi.");
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
              <Truck className="w-6 h-6 text-brand-600" />
              Pembelian Barang & Faktur Masuk
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Catat faktur masuk dari pemasok (supplier). Stok akan bertambah setelah penerimaan dikonfirmasi.
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs rounded-xl shadow-md flex items-center space-x-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Pembelian Baru</span>
          </button>
        </header>

        <div className="p-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">No. Faktur</th>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Pemasok</th>
                  <th className="py-3 px-4">Jumlah Item</th>
                  <th className="py-3 px-4">Total Pembelian</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Belum ada data pembelian tercatat.
                    </td>
                  </tr>
                ) : (
                  purchases.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                        {p.invoiceNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{formatDate(p.purchaseDate)}</td>
                      <td className="py-3 px-4 font-medium text-slate-800">{p.supplier.name}</td>
                      <td className="py-3 px-4 text-slate-600">{p.items.length} macam</td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {formatRupiah(p.totalAmount)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                            p.status === "RECEIVED"
                              ? "bg-emerald-100 text-emerald-800"
                              : p.status === "DRAFT"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {p.status === "RECEIVED" && <CheckCircle className="w-3 h-3" />}
                          {p.status === "DRAFT" && <Clock className="w-3 h-3" />}
                          {p.status === "RECEIVED"
                            ? "Diterima (Stok Masuk)"
                            : p.status === "DRAFT"
                            ? "Draf (Belum Masuk)"
                            : p.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {p.status === "DRAFT" && (
                          <button
                            onClick={() => handleConfirmReceive(p.id)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors"
                          >
                            Konfirmasi Terima
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal Buat Pembelian */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-brand-600" />
                Input Pembelian Barang dari Pemasok
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePurchase} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{errorMsg}</span>
                </div>
              )}
              {successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pemasok *</label>
                  <select
                    required
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    No. Faktur Pembelian *
                  </label>
                  <input
                    type="text"
                    required
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="Contoh: INV-ASTRA-0982"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              {/* Items Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-800">Daftar Barang Masuk</h4>
                  <button
                    type="button"
                    onClick={addPoItem}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Tambah Baris
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {poItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    >
                      <div className="flex-1">
                        <select
                          value={item.productId}
                          onChange={(e) => {
                            const p = products.find((prod) => prod.id === e.target.value);
                            const updated = [...poItems];
                            updated[idx].productId = e.target.value;
                            if (p) updated[idx].unitCost = p.costPrice || 1000;
                            setPoItems(updated);
                          }}
                          className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-medium text-xs"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.unit.name})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-20">
                        <input
                          type="number"
                          min="0.1"
                          step="any"
                          value={item.quantity}
                          onChange={(e) => {
                            const updated = [...poItems];
                            updated[idx].quantity = parseFloat(e.target.value) || 0;
                            setPoItems(updated);
                          }}
                          className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-bold text-xs"
                          placeholder="Jumlah"
                        />
                      </div>

                      <div className="w-28">
                        <input
                          type="number"
                          min="0"
                          value={item.unitCost}
                          onChange={(e) => {
                            const updated = [...poItems];
                            updated[idx].unitCost = parseFloat(e.target.value) || 0;
                            setPoItems(updated);
                          }}
                          className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-bold text-xs"
                          placeholder="Harga Beli"
                        />
                      </div>

                      <div className="w-24 text-right font-bold text-slate-800 text-xs">
                        {formatRupiah(item.quantity * item.unitCost)}
                      </div>

                      <button
                        type="button"
                        onClick={() => removePoItem(idx)}
                        className="text-slate-400 hover:text-rose-500 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total and Auto-receive check */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoReceive}
                    onChange={(e) => setAutoReceive(e.target.checked)}
                    className="rounded text-brand-600 focus:ring-brand-500"
                  />
                  <span>Langsung terima barang sekarang (tambah ke stok)</span>
                </label>

                <div className="text-right">
                  <span className="text-xs text-slate-500 block">Total Faktur:</span>
                  <span className="text-base font-extrabold text-brand-600">
                    {formatRupiah(poTotal)}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  {loading ? "Menyimpan..." : "Simpan Pembelian"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
