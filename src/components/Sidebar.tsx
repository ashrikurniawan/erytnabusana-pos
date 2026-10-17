"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Truck,
  Users,
  Building2,
  Receipt,
  BarChart3,
  UserCog,
  Settings,
  LogOut,
  Scissors,
} from "lucide-react";

interface SidebarProps {
  user: {
    id: string;
    username: string;
    name: string;
    role: "ADMIN" | "KASIR" | "PETUGAS_STOK";
  };
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      window.location.href = "/login";
    }
  };

  const navItems = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      roles: ["ADMIN", "PETUGAS_STOK"],
    },
    {
      label: "Kasir POS",
      href: "/pos",
      icon: ShoppingCart,
      roles: ["ADMIN", "KASIR", "PETUGAS_STOK"],
    },
    {
      label: "Katalog Produk",
      href: "/products",
      icon: Package,
      roles: ["ADMIN", "KASIR", "PETUGAS_STOK"],
    },
    {
      label: "Persediaan & Stok",
      href: "/inventory",
      icon: Boxes,
      roles: ["ADMIN", "KASIR", "PETUGAS_STOK"],
    },
    {
      label: "Pembelian (PO)",
      href: "/purchases",
      icon: Truck,
      roles: ["ADMIN", "PETUGAS_STOK"],
    },
    {
      label: "Pelanggan",
      href: "/customers",
      icon: Users,
      roles: ["ADMIN", "KASIR", "PETUGAS_STOK"],
    },
    {
      label: "Pemasok (Supplier)",
      href: "/suppliers",
      icon: Building2,
      roles: ["ADMIN", "PETUGAS_STOK"],
    },
    {
      label: "Riwayat Transaksi",
      href: "/sales",
      icon: Receipt,
      roles: ["ADMIN", "KASIR", "PETUGAS_STOK"],
    },
    {
      label: "Laporan",
      href: "/reports",
      icon: BarChart3,
      roles: ["ADMIN"],
    },
    {
      label: "Manajemen Pengguna",
      href: "/users",
      icon: UserCog,
      roles: ["ADMIN"],
    },
    {
      label: "Pengaturan Toko",
      href: "/settings",
      icon: Settings,
      roles: ["ADMIN"],
    },
  ];

  const allowedItems = navItems.filter((item) => item.roles.includes(user.role));

  const roleLabels: Record<string, { label: string; badge: string }> = {
    ADMIN: { label: "Admin / Pemilik", badge: "bg-purple-100 text-purple-800 border-purple-200" },
    KASIR: { label: "Kasir", badge: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    PETUGAS_STOK: { label: "Petugas Stok", badge: "bg-blue-100 text-blue-800 border-blue-200" },
  };

  const currentRole = roleLabels[user.role] || { label: user.role, badge: "bg-gray-100 text-gray-800 border-gray-200" };

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col shrink-0 h-screen sticky top-0 border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center space-x-3 bg-slate-950/60">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-rose-400 flex items-center justify-center text-white shadow-md shadow-brand-900/30">
          <Scissors className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-base tracking-wide text-white flex items-center gap-1.5">
            Erytna<span className="text-brand-500">Busana</span>
          </h1>
          <p className="text-xs text-slate-400">Toko Alat Jahit & Konveksi</p>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {allowedItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/pos" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-brand-600 text-white shadow-sm font-semibold"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Info & Logout Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="truncate mr-2">
            <p className="text-xs font-semibold text-white truncate">{user.name}</p>
            <span
              className={`inline-block mt-0.5 text-[10px] px-2 py-0.5 rounded-full font-medium border ${currentRole.badge}`}
            >
              {currentRole.label}
            </span>
          </div>
          <button
            onClick={handleLogout}
            title="Keluar (Logout)"
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
