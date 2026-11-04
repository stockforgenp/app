/**
 * Purchases Management & Inflow POS View
 * Implements multi-product purchase transactions, snapshot cost prices,
 * stock inflow increments, vendor auto-fill/creation, 13% VAT, and sequential bill numbers.
 */
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Truck,
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  Receipt,
  Tag,
  Percent,
  Printer,
  Package,
  FileText,
  Calendar,
  RotateCcw,
  X,
} from "lucide-react";
import { Product, PurchaseCartItem, ProductPackaging } from "../types/index.ts";
import { getAllProducts } from "../lib/services/productService.ts";
import { processPurchase } from "../lib/services/purchaseService.ts";
import { getAllPackagings } from "../lib/services/packagingService.ts";
import { getVendorTotalDue } from "../lib/services/vendorService.ts";
import { calculateProportionalDiscounts } from "../helpers/index.ts";
import {
  VendorInputSection,
  VendorInputData,
} from "../components/common/VendorInputSection.tsx";
import { PrintPurchaseBillModal } from "../components/common/PrintPurchaseBillModal.tsx";
import { ReturnsModal } from "../components/common/ReturnsModal.tsx";
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
import { NepaliDatePicker } from "../components/common/NepaliDatePicker.tsx";
import { useLanguage } from "../context/LanguageContext.tsx";
import { PAYMENT_MODE_OPTIONS } from "../constants/index.ts";

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
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash");
  const [customPaymentMethod, setCustomPaymentMethod] = useState("");

  // Whole Bill Discount State
  const [wholeDiscountValue, setWholeDiscountValue] = useState("");
  const [wholeDiscountType, setWholeDiscountType] = useState<
    "fixed" | "percent"
  >("fixed");

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
    paymentMethod?: string | null;
    dueAmount?: number;
    previousDue?: number;
    totalDue?: number;
    vendorName?: string | null;
    vendorPanVat?: string | null;
  } | null>(null);

  const [printPurchaseId, setPrintPurchaseId] = useState<number | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isReturnsModalOpen, setIsReturnsModalOpen] = useState(false);
  const [packagingsByProduct, setPackagingsByProduct] = useState<
    Record<number, ProductPackaging[]>
  >({});

  const loadCatalog = () => {
    try {
      setProducts(getAllProducts());
      const allPkgs = getAllPackagings();
      const pMap: Record<number, ProductPackaging[]> = {};
      for (const p of allPkgs) {
        if (!pMap[p.product_id]) pMap[p.product_id] = [];
        pMap[p.product_id].push(p);
      }
      setPackagingsByProduct(pMap);
    } catch (e) {
      console.error("Error fetching catalog:", e);
    }
  };

  const handleSelectPackaging = (index: number, packagingId: number | null) => {
    const updated = [...cart];
    const item = updated[index];
    if (!item) return;

    if (packagingId === null) {
      item.packaging_id = null;
      item.package_multiplier = 1;
      item.packaging_name = null;
      item.cost_price = item.product.cost_price;
    } else {
      const pkg = packagingsByProduct[item.product.id]?.find(
        (x) => x.id === packagingId,
      );
      if (pkg) {
        item.packaging_id = pkg.id;
        item.package_multiplier = pkg.multiplier;
        item.packaging_name = pkg.package_name;
        item.cost_price = item.product.cost_price * pkg.multiplier;
      }
    }
    setCart(updated);
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

  const handleUpdateBatchNumber = (index: number, batchNo: string) => {
    const updated = [...cart];
    updated[index].batch_number = batchNo;
    setCart(updated);
  };

  const handleUpdateExpiryDate = (index: number, expiry: string) => {
    const updated = [...cart];
    updated[index].expiry_date = expiry;
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
    setPaymentMethod("Cash");
    setCustomPaymentMethod("");
    setWholeDiscountValue("");
    setWholeDiscountType("fixed");
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

  // Calculations
  const calculations = useMemo(() => {
    let subtotal = 0;
    let totalUnits = 0;

    const itemsForDiscount = cart.map((item) => {
      const gross = item.quantity * item.cost_price;
      subtotal += gross;
      totalUnits += item.quantity;
      return {
        gross,
        individualDiscount: 0,
      };
    });

    const rawWholeVal = parseFloat(wholeDiscountValue) || 0;
    let targetWholeDiscountMinor = 0;
    if (rawWholeVal > 0 && subtotal > 0) {
      if (wholeDiscountType === "percent") {
        targetWholeDiscountMinor = Math.round(
          (subtotal * Math.min(100, rawWholeVal)) / 100,
        );
      } else {
        targetWholeDiscountMinor = Math.min(
          subtotal,
          toMinorUnits(rawWholeVal),
        );
      }
    }

    const distributedResults = calculateProportionalDiscounts(
      itemsForDiscount,
      targetWholeDiscountMinor,
    );

    let totalAllocatedWholeDiscount = 0;

    const itemsWithDiscounts = cart.map((item, index) => {
      const gross = itemsForDiscount[index].gross;
      const result = distributedResults[index] || {
        allocatedWholeDiscount: 0,
        totalDiscount: 0,
        effectiveNet: gross,
      };

      totalAllocatedWholeDiscount += result.allocatedWholeDiscount;

      return {
        ...item,
        gross,
        individualDiscount: 0,
        allocatedWholeDiscount: result.allocatedWholeDiscount,
        effectiveTotalDiscount: result.allocatedWholeDiscount,
        netTotal: result.effectiveNet,
      };
    });

    const totalDiscount = totalAllocatedWholeDiscount;
    const taxableAmount = Math.max(0, subtotal - totalDiscount);
    const vatRate = applyVat ? 13.0 : 0.0;
    const vatAmount = applyVat ? Math.round(taxableAmount * 0.13) : 0;
    const grandTotal = taxableAmount + vatAmount;

    return {
      subtotal,
      wholeDiscountAmount: totalAllocatedWholeDiscount,
      totalDiscount,
      taxableAmount,
      vatRate,
      vatAmount,
      grandTotal,
      totalUnits,
      itemsWithDiscounts,
    };
  }, [cart, wholeDiscountValue, wholeDiscountType, applyVat]);

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
    const trimmed = paidAmountInput.trim();
    if (trimmed === "") return 0;
    const parsed = parseFloat(trimmed);
    if (isNaN(parsed) || parsed < 0) return 0;
    return toMinorUnits(parsed);
  }, [isCustomPaid, paidAmountInput, calculations.grandTotal]);

  const totalPayableOverall = calculations.grandTotal + vendorPreviousDue;
  const settlePreviousDue =
    vendorPreviousDue > 0 && effectivePaidAmount > calculations.grandTotal
      ? Math.min(
          effectivePaidAmount - calculations.grandTotal,
          vendorPreviousDue,
        )
      : 0;
  const remainingPreviousDue = vendorPreviousDue - settlePreviousDue;
  const currentBillDue = Math.max(
    0,
    calculations.grandTotal - effectivePaidAmount,
  );
  const changeToReturn = Math.max(0, effectivePaidAmount - totalPayableOverall);
  const totalVendorDue = currentBillDue + remainingPreviousDue;

  // Execute Purchase Transaction
  const handleCompletePurchase = () => {
    if (cart.length === 0) {
      showToast("Please add at least one product to the purchase", "warning");
      return;
    }

    try {
      const itemsInput = calculations.itemsWithDiscounts.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        costPrice: item.cost_price,
        sellingPrice: item.selling_price,
        discount: item.allocatedWholeDiscount,
        batchNumber: item.batch_number,
        expiryDate: item.expiry_date,
        mfgDate: item.mfg_date,
        packagingId: item.packaging_id,
        packageMultiplier: item.package_multiplier,
        packagingName: item.packaging_name,
      }));

      const finalPaymentMethod =
        paymentMethod === "Other" && customPaymentMethod.trim()
          ? customPaymentMethod.trim()
          : paymentMethod;

      const purchase = processPurchase(itemsInput, {
        vendorId: vendorData.vendorId || undefined,
        vendorName: vendorData.name.trim() || undefined,
        vendorPhone: vendorData.phone.trim() || undefined,
        vendorEmail: vendorData.email.trim() || undefined,
        vendorPanVat: vendorData.pan_vat.trim() || undefined,
        vendorAddress: vendorData.address.trim() || undefined,
        paidAmount: effectivePaidAmount,
        paymentMethod: finalPaymentMethod,
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
        paymentMethod: purchase.payment_method || finalPaymentMethod,
        dueAmount: purchase.due_amount ?? currentBillDue,
        previousDue: vendorPreviousDue,
        totalDue: totalVendorDue,
        vendorName: purchase.vendor_name,
        vendorPanVat: purchase.vendor_pan_vat,
      });

      handleClearCart();
      loadCatalog();
    } catch (err: unknown) {
      showToast((err as Error).message, "error", "Purchase Failed");
    }
  };

  const handleCompletePurchaseRef = useRef(handleCompletePurchase);
  useEffect(() => {
    handleCompletePurchaseRef.current = handleCompletePurchase;
  });

  // Keyboard shortcut listener (F2 or Ctrl+Enter to complete purchase)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModifier = e.ctrlKey || e.metaKey;
      if (e.key === "F2" || (isModifier && e.key === "Enter")) {
        if (cart.length > 0) {
          e.preventDefault();
          handleCompletePurchaseRef.current();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart]);

  // Batch selections in modal
  return (
    <div className="p-8 flex flex-col gap-6 animate-in fade-in duration-150 h-full min-h-0">
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
              <span className="text-[11px] text-neutral-400">
                {isNepali
                  ? "सामान थप्न क्लिक गर्नुहोस्"
                  : "Click item or + to add to purchase"}
              </span>
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
                  const inCartIndex = cart.findIndex(
                    (it) => it.product.id === p.id,
                  );
                  const inCartCount =
                    inCartIndex >= 0 ? cart[inCartIndex].quantity : 0;

                  return (
                    <div
                      key={p.id}
                      onClick={() => handleAddToCart(p, 1)}
                      className={`pt-2 flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer group select-none ${
                        inCartCount > 0
                          ? "bg-emerald-950/20 border-emerald-500/40 ring-1 ring-emerald-500/20"
                          : "bg-neutral-950/60 border-neutral-800/60 hover:bg-neutral-800/50 hover:border-neutral-700/60"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-semibold text-neutral-200 group-hover:text-emerald-300 flex items-center gap-1.5 truncate">
                          <span className="capitalize">{p.name}</span>
                          <span className="text-[10px] font-mono text-neutral-400 bg-neutral-800 px-1 rounded">
                            {p.unit || "pcs"}
                          </span>
                          {inCartCount > 0 && (
                            <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/30">
                              {inCartCount} in cart
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-neutral-400 font-mono">
                          <span>
                            Cost: {formatCurrency(p.cost_price, currencySymbol)}
                          </span>
                          <span>·</span>
                          <span>Stock: {p.current_stock}</span>
                        </div>
                      </div>

                      <div
                        className="shrink-0 flex items-center gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {inCartCount > 0 ? (
                          <div className="flex items-center bg-neutral-900 border border-emerald-500/40 rounded-lg p-0.5 shadow-xs">
                            <button
                              type="button"
                              onClick={() => {
                                if (inCartCount <= 1) {
                                  handleRemoveFromCart(inCartIndex);
                                } else {
                                  handleUpdateQuantity(
                                    inCartIndex,
                                    (inCartCount - 1).toString(),
                                  );
                                }
                              }}
                              className="w-7 h-7 flex items-center justify-center text-neutral-300 hover:text-white rounded hover:bg-neutral-800 transition-colors cursor-pointer"
                              title={
                                inCartCount <= 1
                                  ? isNepali
                                    ? "हटाउनुहोस्"
                                    : "Remove"
                                  : isNepali
                                    ? "घटाउनुहोस्"
                                    : "Decrease"
                              }
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={inCartCount}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (isNaN(val) || val <= 0) {
                                  handleRemoveFromCart(inCartIndex);
                                } else {
                                  handleUpdateQuantity(
                                    inCartIndex,
                                    val.toString(),
                                  );
                                }
                              }}
                              className="w-10 h-7 border-0 p-0 text-center text-xs font-mono font-bold text-emerald-300 bg-transparent focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateQuantity(
                                  inCartIndex,
                                  (inCartCount + 1).toString(),
                                )
                              }
                              className="w-7 h-7 flex items-center justify-center text-neutral-300 hover:text-white rounded hover:bg-neutral-800 transition-colors cursor-pointer"
                              title={isNepali ? "बढाउनुहोस्" : "Increase"}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddToCart(p, 1)}
                            className="px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-emerald-600 text-neutral-300 hover:text-white border border-neutral-800 hover:border-emerald-500 flex items-center gap-1 text-xs font-medium transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{isNepali ? "थप्नुहोस्" : "Add"}</span>
                          </button>
                        )}
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
            {/* Cart Header */}
            <div className="px-3.5 py-2.5 border-b border-neutral-800 bg-neutral-950/70 flex items-center justify-between flex-wrap gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-neutral-200">
                  {isNepali
                    ? "खरिद गरिने सामानहरूको सूची"
                    : "Current Purchase Line Items"}
                </span>
                <span className="text-[11px] text-neutral-400 font-mono ml-1">
                  ({cart.length} {cart.length === 1 ? "item" : "items"} ·{" "}
                  {calculations.totalUnits} units)
                </span>
              </div>

              <div className="flex items-center gap-1.5 self-start sm:self-auto flex-wrap">
                {/* Returns Button */}
                <button
                  type="button"
                  onClick={() => setIsReturnsModalOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-md shadow-xs transition-colors cursor-pointer"
                  title={
                    isNepali
                      ? "खरिद फिर्ता तथा डेबिट नोट"
                      : "Vendor Returns & Debit Note"
                  }
                >
                  <RotateCcw className="w-3 h-3 text-amber-400" />
                  <span>{isNepali ? "खरिद फिर्ता" : "Vendor Return"}</span>
                </button>

                {/* Clear Cart Button */}
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearCart}
                    className="p-1 text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer border border-transparent hover:border-rose-500/30"
                    title={isNepali ? "कार्ट खाली गर्नुहोस्" : "Clear cart"}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 1. Main Cart Items Listing (Allocates the whole available space) */}
            <div className="flex-1 min-h-0 p-3 pb-0 flex flex-col">
              <div className="flex-1 min-h-[160px] bg-neutral-950/80 border border-neutral-800/80 rounded-lg overflow-hidden flex flex-col">
                {cart.length === 0 ? (
                  <div className="p-8 text-center text-xs text-neutral-400 flex-1 min-h-0 flex flex-col items-center justify-center">
                    <Truck className="w-8 h-8 text-neutral-600 mb-2" />
                    <p className="max-w-xs">
                      {isNepali
                        ? "खरिद कार्ट खाली छ। बायाँतर्फबाट सामान छान्नुहोस् वा स्क्यान गर्नुहोस्।"
                        : "Purchase cart is empty. Click products from catalog on the left to add to purchase."}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-900/90 text-neutral-400 font-medium border-b border-neutral-800 sticky top-0 z-10 text-[11px]">
                        <tr>
                          <th className="py-1.5 px-3">
                            {isNepali ? "सामान" : "Item"}
                          </th>
                          <th className="py-1.5 px-2 text-center w-28">
                            {isNepali ? "परिमाण" : "Qty"}
                          </th>
                          <th className="py-1.5 px-2 text-right font-mono w-24">
                            {isNepali ? "खरिद दर" : "Cost Rate"}
                          </th>
                          <th className="py-1.5 px-3 text-right font-mono w-28">
                            {isNepali ? "कुल रकम" : "Line Total"}
                          </th>
                          <th className="py-1.5 px-2 text-center w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800/60">
                        {calculations.itemsWithDiscounts.map((item, index) => {
                          return (
                            <tr
                              key={item.product.id}
                              className="hover:bg-neutral-800/30 transition-colors"
                            >
                              {/* Product Info */}
                              <td className="py-2 px-3">
                                <div className="font-semibold text-neutral-200 capitalize flex items-center gap-1.5 flex-wrap">
                                  <span>{item.product.name}</span>
                                  <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-neutral-800 text-neutral-300 border border-neutral-700/60">
                                    {item.product.unit || "pcs"}
                                  </span>
                                  {item.packaging_name && (
                                    <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-semibold">
                                      {item.packaging_name} (×
                                      {item.package_multiplier})
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                                  Current Stock: {item.product.current_stock}{" "}
                                  {item.product.unit || "pcs"}
                                </div>

                                {/* Packaging & Batch Controls */}
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  {packagingsByProduct[item.product.id]
                                    ?.length > 0 && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] text-neutral-400 font-medium">
                                        {isNepali ? "एकाइ:" : "Unit:"}
                                      </span>
                                      <select
                                        value={item.packaging_id ?? ""}
                                        onChange={(e) => {
                                          const val = e.target.value
                                            ? parseInt(e.target.value, 10)
                                            : null;
                                          handleSelectPackaging(index, val);
                                        }}
                                        className="bg-neutral-900 border border-neutral-700/80 rounded px-1.5 py-0.5 text-[10px] text-cyan-300 font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
                                      >
                                        <option value="">
                                          Base ({item.product.unit || "pcs"})
                                        </option>
                                        {packagingsByProduct[
                                          item.product.id
                                        ].map((pkg) => (
                                          <option key={pkg.id} value={pkg.id}>
                                            {pkg.package_name} (×
                                            {pkg.multiplier})
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  )}

                                  {/* Batch Inputs */}
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="text"
                                      placeholder={
                                        isNepali ? "ब्याच नं." : "Batch #"
                                      }
                                      value={item.batch_number || ""}
                                      onChange={(e) =>
                                        handleUpdateBatchNumber(
                                          index,
                                          e.target.value,
                                        )
                                      }
                                      className="bg-neutral-900 border border-neutral-700/80 rounded px-1.5 py-0.5 text-[11px] text-neutral-200 placeholder:text-neutral-500 font-mono w-24 uppercase focus:border-amber-500/80 focus:outline-none h-6"
                                    />
                                    <input
                                      type="date"
                                      value={item.expiry_date || ""}
                                      onChange={(e) =>
                                        handleUpdateExpiryDate(
                                          index,
                                          e.target.value,
                                        )
                                      }
                                      className="bg-neutral-900 border border-neutral-700/80 rounded px-1.5 py-0.5 text-[10px] text-neutral-300 font-mono focus:border-amber-500/80 focus:outline-none h-6"
                                      title={
                                        isNepali
                                          ? "म्याद सकिने मिति"
                                          : "Expiry Date"
                                      }
                                    />
                                  </div>
                                </div>
                              </td>

                              {/* Qty with stepper */}
                              <td className="py-2 px-2 text-center">
                                <div className="flex items-center justify-center bg-neutral-950 border border-neutral-800 rounded-lg w-max mx-auto p-0.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (item.quantity <= 1) {
                                        handleRemoveFromCart(index);
                                      } else {
                                        handleUpdateQuantity(
                                          index,
                                          (item.quantity - 1).toString(),
                                        );
                                      }
                                    }}
                                    className="w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded transition-colors cursor-pointer"
                                    title={
                                      item.quantity <= 1
                                        ? isNepali
                                          ? "हटाउनुहोस्"
                                          : "Remove"
                                        : isNepali
                                          ? "घटाउनुहोस्"
                                          : "Decrease"
                                    }
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <input
                                    type="number"
                                    min="1"
                                    value={item.quantity}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value, 10);
                                      if (isNaN(val) || val <= 0) {
                                        handleRemoveFromCart(index);
                                      } else {
                                        handleUpdateQuantity(
                                          index,
                                          val.toString(),
                                        );
                                      }
                                    }}
                                    className="w-10 h-7 border-0 p-0 text-center text-xs font-mono font-bold text-neutral-100 bg-transparent focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateQuantity(
                                        index,
                                        (item.quantity + 1).toString(),
                                      )
                                    }
                                    className="w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded transition-colors cursor-pointer"
                                    title={isNepali ? "बढाउनुहोस्" : "Increase"}
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>

                              {/* Purchase Rate / Cost Price */}
                              <td className="py-2 px-2 text-right">
                                <Input
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={fromMinorUnits(item.cost_price)}
                                  onChange={(e) =>
                                    handleUpdateCostPrice(index, e.target.value)
                                  }
                                  containerClassName="w-20 ml-auto"
                                  className="px-1.5 py-1 text-right text-xs font-mono h-7"
                                />
                              </td>

                              {/* Line Total */}
                              <td className="py-2 px-3 text-right font-mono tabular-nums">
                                <div className="font-bold text-neutral-100">
                                  {formatCurrency(
                                    item.netTotal,
                                    currencySymbol,
                                  )}
                                </div>
                                {item.allocatedWholeDiscount > 0 && (
                                  <div className="text-[10px] font-normal text-amber-400 font-mono">
                                    -
                                    {formatCurrency(
                                      item.allocatedWholeDiscount,
                                      currencySymbol,
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* Remove */}
                              <td className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFromCart(index)}
                                  className="text-neutral-500 hover:text-rose-400 transition-colors p-1 rounded hover:bg-neutral-800 cursor-pointer"
                                  title="Remove item"
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
              </div>
            </div>

            {/* 2. Vendor Information & Two-Column Billing Grid */}
            <div className="shrink-0 p-3 pt-2.5 space-y-2.5 max-h-[46vh] overflow-y-auto border-t border-neutral-800/80 bg-neutral-900/40">
              {/* Vendor & Invoice Information Card */}
              <div className="p-3 bg-neutral-950/80 border border-neutral-800/80 rounded-lg space-y-2">
                <div className="flex flex-col md:flex-row md:items-stretch gap-2.5">
                  <div className="flex-1 min-w-0">
                    <VendorInputSection
                      value={vendorData}
                      onChange={setVendorData}
                    />
                  </div>

                  {/* Purchase Date & Time */}
                  <div className="w-full md:w-auto md:min-w-[270px] shrink-0 p-3 bg-neutral-900/60 border border-neutral-800 rounded-xl flex flex-col justify-between gap-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                          <Calendar className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-neutral-200">
                            {isNepali
                              ? "खरिद मिति र समय"
                              : "Purchase Date & Time"}
                          </div>
                          <p className="text-[10px] text-neutral-400">
                            {isNepali ? "बिल दर्ता मिति" : "Bill entry timestamp"}
                          </p>
                        </div>
                      </div>
                      {isCustomPurchaseDate && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-medium shrink-0">
                          {isNepali ? "कस्टम मिति" : "Backdated"}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <NepaliDatePicker
                          value={purchaseDateTime}
                          showTime={true}
                          sizeVariant="sm"
                          onChange={(adDateTime) =>
                            setPurchaseDateTime(adDateTime)
                          }
                        />
                      </div>
                      {isCustomPurchaseDate && (
                        <button
                          type="button"
                          onClick={() =>
                            setPurchaseDateTime(formatForDateTimeLocal())
                          }
                          className="px-2 py-1 text-[10px] font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded transition-colors cursor-pointer shrink-0"
                          title={
                            isNepali
                              ? "अहिलेको मितिमा फर्काउनुहोस्"
                              : "Reset to current date & time"
                          }
                        >
                          {isNepali ? "अहिले" : "Now"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                  <div>
                    <Input
                      label={
                        <span className="flex items-center gap-1 text-[11px]">
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
                      className="py-1 text-xs font-mono h-8"
                    />
                  </div>

                  <div>
                    <Input
                      label={
                        <span className="flex items-center gap-1 text-[11px]">
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
                          : "e.g. Received via delivery"
                      }
                      value={purchaseNotes}
                      onChange={(e) => setPurchaseNotes(e.target.value)}
                      className="py-1 text-xs h-8"
                    />
                  </div>
                </div>
              </div>

              {/* Two-Column Billing Layout on Desktop (xl:grid-cols-2) */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5 min-w-0">
                {/* Column 1: Discounts & Financial Summary */}
                <div className="space-y-2 min-w-0">
                  {/* Summary Breakdown Card */}
                  <div className="p-2.5 rounded-lg bg-neutral-950/80 border border-neutral-800/80 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-neutral-400">
                      <span>{isNepali ? "उप-जम्मा" : "Subtotal (Gross)"}</span>
                      <span className="font-mono text-neutral-200">
                        {formatCurrency(calculations.subtotal, currencySymbol)}
                      </span>
                    </div>

                    {calculations.totalDiscount > 0 && (
                      <div className="flex items-center justify-between text-neutral-300 font-semibold">
                        <span>{isNepali ? "बिल छुट" : "Bill Discount"}</span>
                        <span className="font-mono text-amber-400">
                          -
                          {formatCurrency(
                            calculations.totalDiscount,
                            currencySymbol,
                          )}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-neutral-400">
                      <span>{isNepali ? "करयोग्य रकम" : "Taxable Amount"}</span>
                      <span className="font-mono text-neutral-200">
                        {formatCurrency(
                          calculations.taxableAmount,
                          currencySymbol,
                        )}
                      </span>
                    </div>

                    {/* VAT Row with Toggle */}
                    <div className="flex items-center justify-between text-neutral-400 py-0.5">
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
                        <span>{isNepali ? "मूल्य अभिवृद्धि कर" : "VAT"}</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono ${applyVat ? "text-sky-400" : "text-neutral-500"}`}
                        >
                          {applyVat
                            ? `+${formatCurrency(calculations.vatAmount, currencySymbol)}`
                            : formatCurrency(0, currencySymbol)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setApplyVat(!applyVat)}
                          title={applyVat ? "Disable VAT" : "Apply 13% VAT"}
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded transition-all cursor-pointer border ${
                            applyVat
                              ? "bg-sky-500/20 text-sky-300 border-sky-500/30 hover:bg-sky-500/30"
                              : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200"
                          }`}
                        >
                          {applyVat ? "ON" : "OFF"}
                        </button>
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-neutral-800 flex items-center justify-between">
                      <span className="font-bold text-neutral-100">
                        {isNepali ? "कुल रकम (Grand Total)" : "Grand Total"}
                      </span>
                      <span className="text-base font-bold font-mono text-emerald-400 tabular-nums">
                        {formatCurrency(
                          calculations.grandTotal,
                          currencySymbol,
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Column 2: Payment, Presets & Payables / Vendor Due */}
                <div className="space-y-2 min-w-0">
                  {cart.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-neutral-950/80 border border-neutral-800/80 space-y-2.5">
                      {/* discount */}
                      {cart.length > 0 && (
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-xs font-semibold text-neutral-200 shrink-0">
                            {isNepali ? "सम्पूर्ण बिल छुट" : "Bill Discount"}
                          </span>

                          <div className="flex items-center gap-1.5">
                            <div className="relative">
                              <Input
                                type="number"
                                step={
                                  wholeDiscountType === "fixed" ? "0.01" : "1"
                                }
                                min="0"
                                max={
                                  wholeDiscountType === "percent"
                                    ? 100
                                    : undefined
                                }
                                placeholder={
                                  wholeDiscountType === "fixed"
                                    ? `Discount (${currencySymbol})`
                                    : "Discount %"
                                }
                                value={wholeDiscountValue}
                                onChange={(e) =>
                                  setWholeDiscountValue(e.target.value)
                                }
                                className="text-xs font-mono pr-7 focus:border-amber-500 h-7 w-28"
                              />
                              {wholeDiscountValue && (
                                <button
                                  type="button"
                                  onClick={() => setWholeDiscountValue("")}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-200 p-0.5 rounded cursor-pointer"
                                  title="Clear whole discount"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            <div className="flex bg-neutral-900 p-0.5 rounded-lg border border-neutral-800 text-[11px] shrink-0">
                              <button
                                type="button"
                                onClick={() => setWholeDiscountType("fixed")}
                                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                                  wholeDiscountType === "fixed"
                                    ? "bg-neutral-800 text-neutral-100 font-semibold"
                                    : "text-neutral-400 hover:text-neutral-200"
                                }`}
                              >
                                Fixed
                              </button>
                              <button
                                type="button"
                                onClick={() => setWholeDiscountType("percent")}
                                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                                  wholeDiscountType === "percent"
                                    ? "bg-neutral-800 text-neutral-100 font-semibold"
                                    : "text-neutral-400 hover:text-neutral-200"
                                }`}
                              >
                                %
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Paid Amount Input + Presets */}
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-xs font-semibold text-neutral-200 shrink-0">
                          {isNepali
                            ? "भुक्तानी रकम (Paid Amount)"
                            : "Paid Amount"}
                        </span>

                        {/* Presets */}
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          <div className="relative">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              placeholder={`Enter paid amount (${currencySymbol})...`}
                              value={
                                isCustomPaid
                                  ? paidAmountInput
                                  : fromMinorUnits(calculations.grandTotal)
                              }
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                setIsCustomPaid(true);
                                setPaidAmountInput(e.target.value);
                              }}
                              className="w-28 pl-7 pr-2.5 text-xs font-mono font-bold text-emerald-400 bg-neutral-900 border border-neutral-800 rounded-lg focus:outline-none focus:border-emerald-500 h-7"
                            />
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-neutral-500 pointer-events-none">
                              {currencySymbol}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setIsCustomPaid(false);
                              setPaidAmountInput("");
                              if (paymentMethod === "Credit / Khata") {
                                setPaymentMethod("Cash");
                              }
                            }}
                            className={`text-[10px] px-2 py-1 rounded font-medium transition-colors cursor-pointer border ${
                              !isCustomPaid ||
                              effectivePaidAmount === calculations.grandTotal
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-semibold"
                                : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200"
                            }`}
                          >
                            {isNepali ? "खरिद चुक्ता" : "Current Bill"}
                          </button>
                          {vendorPreviousDue > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsCustomPaid(true);
                                setPaidAmountInput(
                                  fromMinorUnits(
                                    totalPayableOverall,
                                  ).toString(),
                                );
                                if (paymentMethod === "Credit / Khata") {
                                  setPaymentMethod("Cash");
                                }
                              }}
                              className={`text-[10px] px-2 py-1 rounded font-medium transition-colors cursor-pointer border ${
                                isCustomPaid &&
                                effectivePaidAmount === totalPayableOverall
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/30 font-semibold"
                                  : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200"
                              }`}
                              title={
                                isNepali
                                  ? "साविक बक्यौता सहित सबै चुक्ता"
                                  : "Settle current bill + all previous vendor due"
                              }
                            >
                              {isNepali ? "सबै चुक्ता" : "Settle All"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setIsCustomPaid(true);
                              setPaidAmountInput("0");
                              setPaymentMethod("Credit / Khata");
                            }}
                            className={`text-[10px] px-2 py-1 rounded font-medium transition-colors cursor-pointer border ${
                              isCustomPaid && effectivePaidAmount === 0
                                ? "bg-rose-500/20 text-rose-300 border-rose-500/30 font-semibold"
                                : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200"
                            }`}
                            title={
                              isNepali
                                ? "कुनै रकम भुक्तान नगरी पूर्ण उधारो"
                                : "No payment now (Full Credit)"
                            }
                          >
                            {isNepali ? "उधारो (०)" : "Credit (0)"}
                          </button>
                        </div>
                      </div>

                      {/* Payment Mode Dropdown */}
                      <div className="flex items-center justify-between gap-1.5">
                        <label
                          htmlFor="purchases-payment-mode-select"
                          className="text-xs font-semibold text-neutral-200 shrink-0"
                        >
                          {isNepali
                            ? "भुक्तानी माध्यम (Payment Mode)"
                            : "Payment Mode"}
                        </label>
                        <div className="flex items-center gap-1.5">
                          <div className="relative">
                            <select
                              id="purchases-payment-mode-select"
                              value={paymentMethod}
                              onChange={(e) => {
                                const selected = e.target.value;
                                setPaymentMethod(selected);
                                if (
                                  selected === "Credit / Khata" &&
                                  (!isCustomPaid || effectivePaidAmount > 0)
                                ) {
                                  setIsCustomPaid(true);
                                  setPaidAmountInput("0");
                                } else if (
                                  selected !== "Credit / Khata" &&
                                  effectivePaidAmount === 0 &&
                                  isCustomPaid
                                ) {
                                  setIsCustomPaid(false);
                                  setPaidAmountInput("");
                                }
                              }}
                              className="w-40 pl-2.5 pr-8 text-xs font-semibold bg-neutral-900 border border-neutral-700 hover:border-neutral-600 rounded-lg text-neutral-100 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer appearance-none h-7"
                            >
                              {PAYMENT_MODE_OPTIONS.map((m) => (
                                <option
                                  key={m.id}
                                  value={m.id}
                                  className="bg-neutral-900 text-neutral-100"
                                >
                                  {isNepali
                                    ? `${m.labelNp} (${m.labelEn})`
                                    : m.labelEn}
                                </option>
                              ))}
                              <option
                                value="Other"
                                className="bg-neutral-900 text-neutral-100"
                              >
                                {isNepali
                                  ? "अन्य (Other / Custom)..."
                                  : "Other (Custom)..."}
                              </option>
                            </select>
                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                              <svg
                                className="w-4 h-4 fill-current"
                                viewBox="0 0 20 20"
                              >
                                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                              </svg>
                            </div>
                          </div>
                          {paymentMethod === "Other" && (
                            <input
                              type="text"
                              placeholder={
                                isNepali
                                  ? "माध्यम..."
                                  : "Specify mode..."
                              }
                              value={customPaymentMethod}
                              onChange={(e) =>
                                setCustomPaymentMethod(e.target.value)
                              }
                              className="w-28 px-2 text-xs bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:border-emerald-500 placeholder-neutral-500 h-7"
                              autoFocus
                            />
                          )}
                        </div>
                      </div>

                      {/* Due Breakdown Summary */}
                      <div className="space-y-1 text-xs pt-1 border-t border-neutral-800/80">
                        {changeToReturn > 0 && (
                          <div className="flex items-center justify-between text-emerald-400">
                            <span>
                              {isNepali
                                ? "फिर्ता गर्नुपर्ने रकम"
                                : "Change to Return"}
                              :
                            </span>
                            <span className="font-mono font-bold">
                              {formatCurrency(changeToReturn, currencySymbol)}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-neutral-300">
                          <span>
                            {isNepali
                              ? "यस खरिदको बाँकी"
                              : "Current Purchase Due"}
                            :
                          </span>
                          <span
                            className={`font-mono font-bold ${currentBillDue > 0 ? "text-rose-400" : "text-neutral-400"}`}
                          >
                            {formatCurrency(currentBillDue, currencySymbol)}
                          </span>
                        </div>

                        {settlePreviousDue > 0 && (
                          <div className="flex items-center justify-between text-emerald-400">
                            <span>
                              {isNepali
                                ? "साविक बक्यौता भुक्तानी"
                                : "Prev. Due Settled"}
                              :
                            </span>
                            <span className="font-mono font-bold">
                              -
                              {formatCurrency(
                                settlePreviousDue,
                                currencySymbol,
                              )}
                            </span>
                          </div>
                        )}

                        {vendorPreviousDue > 0 && (
                          <div className="flex items-center justify-between text-amber-400">
                            <span>
                              {isNepali ? "साविकको बाँकी" : "Previous Due"}:
                            </span>
                            <span className="font-mono font-bold">
                              {formatCurrency(
                                remainingPreviousDue,
                                currencySymbol,
                              )}
                            </span>
                          </div>
                        )}

                        {(remainingPreviousDue > 0 || currentBillDue > 0) && (
                          <div className="flex items-center justify-between text-neutral-100 font-bold border-t border-neutral-800 pt-1 mt-0.5">
                            <span className="text-xs">
                              {isNepali
                                ? "कुल तिर्न बाँकी"
                                : "Total Payable Due"}
                              :
                            </span>
                            <span className="font-mono text-xs font-bold text-rose-400">
                              {formatCurrency(totalVendorDue, currencySymbol)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sticky Footer: Bottom Summary & Complete Purchase Action */}
            <div className="shrink-0 border-t border-neutral-800 bg-neutral-950/95 px-3.5 py-2.5 backdrop-blur-md">
              <div className="flex items-center justify-between gap-3">
                {/* Left: Compact billing summary */}
                <div className="flex items-center gap-3 min-w-0">
                  <div>
                    <div className="text-[10px] uppercase font-semibold text-neutral-400 leading-tight">
                      {isNepali ? "कुल रकम" : "Grand Total"}
                    </div>
                    <div className="text-base font-bold font-mono text-emerald-400 tabular-nums">
                      {formatCurrency(calculations.grandTotal, currencySymbol)}
                    </div>
                  </div>

                  <div className="h-7 w-[1px] bg-neutral-800 hidden sm:block" />

                  <div className="hidden sm:block text-xs">
                    <div className="text-[10px] text-neutral-400 flex items-center gap-1.5">
                      <span>{isNepali ? "माध्यम:" : "Mode:"}</span>
                      <span className="font-semibold text-neutral-200">
                        {paymentMethod}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] font-bold">
                      {effectivePaidAmount >= calculations.grandTotal ? (
                        <span className="text-emerald-400">
                          {isNepali ? "पूर्ण चुक्ता" : "Fully Paid"}
                        </span>
                      ) : (
                        <span className="text-rose-400">
                          {isNepali ? "बाँकी" : "Due"}:{" "}
                          {formatCurrency(currentBillDue, currencySymbol)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Primary Complete Action Button */}
                <button
                  type="button"
                  disabled={cart.length === 0}
                  onClick={handleCompletePurchase}
                  className={`py-2 px-4 rounded-lg text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0 ${
                    cart.length === 0
                      ? "bg-neutral-800 text-neutral-500 cursor-not-allowed shadow-none"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white active:scale-[0.99]"
                  }`}
                  title="Complete purchase and add stock (F2 or Enter)"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>
                    {isNepali ? "खरिद सम्पन्न" : "Complete Purchase"} (
                    {formatCurrency(calculations.grandTotal, currencySymbol)})
                  </span>
                  <kbd className="hidden sm:inline-block px-1.5 py-0.2 text-[10px] font-mono rounded bg-emerald-700/80 text-emerald-100 border border-emerald-500/40">
                    F2
                  </kbd>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Completed Purchase Notification Banner */}
      {completedPurchaseInfo && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-neutral-100 flex items-center flex-wrap gap-x-2">
                <span>
                  Purchase #
                  {completedPurchaseInfo.billNumber || completedPurchaseInfo.id}{" "}
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
                {formatCurrency(completedPurchaseInfo.total, currencySymbol)}
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
                    <span className="text-neutral-400 text-[11px] ml-1">
                      ({completedPurchaseInfo.paymentMethod || "Cash"})
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

      {/* Returns & Credit/Debit Notes Modal */}
      <ReturnsModal
        isOpen={isReturnsModalOpen}
        onClose={() => setIsReturnsModalOpen(false)}
        currencySymbol={currencySymbol}
        initialMode="PURCHASE"
      />
    </div>
  );
};
