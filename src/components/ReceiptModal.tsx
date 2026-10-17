"use client";

import { Printer, CheckCircle2, X } from "lucide-react";
import { formatRupiah, formatDate } from "@/lib/format";

export interface ReceiptSaleData {
  id: string;
  invoiceNumber: string;
  date: string | Date;
  cashierName: string;
  customerName: string;
  subtotal: number;
  discount: number;
  totalAmount: number;
  paymentMethod: string;
  items: {
    id: string;
    productName: string;
    quantity: number;
    unitName: string;
    unitPrice: number;
    subtotal: number;
    tierUsed?: string | null;
  }[];
  payments?: {
    method: string;
    amountPaid: number;
    amountTendered: number;
    changeAmount: number;
  }[];
}

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: ReceiptSaleData | null;
  storeSettings?: {
    storeName?: string;
    tagline?: string | null;
    phone?: string | null;
    address?: string | null;
    receiptHeader?: string | null;
    receiptFooter?: string | null;
  } | null;
}

export default function ReceiptModal({
  isOpen,
  onClose,
  sale,
  storeSettings,
}: ReceiptModalProps) {
  if (!isOpen || !sale) return null;

  const payment = sale.payments?.[0];
  const amountTendered = payment?.amountTendered || sale.totalAmount;
  const changeAmount = payment?.changeAmount || 0;

  const handlePrint = () => {
    window.print();
  };

  const paymentMethodLabel: Record<string, string> = {
    CASH: "Tunai (Cash)",
    TRANSFER: "Transfer Bank",
    QRIS: "QRIS",
    DEBIT: "Kartu Debit",
    CREDIT: "Kartu Kredit",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header bar (hidden during print) */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 no-print">
          <div className="flex items-center space-x-2 text-emerald-600 font-semibold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <span>Transaksi Sukses</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Struk Body */}
        <div id="printable-receipt" className="p-6 font-mono text-xs text-slate-800 bg-white">
          {/* Store Info */}
          <div className="text-center pb-3 border-b border-dashed border-slate-300">
            <h2 className="text-base font-bold tracking-tight text-slate-900 uppercase">
              {storeSettings?.storeName || "ERYTNABUSANA"}
            </h2>
            {storeSettings?.tagline && (
              <p className="text-[11px] text-slate-600">{storeSettings.tagline}</p>
            )}
            {storeSettings?.address && (
              <p className="text-[10px] text-slate-500 mt-0.5">{storeSettings.address}</p>
            )}
            {storeSettings?.phone && (
              <p className="text-[10px] text-slate-500">Telp: {storeSettings.phone}</p>
            )}
            {storeSettings?.receiptHeader && (
              <p className="text-[10px] italic text-slate-500 mt-1">
                {storeSettings.receiptHeader}
              </p>
            )}
          </div>

          {/* Meta Info */}
          <div className="py-2.5 border-b border-dashed border-slate-300 text-[11px] space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">No. Nota:</span>
              <span className="font-semibold text-slate-900">{sale.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Tanggal:</span>
              <span>{formatDate(sale.date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Kasir:</span>
              <span>{sale.cashierName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Pelanggan:</span>
              <span>{sale.customerName}</span>
            </div>
          </div>

          {/* Items Table */}
          <div className="py-3 border-b border-dashed border-slate-300">
            <div className="space-y-2.5">
              {sale.items.map((it, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="font-semibold text-slate-900">{it.productName}</div>
                  <div className="flex justify-between text-slate-600 text-[11px]">
                    <div>
                      <span>
                        {it.quantity} {it.unitName} × {formatRupiah(it.unitPrice)}
                      </span>
                      {it.tierUsed && it.tierUsed !== "Eceran" && (
                        <span className="ml-1 text-[10px] bg-slate-100 text-slate-700 px-1 py-0.2 rounded font-sans">
                          [{it.tierUsed}]
                        </span>
                      )}
                    </div>
                    <span className="font-medium text-slate-900">{formatRupiah(it.subtotal)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals & Payment */}
          <div className="py-3 border-b border-dashed border-slate-300 text-[11px] space-y-1.5">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span>{formatRupiah(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Diskon:</span>
                <span>-{formatRupiah(sale.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-200">
              <span>TOTAL AKHIR:</span>
              <span className="text-brand-600">{formatRupiah(sale.totalAmount)}</span>
            </div>
            <div className="flex justify-between pt-1 text-slate-600">
              <span>Metode Pembayaran:</span>
              <span className="font-medium">
                {paymentMethodLabel[sale.paymentMethod] || sale.paymentMethod}
              </span>
            </div>
            {sale.paymentMethod === "CASH" && (
              <>
                <div className="flex justify-between text-slate-600">
                  <span>Tunai Diterima:</span>
                  <span>{formatRupiah(amountTendered)}</span>
                </div>
                <div className="flex justify-between font-semibold text-slate-900">
                  <span>Kembalian:</span>
                  <span className="text-emerald-700">{formatRupiah(changeAmount)}</span>
                </div>
              </>
            )}
          </div>

          {/* Footer note */}
          <div className="pt-3 text-center text-[10px] text-slate-500 space-y-1">
            <p>{storeSettings?.receiptFooter || "Terima kasih atas kunjungan Anda!"}</p>
            <p className="text-[9px] text-slate-400">=== Nota Pembayaran Sah ===</p>
          </div>
        </div>

        {/* Action Buttons (hidden during print) */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-3 no-print">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors"
          >
            Tutup & Transaksi Baru
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 shadow-sm flex items-center space-x-2 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Struk (Print)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
