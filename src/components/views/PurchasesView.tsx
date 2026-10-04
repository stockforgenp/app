/**
 * Purchases Management & Inflow POS View
 * Implements multi-product purchase transactions, snapshot cost prices,
 * stock inflow increments, vendor auto-fill/creation, 13% VAT, and sequential bill numbers.
 */
import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  PackagePlus,
  Percent,
  Printer,
  Eye,
  FileText,
  DollarSign,
  Package,
} from "lucide-react";
import {
  Product,
  Purchase,
  PurchaseItem,
  PurchaseCartItem,
} from "../../types/index.ts";
import { getAllProducts } from "../../lib/services/productService.ts";
import {
  processPurchase,
  getPurchases,
  getPurchaseWithItems,
} from "../../lib/services/purchaseService.ts";
import {
  VendorInputSection,
  VendorInputData,
} from "../common/VendorInputSection.tsx";
import { PrintPurchaseBillModal } from "../common/PrintPurchaseBillModal.tsx";
import { Modal } from "../common/Modal.tsx";
import { ActionMenu } from "../common/ActionMenu.tsx";
import { Input } from "../common/Input.tsx";
import { DateFilterBar } from "../common/DateFilterBar.tsx";
import { DataTable, Column } from "../common/DataTable.tsx";
import { DatePreset } from "../../lib/utils/dateFilters.ts";
import {
  formatCurrency,
  toMinorUnits,
  fromMinorUnits,
  formatDateTime,
} from "../../lib/utils/format.ts";
import { useToast } from "../../context/ToastContext.tsx";
import { subscribeToDbChanges } from "../../lib/db/sqliteEngine.ts";
import { MODIFIER_LABEL } from "../../lib/hooks/useGlobalShortcuts.ts";
import { useLanguage } from "../../context/LanguageContext.tsx";

interface PurchasesViewProps {
  currencySymbol: string;
  onOpenCreateProduct?: () => void;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  currencySymbol,
  onOpenCreateProduct,
}) => {
  const { showToast } = useToast();
  const { t, isNepali, formatNumberByLang } = useLanguage();

  // Active Tab: 'new' (Inflow POS) | 'history' (Bills & Audit Log)
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");

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
  const [modalTab, setModalTab] = useState<"checklist" | "bulkSku">(
    "checklist",
  );
  const [bulkSkuInput, setBulkSkuInput] = useState("");
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
    vendorName?: string | null;
    vendorPanVat?: string | null;
  } | null>(null);

  const [printPurchaseId, setPrintPurchaseId] = useState<number | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Purchase History State
  const [historyList, setHistoryList] = useState<Purchase[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [historyDatePreset, setHistoryDatePreset] = useState<DatePreset>("all");
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");
  const [inspectPurchaseDetail, setInspectPurchaseDetail] = useState<{
    purchase: Purchase;
    items: PurchaseItem[];
  } | null>(null);

  const loadCatalog = () => {
    try {
      setProducts(getAllProducts());
    } catch (e) {
      console.error("Error fetching catalog:", e);
    }
  };

  const loadHistory = () => {
    try {
      const opts: { startDate?: string; endDate?: string; search?: string } =
        {};
      if (historyStartDate)
        opts.startDate = `${historyStartDate}T00:00:00.000Z`;
      if (historyEndDate) opts.endDate = `${historyEndDate}T23:59:59.999Z`;
      if (historySearch) opts.search = historySearch;
      setHistoryList(getPurchases(opts));
    } catch (e) {
      console.error("Error loading purchase history:", e);
    }
  };

  useEffect(() => {
    loadCatalog();
    loadHistory();
    const unsubscribe = subscribeToDbChanges(() => {
      loadCatalog();
      loadHistory();
    });
    return unsubscribe;
  }, [historyStartDate, historyEndDate, historySearch]);

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

  const handleUpdateSellingPrice = (index: number, priceStr: string) => {
    const updated = [...cart];
    updated[index].selling_price = toMinorUnits(priceStr);
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
    setVendorData({
      vendorId: null,
      name: "",
      pan_vat: "",
      phone: "",
      email: "",
      address: "",
      isNew: false,
    });
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
    const vatAmount = Math.round(taxableAmount * 0.13);
    const grandTotal = taxableAmount + vatAmount;

    return {
      subtotal,
      totalDiscount,
      taxableAmount,
      vatAmount,
      grandTotal,
      totalUnits,
    };
  }, [cart]);

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
        invoiceNumber: supplierInvoiceNo.trim() || undefined,
        notes: purchaseNotes.trim() || undefined,
        vendorInput: vendorData.isNew
          ? {
              name: vendorData.name.trim(),
              phone: vendorData.phone.trim() || undefined,
              email: vendorData.email.trim() || undefined,
              pan_vat: vendorData.pan_vat.trim() || undefined,
              address: vendorData.address.trim() || undefined,
            }
          : undefined,
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
        vendorName: purchase.vendor_name,
        vendorPanVat: purchase.vendor_pan_vat,
      });

      setPrintPurchaseId(purchase.id);
      setIsPrintModalOpen(true);

      handleClearCart();
      loadCatalog();
      loadHistory();
    } catch (err: unknown) {
      showToast((err as Error).message, "error", "Purchase Failed");
    }
  };

  // Keyboard shortcut listener (F2 or Ctrl+Enter to complete purchase)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModifier = e.ctrlKey || e.metaKey;
      if (
        activeTab === "new" &&
        (e.key === "F2" || (isModifier && e.key === "Enter"))
      ) {
        if (cart.length > 0) {
          e.preventDefault();
          handleCompletePurchase();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, cart, calculations, vendorData, supplierInvoiceNo]);

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

  const handleInspectPurchase = (purchaseId: number) => {
    const loaded = getPurchaseWithItems(purchaseId);
    if (loaded) {
      setInspectPurchaseDetail(loaded);
    }
  };

  // Metrics summary for purchase history
  const historyStats = useMemo(() => {
    const totalCount = historyList.length;
    const totalSpend = historyList.reduce(
      (acc, p) => acc + (p.grand_total || p.total),
      0,
    );
    const totalUnitsInflow = historyList.reduce(
      (acc, p) => acc + (p.total_units || 0),
      0,
    );
    const vatTotal = historyList.reduce(
      (acc, p) => acc + (p.vat_amount || 0),
      0,
    );
    return { totalCount, totalSpend, totalUnitsInflow, vatTotal };
  }, [historyList]);

  const historyColumns: Column<Purchase>[] = useMemo(
    () => [
      {
        id: "bill_number",
        header: isNepali ? "बिल नं" : "Bill No",
        sortable: true,
        accessor: (p) => (
          <div className="font-mono text-neutral-200">
            <div className="font-bold">{p.bill_number || `PUR-${p.id}`}</div>
            {p.invoice_number && (
              <div className="text-[10px] text-neutral-400 font-normal">
                Inv: {p.invoice_number}
              </div>
            )}
          </div>
        ),
      },
      {
        id: "created_at",
        header: isNepali ? "मिति" : "Date & Time",
        sortable: true,
        accessor: (p) => (
          <span className="font-mono text-neutral-400 whitespace-nowrap">
            {formatDateTime(p.created_at)}
          </span>
        ),
      },
      {
        id: "vendor_name",
        header: isNepali ? "आपूर्तिकर्ता" : "Vendor / Supplier",
        sortable: true,
        accessor: (p) =>
          p.vendor_name ? (
            <div>
              <div className="font-semibold text-neutral-200">
                {p.vendor_name}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-neutral-400 mt-0.5">
                {p.vendor_pan_vat && (
                  <span className="font-mono text-emerald-400">
                    PAN: {p.vendor_pan_vat}
                  </span>
                )}
                {p.vendor_phone && <span>{p.vendor_phone}</span>}
              </div>
            </div>
          ) : (
            <span className="text-neutral-500 italic">General Supplier</span>
          ),
      },
      {
        id: "item_count",
        header: isNepali ? "सामान" : "Items",
        align: "center",
        sortable: true,
        accessor: (p) => (
          <span className="font-mono text-neutral-300">
            {p.item_count || 1}
          </span>
        ),
      },
      {
        id: "subtotal",
        header: isNepali ? "उप-जम्मा" : "Subtotal",
        align: "right",
        sortable: true,
        accessor: (p) => (
          <span className="font-mono text-neutral-400 tabular-nums">
            {formatCurrency(p.subtotal, currencySymbol)}
          </span>
        ),
      },
      {
        id: "vat_amount",
        header: isNepali ? "१३% भ्याट" : "13% VAT",
        align: "right",
        sortable: true,
        accessor: (p) => (
          <span className="font-mono text-sky-400 tabular-nums">
            +{formatCurrency(p.vat_amount || 0, currencySymbol)}
          </span>
        ),
      },
      {
        id: "grand_total",
        header: isNepali ? "कुल रकम" : "Grand Total",
        align: "right",
        sortable: true,
        accessor: (p) => (
          <span className="font-mono font-bold text-neutral-100 tabular-nums">
            {formatCurrency(p.grand_total || p.total, currencySymbol)}
          </span>
        ),
      },
      {
        id: "actions",
        header: isNepali ? "कार्य" : "Actions",
        align: "right",
        width: "90px",
        accessor: (p) => (
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => handleInspectPurchase(p.id)}
              className="p-1.5 text-neutral-400 hover:text-sky-400 hover:bg-neutral-800 rounded-md transition-colors cursor-pointer"
              title={isNepali ? "विवरण हेर्नुहोस्" : "Inspect Purchase"}
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setPrintPurchaseId(p.id);
                setIsPrintModalOpen(true);
              }}
              className="p-1.5 text-neutral-400 hover:text-emerald-400 hover:bg-neutral-800 rounded-md transition-colors cursor-pointer"
              title={isNepali ? "बिल छाप्नुहोस्" : "Print Bill"}
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
          </div>
        ),
      },
    ],
    [isNepali, currencySymbol],
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-150 p-8">
      {/* Top Header & Tab Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
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
          {/* Tab Switcher */}
          <div className="flex items-center bg-neutral-900 p-1 rounded-xl border border-neutral-800 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("new")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === "new"
                  ? "bg-neutral-800 text-neutral-100 font-semibold shadow-xs"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <PackagePlus className="w-3.5 h-3.5" />
              <span>
                {isNepali ? "नयाँ खरिद (New Purchase)" : "New Purchase"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === "history"
                  ? "bg-neutral-800 text-neutral-100 font-semibold shadow-xs"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>
                {isNepali ? "खरिद बिल इतिहास (Invoices)" : "Purchase History"}
              </span>
            </button>
          </div>

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

      {activeTab === "new" ? (
        /* ================= NEW PURCHASE (INFLOW POS) ================= */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Product Selection & Catalog (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3.5">
              <div className="flex items-center justify-between">
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
              <div>
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
              <div className="flex gap-2">
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
              <div className="max-h-[500px] overflow-y-auto space-y-2 pr-1 divide-y divide-neutral-800/40">
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
                              Cost:{" "}
                              {formatCurrency(p.cost_price, currencySymbol)}
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
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden flex flex-col">
              {/* Header */}
              <div className="px-5 py-3.5 border-b border-neutral-800 bg-neutral-950/60 flex items-center justify-between flex-wrap gap-2">
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
              <div className="p-3 bg-neutral-950/80 border-b border-neutral-800/80">
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
                <div className="p-12 text-center text-xs text-neutral-400">
                  <Truck className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                  {isNepali
                    ? "खरिद कार्ट खाली छ। बाँयातर्फबाट सामान छान्नुहोस् वा स्क्यान गर्नुहोस्।"
                    : "Purchase cart is empty. Click products from catalog or scan SKUs above."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-950 text-neutral-400 font-medium border-b border-neutral-800">
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
              <div className="p-4 bg-neutral-950/70 border-t border-neutral-800 space-y-3">
                <VendorInputSection
                  value={vendorData}
                  onChange={setVendorData}
                />

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
              <div className="p-5 bg-neutral-950 border-t border-neutral-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span>
                    {isNepali
                      ? "उप-जम्मा (Gross Subtotal)"
                      : "Subtotal (Gross)"}
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
                      {formatCurrency(
                        calculations.totalDiscount,
                        currencySymbol,
                      )}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span>
                    {isNepali
                      ? "करयोग्य रकम (Taxable Amount)"
                      : "Taxable Amount"}
                  </span>
                  <span className="font-mono text-neutral-300">
                    {formatCurrency(calculations.taxableAmount, currencySymbol)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-400 text-[10px] font-medium border border-sky-500/20">
                      13% VAT
                    </span>
                    <span>{isNepali ? "मूल्य अभिवृद्धि कर" : "VAT (13%)"}</span>
                  </span>
                  <span className="font-mono text-sky-400">
                    + {formatCurrency(calculations.vatAmount, currencySymbol)}
                  </span>
                </div>

                <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-neutral-100">
                      {isNepali
                        ? "अन्तिम कुल खरिद रकम"
                        : "Grand Total (Inc. 13% VAT)"}
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
                      ({formatCurrency(calculations.grandTotal, currencySymbol)}
                      )
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
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between">
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
      ) : (
        /* ================= PURCHASE HISTORY (BILLS & AUDIT LOG) ================= */
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-400 font-medium">
                  {isNepali ? "कुल खरिद अर्डरहरू" : "Total Purchase Orders"}
                </p>
                <p className="text-2xl font-bold text-neutral-100 mt-1">
                  {formatNumberByLang(historyStats.totalCount)}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-400 font-medium">
                  {isNepali
                    ? "दाखिला भएको सामान (एकाइ)"
                    : "Total Received Units"}
                </p>
                <p className="text-2xl font-bold text-sky-400 mt-1">
                  {formatNumberByLang(historyStats.totalUnitsInflow)}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
                <Package className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-400 font-medium">
                  {isNepali ? "खरिद भ्याट (१३% VAT)" : "Purchase Input VAT"}
                </p>
                <p className="text-xl font-bold font-mono text-amber-400 mt-1">
                  {formatCurrency(historyStats.vatTotal, currencySymbol)}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-400 font-medium">
                  {isNepali ? "कुल खरिद खर्च" : "Total Purchase Spend"}
                </p>
                <p className="text-xl font-bold font-mono text-emerald-400 mt-1">
                  {formatCurrency(historyStats.totalSpend, currencySymbol)}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Unified Shared DataTable with Search, Date Filter, Sorting, and Pagination */}
          <DataTable<Purchase>
            data={historyList}
            columns={historyColumns}
            searchQuery={historySearch}
            onSearchChange={setHistorySearch}
            searchPlaceholder={
              isNepali
                ? "खरिद बिल नं, आपूर्तिकर्ताको नाम, PAN वा सप्लायर इनभ्वाइस खोज्नुहोस्..."
                : "Search by purchase bill #, vendor name, PAN/VAT, or supplier invoice..."
            }
            dateFilterConfig={{
              preset: historyDatePreset,
              onPresetChange: (p, start, end) => {
                setHistoryDatePreset(p);
                setHistoryStartDate(start);
                setHistoryEndDate(end);
              },
              startDate: historyStartDate,
              endDate: historyEndDate,
              onStartDateChange: setHistoryStartDate,
              onEndDateChange: setHistoryEndDate,
              hasActiveFilters: Boolean(
                historyStartDate ||
                historyEndDate ||
                historySearch ||
                historyDatePreset !== "all",
              ),
              onClear: () => {
                setHistoryDatePreset("all");
                setHistoryStartDate("");
                setHistoryEndDate("");
                setHistorySearch("");
              },
            }}
            emptyIcon={Truck}
            emptyTitle={
              isNepali ? "कुनै खरिद विवरण भेटिएन।" : "No purchases found."
            }
            enablePagination={true}
            pageSize={10}
            pageSizeOptions={[10, 25, 50, 100]}
          />
        </div>
      )}

      {/* Inspect Purchase Modal */}
      <Modal
        isOpen={inspectPurchaseDetail !== null}
        onClose={() => setInspectPurchaseDetail(null)}
        title={
          inspectPurchaseDetail
            ? `Purchase #${inspectPurchaseDetail.purchase.bill_number || inspectPurchaseDetail.purchase.id}`
            : "Purchase Details"
        }
        subtitle="Snapshot purchase order and received inventory line items"
        maxWidth="2xl"
      >
        {inspectPurchaseDetail && (
          <div className="space-y-4">
            <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-neutral-400 mr-2">
                  {isNepali ? "आपूर्तिकर्ता:" : "Vendor:"}
                </span>
                <span className="font-semibold text-neutral-200">
                  {inspectPurchaseDetail.purchase.vendor_name ||
                    "General Supplier"}
                </span>
                {inspectPurchaseDetail.purchase.vendor_pan_vat && (
                  <span className="ml-2 font-mono text-emerald-400">
                    (PAN: {inspectPurchaseDetail.purchase.vendor_pan_vat})
                  </span>
                )}
              </div>
              <div className="text-neutral-400 font-mono">
                {formatDateTime(inspectPurchaseDetail.purchase.created_at)}
              </div>
            </div>

            {/* Line items table */}
            <div className="border border-neutral-800 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950 text-neutral-400 font-medium border-b border-neutral-800">
                  <tr>
                    <th className="py-2.5 px-4">
                      {isNepali ? "सामान" : "Item"}
                    </th>
                    <th className="py-2.5 px-2 text-center font-mono">
                      {isNepali ? "परिमाण" : "Qty"}
                    </th>
                    <th className="py-2.5 px-3 text-right font-mono">
                      {isNepali ? "दर" : "Rate"}
                    </th>
                    <th className="py-2.5 px-3 text-right font-mono">
                      {isNepali ? "छुट" : "Discount"}
                    </th>
                    <th className="py-2.5 px-4 text-right font-mono">
                      {isNepali ? "जम्मा" : "Total"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {inspectPurchaseDetail.items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-neutral-200">
                          {it.product_name}
                        </div>
                        {it.product_sku && (
                          <div className="text-[10px] text-neutral-500 font-mono">
                            SKU: {it.product_sku}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono">
                        {it.quantity} {it.product_unit || ""}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {formatCurrency(it.cost_price, currencySymbol)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-400">
                        {it.discount > 0
                          ? `- ${formatCurrency(it.discount, currencySymbol)}`
                          : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-neutral-100">
                        {formatCurrency(it.total, currencySymbol)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-neutral-400">
                <span>Subtotal:</span>
                <span className="font-mono text-neutral-200">
                  {formatCurrency(
                    inspectPurchaseDetail.purchase.subtotal,
                    currencySymbol,
                  )}
                </span>
              </div>
              {inspectPurchaseDetail.purchase.discount > 0 && (
                <div className="flex justify-between text-amber-400">
                  <span>Discount:</span>
                  <span className="font-mono">
                    -
                    {formatCurrency(
                      inspectPurchaseDetail.purchase.discount,
                      currencySymbol,
                    )}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sky-400">
                <span>13% VAT:</span>
                <span className="font-mono">
                  +
                  {formatCurrency(
                    inspectPurchaseDetail.purchase.vat_amount || 0,
                    currencySymbol,
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold text-neutral-100 pt-1 border-t border-neutral-800">
                <span>Grand Total:</span>
                <span className="font-mono text-emerald-400">
                  {formatCurrency(
                    inspectPurchaseDetail.purchase.grand_total ||
                      inspectPurchaseDetail.purchase.total,
                    currencySymbol,
                  )}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setPrintPurchaseId(inspectPurchaseDetail.purchase.id);
                  setIsPrintModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{isNepali ? "बिल छाप्नुहोस्" : "Print Bill"}</span>
              </button>

              <button
                type="button"
                onClick={() => setInspectPurchaseDetail(null)}
                className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium cursor-pointer"
              >
                {isNepali ? "बन्द गर्नुहोस्" : "Close"}
              </button>
            </div>
          </div>
        )}
      </Modal>

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
