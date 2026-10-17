"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { Building2, Plus, X, CheckCircle2, AlertCircle } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  _count?: { purchases: number };
}

export default function SuppliersPage() {
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string;
    name: string;
    role: "ADMIN" | "KASIR" | "PETUGAS_STOK";
  } | null>(null);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    contactPerson: "",
    phone: "",
    address: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      const res = await fetch("/api/suppliers");
      const data = await res.json();
      if (data.suppliers) setSuppliers(data.suppliers);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: "error", text: data.error || "Gagal menyimpan pemasok." });
        setLoading(false);
        return;
      }

      setMsg({ type: "success", text: "Pemasok berhasil disimpan!" });
      loadSuppliers();
      setTimeout(() => {
        setIsModalOpen(false);
      }, 800);
    } catch {
      setMsg({ type: "error", text: "Terjadi kesalahan koneksi." });
    } finally {
      setLoading(false);
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
              <Building2 className="w-6 h-6 text-brand-600" />
              Data Pemasok (Supplier)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola daftar distributor dan pabrik alat jahit, benang, kancing, dan kain.
            </p>
          </div>

          <button
            onClick={() => {
              setFormData({ name: "", contactPerson: "", phone: "", address: "", notes: "" });
              setMsg(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs rounded-xl shadow-md flex items-center space-x-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Pemasok</span>
          </button>
        </header>

        <div className="p-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Nama Perusahaan / Pemasok</th>
                  <th className="py-3 px-4">Kontak Person (PIC)</th>
                  <th className="py-3 px-4">No. Telepon</th>
                  <th className="py-3 px-4">Alamat</th>
                  <th className="py-3 px-4">Riwayat Pembelian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{s.name}</td>
                    <td className="py-3 px-4 text-slate-700">{s.contactPerson || "-"}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{s.phone || "-"}</td>
                    <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{s.address || "-"}</td>
                    <td className="py-3 px-4 font-semibold text-slate-700">
                      {s._count?.purchases ?? 0} faktur
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal Tambah Supplier */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand-600" />
                Tambah Pemasok Baru
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {msg && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    msg.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-rose-50 text-rose-800 border border-rose-200"
                  }`}
                >
                  {msg.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{msg.text}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Pemasok / Distributor *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: PT Astra Benang Nusantara"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kontak Person (PIC)
                </label>
                <input
                  type="text"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  placeholder="Nama sales/kontak..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Telepon Kantor / WA
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="021-..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Alamat Kantor / Gudang</label>
                <textarea
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Alamat distributor..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                />
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
                  {loading ? "Menyimpan..." : "Simpan Pemasok"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
