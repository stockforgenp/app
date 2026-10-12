/**
 * Purchases Management & Inflow POS View
 * Implements multi-product purchase transactions, snapshot cost prices,
 * stock inflow increments, vendor auto-fill/creation, 13% VAT, and sequential bill numbers.
 */
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Truck,
  Search,
  Plus,
  Trash2,
  CheckCircle,
  Receipt,
  ListChecks,
  ScanLine,
  Tag,
  Percent,
  Printer,
  Package,
  FileText,
  Calendar,
} from "lucide-react";
import { Product, PurchaseCartItem } from "../types/index.ts";
import { getAllProducts } from "../lib/services/productService.ts";
import { processPurchase } from "../lib/services/purchaseService.ts";
import { getVendorTotalDue } from "../lib/services/vendorService.ts";
import {
  VendorInputSection,
  VendorInputData,
} from "../components/common/VendorInputSection.tsx";
import { PrintPurchaseBillModal } from "../components/common/PrintPurchaseBillModal.tsx";
import { Modal } from "../components/common/Modal.tsx";
import { Input } from "../components/common/Input.tsx";
import {
  formatCurrency,
  toMinorUnits,
  fromMinorUnits,
  formatForDateTimeLocal,
  parseDateTimeLocalToIso,
} from "../lib/utils/format.ts";
import { useToast } from "../context/ToastContext.tsx";
import { subscribeToDbChanges } from "../lib/db/sqliteEngine.ts";
import { MODIFIER_LABEL } from "../lib/hooks/useGlobalShortcuts.ts";
import { useLanguage } from "../context/LanguageContext.tsx";

interface PurchasesViewProps {
  currencySymbol: string;
  enableVat?: boolean;
  onOpenCreateProduct?: () => void;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  currencySymbol,
  enableVat = true,
  onOpenCreateProduct,
}) => {
  const { showToast } = useToast();
  const { isNepali } = useLanguage();

  // Products catalog for purchase selection
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<
    "all" | "inStock" | "lowStock"
  >("all");

  // Active Purchase Cart
  const [cart, setCart] = useState<PurchaseCartItem[]>([]);

  // Vendor Information
  const [vendorData, setVendorData] = useState<VendorInputData>({
    vendorId: null,
    name: "",
    pan_vat: "",
    phone: "",
    email: "",
    address: "",
    isNew: false,
  });
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState("");
  const [purchaseNotes, setPurchaseNotes] = useState("");
  const [purchaseDateTime, setPurchaseDateTime] = useState<string>(() =>
    formatForDateTimeLocal(),
  );

  const isCustomPurchaseDate = useMemo(() => {
    if (!purchaseDateTime) return false;
    const todayYmd = formatForDateTimeLocal().split("T")[0];
    return purchaseDateTime.split("T")[0] !== todayYmd;
  }, [purchaseDateTime]);

  // Active VAT calculation toggle for this purchase (defaults to store-level enableVat setting)
  const [applyVat, setApplyVat] = useState(enableVat !== false);

  useEffect(() => {
    setApplyVat(enableVat !== false);
  }, [enableVat]);

  // Partial Payment & Dues State
  const [paidAmountInput, setPaidAmountInput] = useState("");
  const [isCustomPaid, setIsCustomPaid] = useState(false);

  // Quick Barcode / SKU Input
  const [quickSkuInput, setQuickSkuInput] = useState("");
  const quickSkuInputRef = useRef<HTMLInputElement>(null);

  // Bulk Discount Modal
  const [isBulkDiscountModalOpen, setIsBulkDiscountModalOpen] = useState(false);
  const [bulkDiscountType, setBulkDiscountType] = useState<"fixed" | "percent">(
    "fixed",
  );
  const [bulkDiscountValue, setBulkDiscountValue] = useState("");

  // Multi-Product Batch Modal
  const [isMultiProductModalOpen, setIsMultiProductModalOpen] = useState(false);
  const [batchQuantities, setBatchQuantities] = useState<
    Record<number, number>
  >({});
  const [batchCostPrices, setBatchCostPrices] = useState<
    Record<number, number>
  >({});
  const [modalSearch, setModalSearch] = useState("");

  // Completed purchase state & Print bill modal
  const [completedPurchaseInfo, setCompletedPurchaseInfo] = useState<{
    id: number;
    billNumber?: string | null;
    invoiceNumber?: string | null;
    subtotal: number;
    discount: number;
    total: number;
    vatAmount?: number;
    grandTotal?: number;
    paidAmount?: number;
    dueAmount?: number;
    previousDue?: number;
    totalDue?: number;
    vendorName?: string | null;
    vendorPanVat?: string | null;
  } | null>(null);

  const [printPurchaseId, setPrintPurchaseId] = useState<number | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const loadCatalog = () => {
    try {
      setProducts(getAllProducts());
    } catch (e) {
      console.error("Error fetching catalog:", e);
    }
  };

  useEffect(() => {
    loadCatalog();
    const unsubscribe = subscribeToDbChanges(() => {
      loadCatalog();
    });
    return unsubscribe;
  }, []);

  // Catalog filtered products
  const availableProducts = useMemo(() => {
    let list = products;
    if (stockFilter === "inStock") {
      list = list.filter((p) => p.current_stock > 0);
    } else if (stockFilter === "lowStock") {
      list = list.filter((p) => p.current_stock <= 10);
    }

    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        p.id.toString() === q,
    );
  }, [products, search, stockFilter]);

  // Modal filtered products
  const modalFilteredProducts = useMemo(() => {
    if (!modalSearch.trim()) return products;
    const q = modalSearch.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)),
    );
  }, [products, modalSearch]);

  const handleAddToCart = (product: Product, qty = 1, costPrice?: number) => {
    const existingIndex = cart.findIndex(
      (item) => item.product.id === product.id,
    );
    if (existingIndex >= 0) {
      const updated = [...cart];
      updated[existingIndex].quantity += qty;
      if (costPrice !== undefined) {
        updated[existingIndex].cost_price = costPrice;
      }
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          product,
          quantity: qty,
          cost_price: costPrice !== undefined ? costPrice : product.cost_price,
          selling_price: product.selling_price,
          discount: 0,
        },
      ]);
    }
  };

  const handleUpdateQuantity = (index: number, qtyStr: string) => {
    const qty = parseInt(qtyStr, 10);
    const updated = [...cart];
    updated[index].quantity = isNaN(qty) || qty <= 0 ? 1 : qty;
    setCart(updated);
  };

  const handleUpdateCostPrice = (index: number, priceStr: string) => {
    const updated = [...cart];
    updated[index].cost_price = toMinorUnits(priceStr);
    setCart(updated);
  };

  const handleUpdateDiscount = (index: number, discountStr: string) => {
    const updated = [...cart];
    updated[index].discount = toMinorUnits(discountStr);
    setCart(updated);
  };

  const handleRemoveFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const handleClearCart = () => {
    setCart([]);
    setSupplierInvoiceNo("");
    setPurchaseNotes("");
    setPaidAmountInput("");
    setIsCustomPaid(false);
    setVendorData({
      vendorId: null,
      name: "",
      pan_vat: "",
      phone: "",
      email: "",
      address: "",
      isNew: false,
    });
    setPurchaseDateTime(formatForDateTimeLocal());
  };

  // Bulk Discount
  const handleApplyBulkDiscount = () => {
    const val = parseFloat(bulkDiscountValue);
    if (isNaN(val) || val < 0) {
      showToast("Please enter a valid positive discount value", "warning");
      return;
    }

    const updated = cart.map((item) => {
      let discountMinor = 0;
      if (bulkDiscountType === "fixed") {
        discountMinor = toMinorUnits(val);
      } else {
        const gross = item.quantity * item.cost_price;
        discountMinor = Math.round((gross * Math.min(100, val)) / 100);
      }
      const lineGross = item.quantity * item.cost_price;
      return {
        ...item,
        discount: Math.min(lineGross, discountMinor),
      };
    });

    setCart(updated);
    setIsBulkDiscountModalOpen(false);
    setBulkDiscountValue("");
    showToast(
      `Applied discount across ${cart.length} purchase items`,
      "success",
    );
  };

  // Quick Barcode / SKU Submit
  const handleQuickSkuSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSkuInput.trim()) return;

    const token = quickSkuInput.trim().toLowerCase();
    const match = token.match(/^(.+?)(?:[*x:]\s*(\d+))?$/i);
    const code = match ? match[1].trim() : token;
    const count = match && match[2] ? parseInt(match[2], 10) : 1;

    const matchedProduct = products.find(
      (p) =>
        (p.sku && p.sku.toLowerCase() === code) ||
        p.id.toString() === code ||
        p.name.toLowerCase() === code,
    );

    if (matchedProduct) {
      handleAddToCart(matchedProduct, isNaN(count) || count <= 0 ? 1 : count);
      setQuickSkuInput("");
      showToast(`Added ${count}x "${matchedProduct.name}" to purchase`, "info");
    } else {
      showToast(`Product "${quickSkuInput}" not found in catalog`, "warning");
    }
  };

  // Calculations
  const calculations = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalUnits = 0;

    for (const item of cart) {
      const gross = item.quantity * item.cost_price;
      subtotal += gross;
      totalDiscount += item.discount;
      totalUnits += item.quantity;
    }

    const taxableAmount = Math.max(0, subtotal - totalDiscount);
    const vatRate = applyVat ? 13.0 : 0.0;
    const vatAmount = applyVat ? Math.round(taxableAmount * 0.13) : 0;
    const grandTotal = taxableAmount + vatAmount;

    return {
      subtotal,
      totalDiscount,
      taxableAmount,
      vatRate,
      vatAmount,
      grandTotal,
      totalUnits,
    };
  }, [cart, applyVat]);

  // Vendor Previous Due & Current Purchase Due calculation
  const vendorPreviousDue = useMemo(() => {
    if (!vendorData.vendorId) return 0;
    try {
      return getVendorTotalDue(vendorData.vendorId);
    } catch {
      return 0;
    }
  }, [vendorData.vendorId]);

  const effectivePaidAmount = useMemo(() => {
    if (!isCustomPaid) {
      return calculations.grandTotal;
    }
    const parsed = parseFloat(paidAmountInput);
    if (isNaN(parsed) || parsed < 0) return 0;
    return toMinorUnits(parsed);
  }, [isCustomPaid, paidAmountInput, calculations.grandTotal]);

  const currentBillDue = useMemo(() => {
    return Math.max(0, calculations.grandTotal - effectivePaidAmount);
  }, [calculations.grandTotal, effectivePaidAmount]);

  const totalVendorDue = useMemo(() => {
    return vendorPreviousDue + currentBillDue;
  }, [vendorPreviousDue, currentBillDue]);

  // Execute Purchase Transaction
  const handleCompletePurchase = () => {
    if (cart.length === 0) {
      showToast("Please add at least one product to the purchase", "warning");
      return;
    }

    try {
      const itemsInput = cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        costPrice: item.cost_price,
        sellingPrice: item.selling_price,
        discount: item.discount,
      }));

      const purchase = processPurchase(itemsInput, {
        vendorId: vendorData.vendorId || undefined,
        vendorName: vendorData.name.trim() || undefined,
        vendorPhone: vendorData.phone.trim() || undefined,
        vendorEmail: vendorData.email.trim() || undefined,
        vendorPanVat: vendorData.pan_vat.trim() || undefined,
        vendorAddress: vendorData.address.trim() || undefined,
        paidAmount: effectivePaidAmount,
        invoiceNumber: supplierInvoiceNo.trim() || undefined,
        notes: purchaseNotes.trim() || undefined,
        applyVat: applyVat,
        createdAt: parseDateTimeLocalToIso(purchaseDateTime),
        vendorInput: {
          name: vendorData.name.trim(),
          phone: vendorData.phone.trim() || undefined,
          email: vendorData.email.trim() || undefined,
          pan_vat: vendorData.pan_vat.trim() || undefined,
          address: vendorData.address.trim() || undefined,
        },
      });

      showToast(
        `Purchase #${purchase.id} (${purchase.bill_number}) completed successfully!`,
        "success",
      );

      setCompletedPurchaseInfo({
        id: purchase.id,
        billNumber: purchase.bill_number,
        invoiceNumber: purchase.invoice_number,
        subtotal: purchase.subtotal,
        discount: purchase.discount,
        total: purchase.total,
        vatAmount: purchase.vat_amount,
        grandTotal: purchase.grand_total,
        paidAmount: purchase.paid_amount ?? effectivePaidAmount,
        dueAmount: purchase.due_amount ?? currentBillDue,
        previousDue: vendorPreviousDue,
        totalDue: totalVendorDue,
        vendorName: purchase.vendor_name,
        vendorPanVat: purchase.vendor_pan_vat,
      });

      setPrintPurchaseId(purchase.id);
      setIsPrintModalOpen(true);

      handleClearCart();
      loadCatalog();
    } catch (err: unknown) {
      showToast((err as Error).message, "error", "Purchase Failed");
    }
  };

  // Keyboard shortcut listener (F2 or Ctrl+Enter to complete purchase)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModifier = e.ctrlKey || e.metaKey;
      if (e.key === "F2" || (isModifier && e.key === "Enter")) {
        if (cart.length > 0) {
          e.preventDefault();
          handleCompletePurchase();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart, calculations, vendorData, supplierInvoiceNo, purchaseDateTime, purchaseNotes, applyVat, effectivePaidAmount]);

  // Batch selections in modal
  const submitBatchFromQuantities = () => {
    const itemsToAdd: Array<{
      product: Product;
      quantity: number;
      costPrice: number;
    }> = [];
    for (const [pIdStr, qty] of Object.entries(batchQuantities)) {
      const pId = parseInt(pIdStr, 10);
      const product = products.find((p) => p.id === pId);
      if (product && qty > 0) {
        itemsToAdd.push({
          product,
          quantity: qty,
          costPrice:
            batchCostPrices[pId] !== undefined
              ? batchCostPrices[pId]
              : product.cost_price,
        });
      }
    }

    if (itemsToAdd.length === 0) {
      showToast("Select at least one product with quantity > 0", "warning");
      return;
    }

    itemsToAdd.forEach((item) => {
      handleAddToCart(item.product, item.quantity, item.costPrice);
    });

    setBatchQuantities({});
    setBatchCostPrices({});
    setIsMultiProductModalOpen(false);
    showToast(`Added ${itemsToAdd.length} products to purchase`, "success");
  };

  return (
    <div className="p-8 flex flex-col gap-6 animate-in fade-in duration-150 h-full min-h-0">
      {/* Top Header & Tab Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-100 flex items-center gap-2">
            <Truck className="w-5 h-5 text-emerald-400" />
            <span>
              {isNepali
                ? "सामान खरिद तथा मौज्दात दाखिला (Purchases)"
                : "Purchases & Stock Inflow"}
            </span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            {isNepali
              ? "आपूर्तिकर्ताबाट सामान खरिद, नयाँ दररेट, १३% भ्याट र मौज्दात वृद्धि"
              : "Purchase multi-item products, record vendor invoices, 13% VAT, and restock inventory"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Link to Purchase History */}
          <Link
            to="/purchase-history"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-neutral-100 rounded-xl text-xs font-medium transition-colors border border-neutral-800 cursor-pointer shadow-xs"
          >
            <Receipt className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {isNepali ? "खरिद बिल इतिहास (Invoices)" : "Purchase History"}
            </span>
          </Link>

          {onOpenCreateProduct && (
            <button
              type="button"
              onClick={onOpenCreateProduct}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-medium transition-colors cursor-pointer border border-neutral-700/60"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isNepali ? "नयाँ उत्पादन" : "New Product"}</span>
            </button>
          )}
        </div>
      </div>

      {/* ================= NEW PURCHASE (INFLOW POS) ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Left Column: Product Selection & Catalog (5 cols) */}
        <div className="lg:col-span-5 h-full min-h-0 flex flex-col">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col h-full min-h-0 gap-3.5">
            <div className="flex items-center justify-between shrink-0">
              <span className="text-xs font-semibold text-neutral-200">
                {isNepali
                  ? "उत्पादन क्याटलग (सामान छान्नुहोस्)"
                  : "Select Products to Purchase"}
              </span>
              <button
                type="button"
                onClick={() => setIsMultiProductModalOpen(true)}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ListChecks className="w-3.5 h-3.5" />
                <span>
                  {isNepali ? "धेरै सामान एकैसाथ" : "Batch Selection"}
                </span>
              </button>
            </div>

            {/* Search Bar */}
            <div className="shrink-0">
              <Input
                type="text"
                placeholder={
                  isNepali
                    ? "सामानको नाम वा SKU खोज्नुहोस्..."
                    : "Search product by name, SKU, or ID..."
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={Search}
                clearable
                onClear={() => setSearch("")}
                className="py-2 text-xs"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setStockFilter("all")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  stockFilter === "all"
                    ? "bg-neutral-800 text-neutral-200"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40"
                }`}
              >
                {isNepali ? "सबै" : "All Products"} ({products.length})
              </button>
              <button
                type="button"
                onClick={() => setStockFilter("lowStock")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  stockFilter === "lowStock"
                    ? "bg-amber-950/40 text-amber-300 border border-amber-800/50"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40"
                }`}
              >
                {isNepali ? "कम मौज्दात" : "Low Stock (≤10)"}
              </button>
            </div>

            {/* Product List */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 divide-y divide-neutral-800/40">
              {availableProducts.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-500">
                  <Package className="w-7 h-7 text-neutral-600 mx-auto mb-2" />
                  <p>
                    {isNepali ? "कुनै सामान भेटिएन।" : "No products found."}
                  </p>
                </div>
              ) : (
                availableProducts.map((p) => {
                  const inCartCount = cart
                    .filter((it) => it.product.id === p.id)
                    .reduce((acc, it) => acc + it.quantity, 0);

                  return (
                    <div
                      key={p.id}
                      onClick={() => handleAddToCart(p, 1)}
                      className={`pt-2 flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer group select-none ${
                        inCartCount > 0
                          ? "bg-emerald-950/20 border-emerald-500/30"
                          : "bg-neutral-950/60 border-neutral-800/60 hover:bg-neutral-800/50 hover:border-neutral-700/60"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-semibold text-neutral-200 group-hover:text-emerald-300 flex items-center gap-1.5 truncate">
                          <span>{p.name}</span>
                          <span className="text-[10px] font-mono text-neutral-400 bg-neutral-800 px-1 rounded">
                            {p.unit || "pcs"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-neutral-400 font-mono">
                          <span>
                            Cost: {formatCurrency(p.cost_price, currencySymbol)}
                          </span>
                          <span>·</span>
                          <span>Stock: {p.current_stock}</span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        {inCartCount > 0 && (
                          <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
                            {inCartCount} in cart
                          </span>
                        )}
                        <div className="w-6 h-6 rounded-md bg-neutral-800 group-hover:bg-emerald-600 text-neutral-400 group-hover:text-white flex items-center justify-center transition-colors">
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Active Purchase Line Items & Summary (7 cols) */}
        <div className="lg:col-span-7 h-full min-h-0 flex flex-col">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden flex flex-col h-full min-h-0">
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-neutral-800 bg-neutral-950/60 flex items-center justify-between flex-wrap gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-neutral-200">
                  {isNepali
                    ? "खरिद गरिने सामानहरूको सूची"
                    : "Current Purchase Line Items"}
                </span>
                <span className="text-[11px] text-neutral-400 font-mono ml-2">
                  ({cart.length} {cart.length === 1 ? "item" : "items"} ·{" "}
                  {calculations.totalUnits} units)
                </span>
              </div>

              {cart.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBulkDiscountValue("");
                      setIsBulkDiscountModalOpen(true);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-md transition-colors cursor-pointer"
                  >
                    <Percent className="w-3 h-3" />
                    <span>{isNepali ? "सामूहिक छुट" : "Bulk Discount"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearCart}
                    className="text-[11px] text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer ml-1"
                  >
                    {isNepali ? "सबै हटाउनुहोस्" : "Clear"}
                  </button>
                </div>
              )}
            </div>

            {/* Barcode scanner input */}
            <div className="p-3 bg-neutral-950/80 border-b border-neutral-800/80 shrink-0">
              <form
                onSubmit={handleQuickSkuSubmit}
                className="flex items-center gap-2"
              >
                <div className="flex-1">
                  <Input
                    ref={quickSkuInputRef}
                    type="text"
                    placeholder={`Scan/enter SKU or product name to purchase (e.g. BEV-CC-500*5) [${MODIFIER_LABEL}+B]...`}
                    value={quickSkuInput}
                    onChange={(e) => setQuickSkuInput(e.target.value)}
                    icon={ScanLine}
                    iconPosition="left"
                    className="py-1.5 text-xs font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!quickSkuInput.trim()}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0"
                >
                  {isNepali ? "थप्नुहोस्" : "Add Item"}
                </button>
              </form>
            </div>

            {/* Cart Table */}
            {cart.length === 0 ? (
              <div className="p-12 text-center text-xs text-neutral-400 flex-1 min-h-0 flex flex-col items-center justify-center">
                <Truck className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                {isNepali
                  ? "खरिद कार्ट खाली छ। बाँयातर्फबाट सामान छान्नुहोस् वा स्क्यान गर्नुहोस्।"
                  : "Purchase cart is empty. Click products from catalog or scan SKUs above."}
              </div>
            ) : (
              <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0 min-h-[140px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-950 text-neutral-400 font-medium border-b border-neutral-800 sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-4">
                        {isNepali ? "सामान" : "Item"}
                      </th>
                      <th className="py-2.5 px-2 text-center w-24">
                        {isNepali ? "परिमाण" : "Qty"}
                      </th>
                      <th className="py-2.5 px-3 text-right font-mono w-28">
                        {isNepali ? "खरिद दर" : "Purchase Rate"}
                      </th>
                      <th className="py-2.5 px-3 text-right font-mono w-24">
                        {isNepali ? "छुट" : "Discount"}
                      </th>
                      <th className="py-2.5 px-4 text-right font-mono w-28">
                        {isNepali ? "कुल रकम" : "Net Total"}
                      </th>
                      <th className="py-2.5 px-2 text-center w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60">
                    {cart.map((item, index) => {
                      const lineGross = item.quantity * item.cost_price;
                      const lineNet = Math.max(0, lineGross - item.discount);

                      return (
                        <tr
                          key={item.product.id}
                          className="hover:bg-neutral-800/30 transition-colors"
                        >
                          {/* Product */}
                          <td className="py-3 px-4">
                            <div className="font-semibold text-neutral-200">
                              {item.product.name}
                            </div>
                            <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                              Current Stock: {item.product.current_stock}{" "}
                              {item.product.unit || "pcs"}
                            </div>
                          </td>

                          {/* Qty */}
                          <td className="py-3 px-2 text-center">
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                handleUpdateQuantity(index, e.target.value)
                              }
                              containerClassName="w-16 mx-auto"
                              className="px-2 py-1 text-center text-xs font-mono"
                            />
                          </td>

                          {/* Purchase Rate / Cost Price */}
                          <td className="py-3 px-3 text-right">
                            <Input
                              type="number"
                              step="any"
                              min="0"
                              value={fromMinorUnits(item.cost_price)}
                              onChange={(e) =>
                                handleUpdateCostPrice(index, e.target.value)
                              }
                              containerClassName="w-24 ml-auto"
                              className="px-2 py-1 text-right text-xs font-mono"
                            />
                          </td>

                          {/* Discount */}
                          <td className="py-3 px-3 text-right">
                            <Input
                              type="number"
                              step="any"
                              min="0"
                              value={fromMinorUnits(item.discount)}
                              onChange={(e) =>
                                handleUpdateDiscount(index, e.target.value)
                              }
                              containerClassName="w-20 ml-auto"
                              className="px-2 py-1 text-right text-xs text-amber-400 font-mono focus:border-amber-500"
                            />
                          </td>

                          {/* Line Total */}
                          <td className="py-3 px-4 text-right font-mono font-bold text-neutral-100">
                            {formatCurrency(lineNet, currencySymbol)}
                          </td>

                          {/* Remove */}
                          <td className="py-3 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveFromCart(index)}
                              className="text-neutral-500 hover:text-rose-400 transition-colors p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Vendor & Invoice Inputs */}
            <div className="p-4 bg-neutral-950/70 border-t border-neutral-800 space-y-3 shrink-0">
              <VendorInputSection value={vendorData} onChange={setVendorData} />

              {/* Purchase Date & Time */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-neutral-900/90 border border-neutral-800">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-xs font-medium text-neutral-200 flex items-center gap-1.5">
                      <span>{isNepali ? "खरिद मिति र समय" : "Purchase Date & Time"}</span>
                      {isCustomPurchaseDate && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-medium">
                          {isNepali ? "कस्टम मिति" : "Backdated"}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-neutral-400">
                      {isNepali
                        ? "पहिले खरिद गरेको सामान आज दर्ता गर्दा मिति मिलाउनुहोस्"
                        : "Default is today. Change if entering an earlier purchase."}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="datetime-local"
                    value={purchaseDateTime}
                    onChange={(e) => setPurchaseDateTime(e.target.value)}
                    className="px-2.5 py-1 text-xs font-mono text-neutral-200 bg-neutral-950 border border-neutral-800 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  {isCustomPurchaseDate && (
                    <button
                      type="button"
                      onClick={() => setPurchaseDateTime(formatForDateTimeLocal())}
                      className="px-2 py-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors cursor-pointer shrink-0"
                      title={isNepali ? "अहिलेको मितिमा फर्काउनुहोस्" : "Reset to current date & time"}
                    >
                      {isNepali ? "अहिले (Now)" : "Now"}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <Input
                    label={
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3 text-neutral-500" />
                        <span>
                          {isNepali
                            ? "सप्लायर बीजक नं (Supplier Invoice No)"
                            : "Supplier Invoice / Bill No"}
                        </span>
                      </span>
                    }
                    type="text"
                    placeholder={
                      isNepali ? "उदा. INV-2081-998" : "e.g. INV-9988"
                    }
                    value={supplierInvoiceNo}
                    onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                    className="py-1.5 text-xs font-mono"
                  />
                </div>

                <div>
                  <Input
                    label={
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3 text-neutral-500" />
                        <span>
                          {isNepali
                            ? "कैफियत / टिप्पणी"
                            : "Purchase Remarks / Note"}
                        </span>
                      </span>
                    }
                    type="text"
                    placeholder={
                      isNepali
                        ? "उदा. सामान प्राप्त भयो"
                        : "e.g. Received via Delivery truck"
                    }
                    value={purchaseNotes}
                    onChange={(e) => setPurchaseNotes(e.target.value)}
                    className="py-1.5 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="p-5 bg-neutral-950 border-t border-neutral-800 space-y-2.5 shrink-0">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>
                  {isNepali ? "उप-जम्मा (Gross Subtotal)" : "Subtotal (Gross)"}
                </span>
                <span className="font-mono text-neutral-200">
                  {formatCurrency(calculations.subtotal, currencySymbol)}
                </span>
              </div>

              {calculations.totalDiscount > 0 && (
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span>
                    {isNepali ? "कुल छुट (Discounts)" : "Total Discounts"}
                  </span>
                  <span className="font-mono text-amber-400">
                    -{" "}
                    {formatCurrency(calculations.totalDiscount, currencySymbol)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>
                  {isNepali ? "करयोग्य रकम (Taxable Amount)" : "Taxable Amount"}
                </span>
                <span className="font-mono text-neutral-300">
                  {formatCurrency(calculations.taxableAmount, currencySymbol)}
                </span>
              </div>

              {/* VAT Row with Toggle */}
              <div className="flex items-center justify-between text-xs text-neutral-400 py-0.5">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                      applyVat
                        ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                        : "bg-neutral-800 text-neutral-400 border-neutral-700"
                    }`}
                  >
                    {applyVat ? "13% VAT" : "0% VAT"}
                  </span>
                  <span>{isNepali ? "मूल्य अभिवृद्धि कर" : "VAT (13%)"}</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className={`font-mono ${applyVat ? "text-sky-400" : "text-neutral-500"}`}>
                    {applyVat
                      ? `+ ${formatCurrency(calculations.vatAmount, currencySymbol)}`
                      : formatCurrency(0, currencySymbol)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setApplyVat(!applyVat)}
                    title={
                      applyVat
                        ? (isNepali ? "भ्याट हटाउनुहोस्" : "Disable VAT for this purchase")
                        : (isNepali ? "१३% भ्याट जोड्नुहोस्" : "Apply 13% VAT to this purchase")
                    }
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded transition-all cursor-pointer border ${
                      applyVat
                        ? "bg-sky-500/20 text-sky-300 border-sky-500/30 hover:bg-sky-500/30"
                        : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200 hover:border-neutral-600"
                    }`}
                  >
                    {applyVat ? "ON" : "OFF"}
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-neutral-100">
                    {applyVat
                      ? (isNepali ? "अन्तिम कुल खरिद रकम (१३% भ्याट सहित)" : "Grand Total (Inc. 13% VAT)")
                      : (isNepali ? "अन्तिम कुल खरिद रकम (०% भ्याट)" : "Grand Total (0% VAT)")}
                  </div>
                  <div className="text-[11px] text-neutral-400">
                    {isNepali
                      ? "खरिद बिल नं सहित सुरक्षित भई मौज्दात दाखिला हुनेछ"
                      : "Inventory stock is increased upon completion"}
                  </div>
                </div>
                <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                  {formatCurrency(calculations.grandTotal, currencySymbol)}
                </div>
              </div>

              {/* Payment & Dues Card */}
              {cart.length > 0 && (
                <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-200">
                      {isNepali ? "भुक्तानी रकम (Paid Amount)" : "Paid Amount"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomPaid(false);
                        setPaidAmountInput("");
                      }}
                      className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors cursor-pointer border ${
                        !isCustomPaid
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                          : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200"
                      }`}
                    >
                      {isNepali ? "पूरा भुक्तानी" : "Paid in Full"}
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder={`Enter paid amount (${currencySymbol})...`}
                      value={isCustomPaid ? paidAmountInput : fromMinorUnits(calculations.grandTotal)}
                      onChange={(e) => {
                        setIsCustomPaid(true);
                        setPaidAmountInput(e.target.value);
                      }}
                      className="w-full px-3 py-1.5 text-xs font-mono font-bold text-emerald-400 bg-neutral-950 border border-neutral-800 rounded-lg focus:outline-none focus:border-emerald-500 pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-neutral-500 pointer-events-none">
                      {currencySymbol}
                    </span>
                  </div>

                  {/* Due Breakdown */}
                  <div className="space-y-1.5 pt-2 border-t border-neutral-800 text-xs">
                    <div className="flex items-center justify-between text-neutral-300">
                      <span>{isNepali ? "यस खरिदको बाँकी" : "Current Purchase Due"}:</span>
                      <span className={`font-mono font-bold ${currentBillDue > 0 ? "text-rose-400" : "text-neutral-400"}`}>
                        {formatCurrency(currentBillDue, currencySymbol)}
                      </span>
                    </div>

                    {vendorPreviousDue > 0 && (
                      <div className="flex items-center justify-between text-amber-400">
                        <span>{isNepali ? "साविकको बाँकी (Previous Due)" : "Previous Due / Balance"}:</span>
                        <span className="font-mono font-bold">
                          {formatCurrency(vendorPreviousDue, currencySymbol)}
                        </span>
                      </div>
                    )}

                    {(vendorPreviousDue > 0 || currentBillDue > 0) && (
                      <div className="flex items-center justify-between text-neutral-100 font-bold pt-1.5 border-t border-neutral-800/80">
                        <span className="text-xs">{isNepali ? "कुल तिर्न बाँकी" : "Total Payable Due"}:</span>
                        <span className="font-mono text-sm text-rose-400">
                          {formatCurrency(totalVendorDue, currencySymbol)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  disabled={cart.length === 0}
                  onClick={handleCompletePurchase}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                    cart.length === 0
                      ? "bg-neutral-800 text-neutral-500 cursor-not-allowed shadow-none"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white active:scale-[0.99]"
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>
                    {isNepali
                      ? "खरिद सम्पन्न गरी मौज्दात बढाउनुहोस्"
                      : "Complete Purchase & Restock"}{" "}
                    ({formatCurrency(calculations.grandTotal, currencySymbol)})
                  </span>
                  <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-emerald-700/80 text-emerald-100 border border-emerald-500/40">
                    F2
                  </kbd>
                </button>
              </div>
            </div>
          </div>

          {/* Completed Purchase Banner */}
          {completedPurchaseInfo && (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between shrink-0 mt-3">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-neutral-100 flex items-center flex-wrap gap-x-2">
                    <span>
                      Purchase #
                      {completedPurchaseInfo.billNumber ||
                        completedPurchaseInfo.id}{" "}
                      Successfully Inflowed
                    </span>
                    {completedPurchaseInfo.vendorName && (
                      <span className="font-normal text-emerald-300 text-xs">
                        · Vendor: {completedPurchaseInfo.vendorName}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">
                    Grand Total:{" "}
                    <span className="font-mono text-emerald-300 font-bold">
                      {formatCurrency(
                        completedPurchaseInfo.grandTotal ||
                          completedPurchaseInfo.total,
                        currencySymbol,
                      )}
                    </span>
                    {" · "}Taxable:{" "}
                    {formatCurrency(
                      completedPurchaseInfo.total,
                      currencySymbol,
                    )}
                    {" · "}VAT:{" "}
                    {formatCurrency(
                      completedPurchaseInfo.vatAmount || 0,
                      currencySymbol,
                    )}
                    {completedPurchaseInfo.paidAmount !== undefined && (
                      <span>
                        {" "}
                        · Paid:{" "}
                        <span className="font-mono text-emerald-300 font-medium">
                          {formatCurrency(
                            completedPurchaseInfo.paidAmount,
                            currencySymbol,
                          )}
                        </span>
                      </span>
                    )}
                    {completedPurchaseInfo.dueAmount !== undefined &&
                      completedPurchaseInfo.dueAmount > 0 && (
                        <span>
                          {" "}
                          · Bill Due:{" "}
                          <span className="font-mono text-amber-400 font-medium">
                            {formatCurrency(
                              completedPurchaseInfo.dueAmount,
                              currencySymbol,
                            )}
                          </span>
                        </span>
                      )}
                    {completedPurchaseInfo.previousDue !== undefined &&
                      completedPurchaseInfo.previousDue > 0 && (
                        <span>
                          {" "}
                          · Prev Due:{" "}
                          <span className="font-mono text-amber-300">
                            {formatCurrency(
                              completedPurchaseInfo.previousDue,
                              currencySymbol,
                            )}
                          </span>
                        </span>
                      )}
                    {completedPurchaseInfo.totalDue !== undefined &&
                      completedPurchaseInfo.totalDue > 0 && (
                        <span>
                          {" "}
                          · Total Due:{" "}
                          <span className="font-mono text-rose-400 font-semibold">
                            {formatCurrency(
                              completedPurchaseInfo.totalDue,
                              currencySymbol,
                            )}
                          </span>
                        </span>
                      )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setPrintPurchaseId(completedPurchaseInfo.id);
                    setIsPrintModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Bill</span>
                </button>
                <button
                  onClick={() => setCompletedPurchaseInfo(null)}
                  className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors px-2 py-1 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Batch Products Modal */}
      <Modal
        isOpen={isMultiProductModalOpen}
        onClose={() => setIsMultiProductModalOpen(false)}
        title={
          isNepali
            ? "धेरै सामान एकैसाथ खरिद गर्नुहोस्"
            : "Add Multiple Products to Purchase"
        }
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div>
            <Input
              type="text"
              placeholder="Search products..."
              value={modalSearch}
              onChange={(e) => setModalSearch(e.target.value)}
              icon={Search}
              clearable
              onClear={() => setModalSearch("")}
              className="py-1.5 text-xs"
            />
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-neutral-800 border border-neutral-800 rounded-lg">
            {modalFilteredProducts.map((p) => {
              const qty = batchQuantities[p.id] || 0;
              const cost =
                batchCostPrices[p.id] !== undefined
                  ? batchCostPrices[p.id]
                  : p.cost_price;

              return (
                <div
                  key={p.id}
                  className="p-2.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-neutral-200 truncate">
                      {p.name}
                    </div>
                    <div className="text-[10px] text-neutral-400 font-mono">
                      Current Stock: {p.current_stock}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-neutral-400">
                        Rate:
                      </span>
                      <Input
                        type="number"
                        step="any"
                        value={fromMinorUnits(cost)}
                        onChange={(e) =>
                          setBatchCostPrices({
                            ...batchCostPrices,
                            [p.id]: toMinorUnits(e.target.value),
                          })
                        }
                        containerClassName="w-20"
                        className="px-2 py-1 text-right text-xs font-mono"
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-neutral-400">Qty:</span>
                      <Input
                        type="number"
                        min="0"
                        value={qty}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setBatchQuantities({
                            ...batchQuantities,
                            [p.id]: isNaN(val) ? 0 : val,
                          });
                        }}
                        containerClassName="w-16"
                        className="px-2 py-1 text-center text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => setIsMultiProductModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitBatchFromQuantities}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
            >
              Add Selected to Purchase
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk Discount Modal */}
      <Modal
        isOpen={isBulkDiscountModalOpen}
        onClose={() => setIsBulkDiscountModalOpen(false)}
        title={isNepali ? "सामूहिक छुट लागू गर्नुहोस्" : "Apply Bulk Discount"}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setBulkDiscountType("fixed")}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                bulkDiscountType === "fixed"
                  ? "bg-amber-950/40 border-amber-500/50 text-amber-300"
                  : "bg-neutral-950 border-neutral-800 text-neutral-400"
              }`}
            >
              Fixed Amount ({currencySymbol})
            </button>
            <button
              type="button"
              onClick={() => setBulkDiscountType("percent")}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                bulkDiscountType === "percent"
                  ? "bg-amber-950/40 border-amber-500/50 text-amber-300"
                  : "bg-neutral-950 border-neutral-800 text-neutral-400"
              }`}
            >
              Percentage (%)
            </button>
          </div>

          <div>
            <Input
              label="Discount Value"
              type="number"
              step="any"
              min="0"
              placeholder={bulkDiscountType === "fixed" ? "e.g. 50" : "e.g. 5"}
              value={bulkDiscountValue}
              onChange={(e) => setBulkDiscountValue(e.target.value)}
              className="font-mono focus:border-amber-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => setIsBulkDiscountModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyBulkDiscount}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
            >
              Apply Discount
            </button>
          </div>
        </div>
      </Modal>

      {/* Print Purchase Bill Modal */}
      <PrintPurchaseBillModal
        isOpen={isPrintModalOpen}
        onClose={() => {
          setIsPrintModalOpen(false);
          setPrintPurchaseId(null);
        }}
        purchaseId={printPurchaseId}
        currencySymbol={currencySymbol}
      />
    </div>
  );
};
