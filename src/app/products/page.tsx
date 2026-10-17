"use client";

import { useState, useEffect, useMemo } from "react";
import Sidebar from "@/components/Sidebar";
import { formatRupiah, formatNumber } from "@/lib/format";
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  Tag,
  AlertCircle,
  X,
  CheckCircle2,
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  categoryId: string;
  unitId: string;
  category: { id: string; name: string };
  unit: { id: string; name: string };
  brand?: string | null;
  description?: string | null;
  costPrice: number;
  retailPrice: number;
  minStock: number;
  allowDecimal: boolean;
  isActive: boolean;
  inventory?: { quantity: number } | null;
  priceTiers: {
    id?: string;
    minQty: number;
    maxQty?: number | null;
    price: number;
    tierName?: string | null;
  }[];
}

interface Category {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  name: string;
}

export default function ProductsPage() {
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string;
    name: string;
    role: "ADMIN" | "KASIR" | "PETUGAS_STOK";
  } | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    barcode: "",
    categoryId: "",
    unitId: "",
    brand: "",
    description: "",
    costPrice: 0,
    retailPrice: 0,
    minStock: 5,
    initialStock: 0,
    allowDecimal: false,
    isActive: true,
  });

  const [formTiers, setFormTiers] = useState<
    { minQty: number; maxQty: number | string; price: number; tierName: string }[]
  >([]);

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [resP, resC, resU] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/categories"),
        fetch("/api/units"),
      ]);
      const dataP = await resP.json();
      const dataC = await resC.json();
      const dataU = await resU.json();

      if (dataP.products) setProducts(dataP.products);
      if (dataC.categories) setCategories(dataC.categories);
      if (dataU.units) setUnits(dataU.units);
    } catch (e) {
      console.error(e);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === "ALL" || p.categoryId === selectedCategory;
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, search]);

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormData({
      name: "",
      sku: `EB-${Date.now().toString().slice(-6)}`,
      barcode: "",
      categoryId: categories[0]?.id || "",
      unitId: units[0]?.id || "",
      brand: "",
      description: "",
      costPrice: 0,
      retailPrice: 0,
      minStock: 5,
      initialStock: 0,
      allowDecimal: false,
      isActive: true,
    });
    setFormTiers([]);
    setFormError(null);
    setFormSuccess(null);
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode || "",
      categoryId: p.categoryId,
      unitId: p.unitId,
      brand: p.brand || "",
      description: p.description || "",
      costPrice: p.costPrice || 0,
      retailPrice: p.retailPrice,
      minStock: p.minStock,
      initialStock: p.inventory?.quantity || 0,
      allowDecimal: p.allowDecimal,
      isActive: p.isActive,
    });
    setFormTiers(
      p.priceTiers.map((t) => ({
        minQty: t.minQty,
        maxQty: t.maxQty !== null && t.maxQty !== undefined ? t.maxQty : "",
        price: t.price,
        tierName: t.tierName || "",
      }))
    );
    setFormError(null);
    setFormSuccess(null);
    setIsModalOpen(true);
  };

  const addTierRow = () => {
    setFormTiers((prev) => [
      ...prev,
      { minQty: 12, maxQty: 99, price: formData.retailPrice * 0.9, tierName: "Grosir Lusinan" },
    ]);
  };

  const removeTierRow = (index: number) => {
    setFormTiers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);

    const payload = {
      ...formData,
      priceTiers: formTiers.map((t) => ({
        minQty: parseFloat(String(t.minQty)),
        maxQty: t.maxQty !== "" ? parseFloat(String(t.maxQty)) : null,
        price: parseFloat(String(t.price)),
        tierName: t.tierName,
      })),
    };

    try {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : "/api/products";
      const method = editingProduct ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || "Gagal menyimpan data produk.");
        setSubmitting(false);
        return;
      }

      setFormSuccess(
        editingProduct ? "Produk berhasil diperbarui!" : "Produk baru berhasil ditambahkan!"
      );
      loadData();
      setTimeout(() => {
        setIsModalOpen(false);
      }, 800);
    } catch {
      setFormError("Terjadi kesalahan jaringan.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus produk "${name}"?`)) return;

    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Gagal menghapus produk.");
        return;
      }

      alert("Produk berhasil dihapus.");
      loadData();
    } catch {
      alert("Terjadi kesalahan jaringan.");
    }
  };

  if (!currentUser) return null;
  const canEdit = currentUser.role === "ADMIN" || currentUser.role === "PETUGAS_STOK";

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      <Sidebar user={currentUser} />

      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Header */}
        <header className="p-6 bg-white border-b border-slate-200 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Package className="w-6 h-6 text-brand-600" />
              Katalog Produk & Harga Grosir
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola data alat jahit, harga eceran, tingkatan harga grosir, dan batas minimum stok.
            </p>
          </div>

          {canEdit && (
            <button
              onClick={openCreateModal}
              className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs rounded-xl shadow-md flex items-center space-x-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Produk Baru</span>
            </button>
          )}
        </header>

        {/* Filters */}
        <div className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari berdasarkan nama, SKU, atau barcode..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="ALL">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Info Produk</th>
                  <th className="py-3.5 px-4">Kategori & Satuan</th>
                  <th className="py-3.5 px-4">Harga Eceran</th>
                  {currentUser.role !== "KASIR" && (
                    <th className="py-3.5 px-4">Harga Modal (COGS)</th>
                  )}
                  <th className="py-3.5 px-4">Tingkat Grosir</th>
                  <th className="py-3.5 px-4">Stok Saat Ini</th>
                  <th className="py-3.5 px-4">Status</th>
                  {canEdit && <th className="py-3.5 px-4 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Tidak ada produk ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const stock = p.inventory?.quantity ?? 0;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900">{p.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            SKU: {p.sku} {p.barcode ? `• Barcode: ${p.barcode}` : ""}
                          </p>
                        </td>

                        <td className="py-3 px-4 text-slate-600">
                          <span className="font-medium">{p.category.name}</span>
                          <span className="text-slate-400 text-[10px] block font-mono">
                            Satuan: {p.unit.name}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-bold text-brand-600">
                          {formatRupiah(p.retailPrice)}
                        </td>

                        {currentUser.role !== "KASIR" && (
                          <td className="py-3 px-4 text-slate-700">
                            {formatRupiah(p.costPrice)}
                          </td>
                        )}

                        <td className="py-3 px-4">
                          {p.priceTiers && p.priceTiers.length > 0 ? (
                            <div className="space-y-0.5">
                              {p.priceTiers.map((t, idx) => (
                                <div key={idx} className="text-[10px] text-slate-600">
                                  <span className="font-semibold text-slate-800">
                                    ≥ {t.minQty} {p.unit.name}:
                                  </span>{" "}
                                  <span className="text-emerald-700 font-bold">
                                    {formatRupiah(t.price)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Hanya eceran</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`font-bold ${
                              stock <= 0
                                ? "text-rose-600"
                                : stock <= p.minStock
                                ? "text-amber-600"
                                : "text-slate-800"
                            }`}
                          >
                            {formatNumber(stock)} {p.unit.name}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            Min: {p.minStock}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.isActive
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {p.isActive ? "Aktif" : "Nonaktif"}
                          </span>
                        </td>

                        {canEdit && (
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => openEditModal(p)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-slate-100 transition-colors"
                                title="Edit Produk"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {currentUser.role === "ADMIN" && (
                                <button
                                  onClick={() => handleDeleteProduct(p.id, p.name)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                  title="Hapus Produk"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal Add / Edit Product */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-brand-600" />
                {editingProduct ? "Edit Data Produk" : "Tambah Produk Baru"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{formError}</span>
                </div>
              )}
              {formSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Produk *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Contoh: Benang Jahit Astra 500y"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">SKU *</label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Barcode (Opsional)
                  </label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="899..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kategori *</label>
                  <select
                    required
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Satuan *</label>
                  <select
                    required
                    value={formData.unitId}
                    onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Harga Jual Eceran (Rp) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.retailPrice}
                    onChange={(e) =>
                      setFormData({ ...formData, retailPrice: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-brand-600"
                  />
                </div>

                {currentUser.role !== "KASIR" && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Harga Modal / Beli (Rp)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.costPrice}
                      onChange={(e) =>
                        setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Batas Minimum Stok
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.minStock}
                    onChange={(e) =>
                      setFormData({ ...formData, minStock: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                  />
                </div>

                {!editingProduct && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Stok Awal
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.initialStock}
                      onChange={(e) =>
                        setFormData({ ...formData, initialStock: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>
                )}

                <div className="col-span-2 flex items-center space-x-6 pt-1">
                  <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.allowDecimal}
                      onChange={(e) =>
                        setFormData({ ...formData, allowDecimal: e.target.checked })
                      }
                      className="rounded text-brand-600 focus:ring-brand-500"
                    />
                    <span>Dukung Kuantitas Desimal (Contoh: Kain meteran / yard)</span>
                  </label>

                  <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="rounded text-brand-600 focus:ring-brand-500"
                    />
                    <span>Produk Aktif</span>
                  </label>
                </div>
              </div>

              {/* Wholesale Tiers Section */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-amber-600" />
                      Tingkatan Harga Grosir Bertingkat (Wholesale Tiers)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Tentukan harga spesial otomatis berdasarkan ambang kuantitas pembelian.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addTierRow}
                    className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold hover:bg-amber-100 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Tambah Tingkatan
                  </button>
                </div>

                {formTiers.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">
                    Belum ada aturan harga grosir. Harga eceran akan berlaku untuk semua jumlah pembelian.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {formTiers.map((tier, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      >
                        <div className="w-24">
                          <label className="text-[10px] text-slate-400 block">Min Qty</label>
                          <input
                            type="number"
                            min="1"
                            value={tier.minQty}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 1;
                              const updated = [...formTiers];
                              updated[idx].minQty = val;
                              setFormTiers(updated);
                            }}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold"
                          />
                        </div>

                        <div className="w-24">
                          <label className="text-[10px] text-slate-400 block">
                            Max Qty (Kosong=~)
                          </label>
                          <input
                            type="number"
                            value={tier.maxQty}
                            placeholder="Tak hingga"
                            onChange={(e) => {
                              const updated = [...formTiers];
                              updated[idx].maxQty = e.target.value;
                              setFormTiers(updated);
                            }}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold"
                          />
                        </div>

                        <div className="flex-1">
                          <label className="text-[10px] text-slate-400 block">
                            Harga Satuan Grosir (Rp)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={tier.price}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const updated = [...formTiers];
                              updated[idx].price = val;
                              setFormTiers(updated);
                            }}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold text-emerald-700"
                          />
                        </div>

                        <div className="flex-1">
                          <label className="text-[10px] text-slate-400 block">Label Tingkat</label>
                          <input
                            type="text"
                            value={tier.tierName}
                            placeholder="Grosir Sedang / Lusinan"
                            onChange={(e) => {
                              const updated = [...formTiers];
                              updated[idx].tierName = e.target.value;
                              setFormTiers(updated);
                            }}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => removeTierRow(idx)}
                          className="text-slate-400 hover:text-rose-500 p-1.5 mt-3"
                          title="Hapus tingkat ini"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  {submitting ? "Menyimpan..." : "Simpan Produk"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
