"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Sidebar from "@/components/Sidebar";
import ReceiptModal, { ReceiptSaleData } from "@/components/ReceiptModal";
import { formatRupiah, formatNumber } from "@/lib/format";
import { calculateItemPrice } from "@/lib/pricing";
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CheckCircle,
  CreditCard,
  Banknote,
  QrCode,
  Tag,
  AlertCircle,
  User,
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  categoryId: string;
  category: { id: string; name: string };
  unit: { id: string; name: string };
  retailPrice: number;
  costPrice: number;
  allowDecimal: boolean;
  inventory?: { quantity: number; minStock: number } | null;
  priceTiers: {
    id: string;
    minQty: number;
    maxQty?: number | null;
    price: number;
    tierName?: string | null;
  }[];
}

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  tierUsed: string;
  isWholesale: boolean;
  savings: number;
}

interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  type: string;
}

export default function PosPage() {
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string;
    name: string;
    role: "ADMIN" | "KASIR" | "PETUGAS_STOK";
  } | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("cust-umum");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH");
  const [amountTendered, setAmountTendered] = useState<number>(0);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<ReceiptSaleData | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [storeSettings, setStoreSettings] = useState<Record<string, string> | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load session user and master data
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

    loadProducts();
    loadCategories();
    loadCustomers();
    loadSettings();
  }, []);

  const loadProducts = async () => {
    try {
      const res = await fetch("/api/products?activeOnly=true");
      const data = await res.json();
      if (data.products) setProducts(data.products);
    } catch (e) {
      console.error(e);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      if (data.categories) setCategories(data.categories);
    } catch (e) {
      console.error(e);
    }
  };

  const loadCustomers = async () => {
    try {
      const res = await fetch("/api/customers");
      const data = await res.json();
      if (data.customers) setCustomers(data.customers);
    } catch (e) {
      console.error(e);
    }
  };

  const loadSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data.settings) setStoreSettings(data.settings);
    } catch (e) {
      console.error(e);
    }
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCategory = selectedCategory === "ALL" || p.categoryId === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q));
      return matchCategory && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Handle adding product to cart
  const addToCart = (product: Product, addQty = 1) => {
    setErrorMsg(null);
    const existingIndex = cart.findIndex((item) => item.product.id === product.id);

    const availableStock = product.inventory?.quantity ?? 0;
    const currentQtyInCart = existingIndex >= 0 ? cart[existingIndex].quantity : 0;
    const newQty = currentQtyInCart + addQty;

    // Check stock limit (Acceptance Test 4)
    if (newQty > availableStock) {
      setErrorMsg(
        `Stok tidak mencukupi untuk "${product.name}". Tersedia: ${availableStock} ${product.unit.name}.`
      );
      return;
    }

    if (existingIndex >= 0) {
      updateCartItemQuantity(product.id, newQty);
    } else {
      const pricing = calculateItemPrice(
        product.retailPrice,
        product.costPrice,
        product.priceTiers,
        addQty
      );
      setCart((prev) => [
        ...prev,
        {
          product,
          quantity: addQty,
          unitPrice: pricing.unitPrice,
          subtotal: pricing.subtotal,
          tierUsed: pricing.tierName,
          isWholesale: pricing.isWholesale,
          savings: pricing.totalSavings,
        },
      ]);
    }
  };

  // Update item quantity in cart
  const updateCartItemQuantity = (productId: string, requestedQty: number) => {
    setErrorMsg(null);
    if (requestedQty <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.product.id === productId) {
          const availableStock = item.product.inventory?.quantity ?? 0;
          if (requestedQty > availableStock) {
            setErrorMsg(
              `Stok untuk "${item.product.name}" terbatas (${availableStock} ${item.product.unit.name}). Jumlah disesuaikan ke stok maksimal.`
            );
            requestedQty = availableStock;
          }

          const pricing = calculateItemPrice(
            item.product.retailPrice,
            item.product.costPrice,
            item.product.priceTiers,
            requestedQty
          );

          return {
            ...item,
            quantity: requestedQty,
            unitPrice: pricing.unitPrice,
            subtotal: pricing.subtotal,
            tierUsed: pricing.tierName,
            isWholesale: pricing.isWholesale,
            savings: pricing.totalSavings,
          };
        }
        return item;
      })
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setAmountTendered(0);
    setErrorMsg(null);
  };

  // Cart calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.subtotal, 0);
  }, [cart]);

  const grandTotal = useMemo(() => {
    return Math.max(0, cartSubtotal - (discount || 0));
  }, [cartSubtotal, discount]);

  const changeAmount = useMemo(() => {
    if (paymentMethod !== "CASH") return 0;
    return Math.max(0, (amountTendered || 0) - grandTotal);
  }, [paymentMethod, amountTendered, grandTotal]);

  // Set default tendered when grandTotal changes
  useEffect(() => {
    if (paymentMethod === "CASH" && amountTendered < grandTotal) {
      setAmountTendered(grandTotal);
    }
  }, [grandTotal, paymentMethod, amountTendered]);

  // Process checkout
  const handleCheckout = async () => {
    if (cart.length === 0) {
      setErrorMsg("Keranjang belanja masih kosong.");
      return;
    }

    if (paymentMethod === "CASH" && amountTendered < grandTotal) {
      setErrorMsg(
        `Uang pembayaran tunai kurang sebesar ${formatRupiah(grandTotal - amountTendered)}.`
      );
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const idempotencyKey = `POS-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const selectedCust = customers.find((c) => c.id === selectedCustomerId);

    const payload = {
      customerId: selectedCustomerId !== "cust-umum" ? selectedCustomerId : null,
      customerName: selectedCust ? selectedCust.name : "Pelanggan Umum",
      items: cart.map((it) => ({
        productId: it.product.id,
        quantity: it.quantity,
      })),
      discount,
      paymentMethod,
      amountTendered: paymentMethod === "CASH" ? amountTendered : grandTotal,
      idempotencyKey,
    };

    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Gagal memproses transaksi kasir.");
        setLoading(false);
        return;
      }

      // Success
      setCompletedSale(data.sale);
      setIsReceiptOpen(true);
      clearCart();
      loadProducts(); // Refresh stock
    } catch {
      setErrorMsg("Terjadi kegagalan jaringan saat mengirim transaksi.");
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
        <p className="animate-pulse">Memuat sistem kasir ErytnaBusana...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      <Sidebar user={currentUser} />

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left: Product Catalog */}
        <section className="flex-1 flex flex-col min-w-0 border-r border-slate-200 bg-white">
          {/* Top Search & Filter Bar */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 space-y-3">
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari produk berdasarkan Nama, SKU, atau Scan Barcode... (F2)"
                className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 shadow-sm"
              />
            </div>

            {/* Category Pills */}
            <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedCategory("ALL")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedCategory === "ALL"
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                Semua Kategori
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    selectedCategory === cat.id
                      ? "bg-brand-600 text-white shadow-sm"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Search className="w-12 h-12 stroke-[1.5] mb-2 opacity-50" />
                <p className="text-sm font-medium">Tidak ada produk yang cocok dengan pencarian.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredProducts.map((product) => {
                  const stock = product.inventory?.quantity ?? 0;
                  const isOutOfStock = stock <= 0;
                  const isLowStock = stock > 0 && stock <= (product.inventory?.minStock ?? 5);
                  const hasWholesaleTiers = product.priceTiers && product.priceTiers.length > 0;

                  return (
                    <button
                      key={product.id}
                      disabled={isOutOfStock}
                      onClick={() => addToCart(product, 1)}
                      className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between relative group ${
                        isOutOfStock
                          ? "bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed"
                          : "bg-white border-slate-200 hover:border-brand-500 hover:shadow-md active:scale-[0.98]"
                      }`}
                    >
                      <div>
                        {/* Tags */}
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="text-[10px] font-mono text-slate-400 truncate">
                            {product.sku}
                          </span>
                          {hasWholesaleTiers && (
                            <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
                              <Tag className="w-2.5 h-2.5" />
                              Grosir
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <h3 className="font-semibold text-xs text-slate-800 line-clamp-2 leading-snug mb-1">
                          {product.name}
                        </h3>

                        <p className="text-[11px] text-slate-500">{product.category.name}</p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-end justify-between">
                        <div>
                          <p className="text-xs font-bold text-brand-600">
                            {formatRupiah(product.retailPrice)}
                            <span className="text-[10px] text-slate-400 font-normal">
                              /{product.unit.name}
                            </span>
                          </p>
                        </div>

                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            isOutOfStock
                              ? "bg-rose-100 text-rose-700"
                              : isLowStock
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {isOutOfStock
                            ? "Habis"
                            : `Stok: ${formatNumber(stock)} ${product.unit.name}`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Right: Cart & Checkout Panel */}
        <section className="w-96 lg:w-[420px] bg-white flex flex-col shrink-0 shadow-lg z-10">
          {/* Cart Header */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="w-5 h-5 text-brand-600" />
              <h2 className="font-bold text-sm text-slate-800">Keranjang Belanja</h2>
              <span className="bg-brand-100 text-brand-800 text-xs px-2 py-0.5 rounded-full font-bold">
                {cart.length}
              </span>
            </div>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-slate-500 hover:text-rose-600 font-medium transition-colors"
              >
                Kosongkan
              </button>
            )}
          </div>

          {/* Customer Selector */}
          <div className="px-4 py-2 bg-slate-50/60 border-b border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-1.5 text-slate-600">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Pelanggan:</span>
            </div>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
          </div>

          {/* Cart Item List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16">
                <ShoppingCart className="w-12 h-12 stroke-[1.5] mb-2 opacity-40" />
                <p className="text-sm font-medium">Keranjang masih kosong</p>
                <p className="text-xs text-slate-400 mt-1">
                  Pilih produk di katalog untuk ditambahkan.
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.product.id}
                  className="p-3 rounded-xl border border-slate-200 bg-white shadow-sm hover:border-slate-300 transition-all space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="pr-2">
                      <h4 className="font-semibold text-xs text-slate-800 leading-snug">
                        {item.product.name}
                      </h4>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <span className="text-[11px] text-slate-500">
                          {formatRupiah(item.unitPrice)}/{item.product.unit.name}
                        </span>
                        {item.isWholesale && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-semibold">
                            {item.tierUsed}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-slate-400 hover:text-rose-500 p-1 rounded-lg transition-colors"
                      title="Hapus item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Quantity and Subtotal Controls */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() =>
                          updateCartItemQuantity(
                            item.product.id,
                            item.quantity - (item.product.allowDecimal ? 0.5 : 1)
                          )
                        }
                        className="w-7 h-7 rounded-lg border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <input
                        type="number"
                        step={item.product.allowDecimal ? "0.1" : "1"}
                        min="0"
                        value={item.quantity}
                        onChange={(e) =>
                          updateCartItemQuantity(item.product.id, parseFloat(e.target.value) || 0)
                        }
                        className="w-14 text-center py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />

                      <button
                        onClick={() =>
                          updateCartItemQuantity(
                            item.product.id,
                            item.quantity + (item.product.allowDecimal ? 0.5 : 1)
                          )
                        }
                        className="w-7 h-7 rounded-lg border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>

                      <span className="text-xs text-slate-400 pl-1">{item.product.unit.name}</span>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-xs text-slate-900">
                        {formatRupiah(item.subtotal)}
                      </p>
                      {item.savings > 0 && (
                        <p className="text-[10px] text-emerald-600 font-medium">
                          Hemat {formatRupiah(item.savings)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Payment Area */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
            {/* Summary */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal ({cart.length} item):</span>
                <span>{formatRupiah(cartSubtotal)}</span>
              </div>

              {currentUser.role !== "KASIR" && (
                <div className="flex items-center justify-between text-slate-600">
                  <span>Diskon Tambahan (Rp):</span>
                  <input
                    type="number"
                    min="0"
                    value={discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className="w-24 text-right py-0.5 px-2 bg-white border border-slate-300 rounded text-xs"
                  />
                </div>
              )}

              <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                <span>TOTAL AKHIR:</span>
                <span className="text-brand-600 text-lg">{formatRupiah(grandTotal)}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              {[
                { id: "CASH", label: "Tunai", icon: Banknote },
                { id: "TRANSFER", label: "Transfer", icon: CreditCard },
                { id: "QRIS", label: "QRIS", icon: QrCode },
                { id: "DEBIT", label: "Debit", icon: CreditCard },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id)}
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center text-[11px] font-semibold transition-all ${
                      isSelected
                        ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className="w-4 h-4 mb-1" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Cash Tendered Input & Quick Money Buttons */}
            {paymentMethod === "CASH" && (
              <div className="space-y-2 pt-1 bg-white p-3 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">Uang Tunai Diterima:</span>
                  <input
                    type="number"
                    value={amountTendered || ""}
                    onChange={(e) => setAmountTendered(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-32 text-right font-bold py-1 px-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                {/* Quick money buttons */}
                <div className="flex space-x-1.5 overflow-x-auto">
                  <button
                    onClick={() => setAmountTendered(grandTotal)}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-semibold whitespace-nowrap"
                  >
                    Uang Pas
                  </button>
                  {[10000, 20000, 50000, 100000, 200000].map((amt) => {
                    if (amt >= grandTotal) {
                      return (
                        <button
                          key={amt}
                          onClick={() => setAmountTendered(amt)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-semibold whitespace-nowrap"
                        >
                          {formatRupiah(amt)}
                        </button>
                      );
                    }
                    return null;
                  })}
                </div>

                <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-100">
                  <span className="font-semibold text-slate-600">Kembalian:</span>
                  <span className="font-extrabold text-sm text-emerald-600">
                    {formatRupiah(changeAmount)}
                  </span>
                </div>
              </div>
            )}

            {/* Big Checkout Button */}
            <button
              onClick={handleCheckout}
              disabled={loading || cart.length === 0}
              className="w-full py-3.5 px-4 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 disabled:opacity-50 text-white font-bold text-base rounded-2xl shadow-lg shadow-brand-900/20 flex items-center justify-center space-x-2 transition-all"
            >
              <CheckCircle className="w-5 h-5" />
              <span>{loading ? "Memproses..." : "PROSES PEMBAYARAN"}</span>
            </button>
          </div>
        </section>
      </main>

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        sale={completedSale}
        storeSettings={storeSettings}
      />
    </div>
  );
}
