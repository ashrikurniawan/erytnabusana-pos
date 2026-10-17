import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ErytnaBusana POS - Sistem Kasir & Manajemen Toko Alat Jahit",
  description: "Sistem kasir dan inventaris toko perlengkapan jahit ErytnaBusana dengan dukungan harga eceran dan grosir bertingkat.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
