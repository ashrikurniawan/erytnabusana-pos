"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scissors, Lock, User, AlertCircle, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Gagal masuk. Periksa username dan password Anda.");
        setLoading(false);
        return;
      }

      // Redirect based on role
      if (data.user?.role === "KASIR") {
        router.push("/pos");
      } else {
        router.push("/dashboard");
      }
      router.refresh();
    } catch {
      setError("Terjadi kesalahan jaringan atau server.");
      setLoading(false);
    }
  };

  const setDemoAccount = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="max-w-md w-full">
        {/* Card */}
        <div className="bg-slate-800 border border-slate-700/80 rounded-3xl p-8 shadow-2xl shadow-black/50 text-white">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-brand-600 to-rose-400 flex items-center justify-center text-white shadow-lg shadow-brand-900/40">
              <Scissors className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Erytna<span className="text-brand-500">Busana</span> POS
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Sistem Kasir & Manajemen Toko Alat Jahit
            </p>
          </div>

          {/* Error alert */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start space-x-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username Anda"
                  className="w-full pl-10 pr-4 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Kata Sandi (Password)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-lg shadow-brand-900/30 flex items-center justify-center space-x-2 transition-all mt-2"
            >
              <span>{loading ? "Memverifikasi..." : "Masuk ke Sistem"}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          {/* Quick Demo Accounts */}
          <div className="mt-8 pt-6 border-t border-slate-700/60">
            <p className="text-[11px] font-medium text-slate-400 text-center mb-3">
              Akun Pengujian Demo (Klik untuk mengisi cepat):
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDemoAccount("admin", "admin123")}
                className="px-2 py-2 bg-slate-900 hover:bg-slate-700/80 border border-slate-700 rounded-lg text-left transition-colors"
              >
                <p className="text-[11px] font-semibold text-purple-300">Admin</p>
                <p className="text-[10px] text-slate-400">admin / admin123</p>
              </button>
              <button
                type="button"
                onClick={() => setDemoAccount("kasir1", "kasir123")}
                className="px-2 py-2 bg-slate-900 hover:bg-slate-700/80 border border-slate-700 rounded-lg text-left transition-colors"
              >
                <p className="text-[11px] font-semibold text-emerald-300">Kasir</p>
                <p className="text-[10px] text-slate-400">kasir1 / kasir123</p>
              </button>
              <button
                type="button"
                onClick={() => setDemoAccount("stok1", "stok123")}
                className="px-2 py-2 bg-slate-900 hover:bg-slate-700/80 border border-slate-700 rounded-lg text-left transition-colors"
              >
                <p className="text-[11px] font-semibold text-blue-300">Stok</p>
                <p className="text-[10px] text-slate-400">stok1 / stok123</p>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-500 mt-6">
          &copy; 2026 ErytnaBusana POS. Hak Cipta Dilindungi.
        </p>
      </div>
    </div>
  );
}
