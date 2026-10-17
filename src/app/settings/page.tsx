"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { Settings, Save, CheckCircle2, AlertCircle, Database } from "lucide-react";

export default function SettingsPage() {
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string;
    name: string;
    role: "ADMIN" | "KASIR" | "PETUGAS_STOK";
  } | null>(null);

  const [formData, setFormData] = useState({
    storeName: "ErytnaBusana",
    tagline: "Toko Alat Jahit & Perlengkapan Busana",
    phone: "0812-3456-7890",
    address: "Jl. KH. Agus Salim No. 45, Pasar Baru, Jakarta",
    receiptHeader: "ErytnaBusana - Pusat Alat Jahit Terlengkap",
    receiptFooter: "Terima kasih atas kunjungan Anda. Barang yang sudah dibeli dapat ditukar maksimal 2 hari dengan membawa struk belanja.",
    allowNegativeStock: false,
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

    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data.settings) {
        setFormData({
          storeName: data.settings.storeName || "",
          tagline: data.settings.tagline || "",
          phone: data.settings.phone || "",
          address: data.settings.address || "",
          receiptHeader: data.settings.receiptHeader || "",
          receiptFooter: data.settings.receiptFooter || "",
          allowNegativeStock: !!data.settings.allowNegativeStock,
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: "error", text: data.error || "Gagal memperbarui pengaturan toko." });
        setLoading(false);
        return;
      }

      setMsg({ type: "success", text: "Pengaturan toko dan struk berhasil disimpan!" });
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
              <Settings className="w-6 h-6 text-brand-600" />
              Pengaturan Toko & Struk Kasir
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Atur identitas toko ErytnaBusana, teks cetak struk thermal, dan kebijakan stok.
            </p>
          </div>
        </header>

        <div className="p-6 max-w-3xl">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
            {msg && (
              <div
                className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
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

            <form onSubmit={handleSave} className="space-y-5">
              <div className="space-y-4">
                <h3 className="font-bold text-sm text-slate-900 border-b pb-2">
                  Identitas Toko
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Toko *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.storeName}
                      onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nomor Telepon / WhatsApp
                    </label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Slogan / Tagline Toko
                    </label>
                    <input
                      type="text"
                      value={formData.tagline}
                      onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Alamat Fisik Toko
                    </label>
                    <textarea
                      rows={2}
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="font-bold text-sm text-slate-900 border-b pb-2">
                  Teks Struk Kasir Thermal
                </h3>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Pesan Header Struk
                  </label>
                  <input
                    type="text"
                    value={formData.receiptHeader}
                    onChange={(e) => setFormData({ ...formData, receiptHeader: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Pesan Footer Struk (Catatan Penukaran / Terima Kasih)
                  </label>
                  <textarea
                    rows={2}
                    value={formData.receiptFooter}
                    onChange={(e) => setFormData({ ...formData, receiptFooter: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="font-bold text-sm text-slate-900 border-b pb-2">
                  Kebijakan Stok
                </h3>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.allowNegativeStock}
                    onChange={(e) =>
                      setFormData({ ...formData, allowNegativeStock: e.target.checked })
                    }
                    className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Izinkan Penjualan Stok Negatif
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Jika dinonaktifkan (standar), kasir dilarang memproses transaksi apabila stok di sistem kurang dari jumlah yang dibeli.
                    </span>
                  </div>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>{loading ? "Menyimpan..." : "Simpan Pengaturan"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
