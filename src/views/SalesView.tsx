/**
 * Sales POS / New Sale Checkout View
 * Implements Sections 4, 5, 6:
 * - Multi-product transaction
 * - Default vs Actual sale price per item
 * - Absolute monetary discount per item
 * - Real-time stock validation (prevents negative stock if setting is OFF)
 * - Complete transactional checkout with snapshot cost prices
 */
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Receipt,
  RotateCcw,
  Minus,
  Printer,
  X,
  Calendar,
} from "lucide-react";
import {
  Product,
  CartItem,
  ProductBatch,
  ProductPackaging,
} from "../types/index.ts";
import { getAllProducts } from "../lib/services/productService.ts";
import { processSale } from "../lib/services/salesService.ts";
import { getAllBatches } from "../lib/services/batchService.ts";
import { getAllPackagings } from "../lib/services/packagingService.ts";
import { getCustomerTotalDue } from "../lib/services/customerService.ts";
import { calculateProportionalDiscounts } from "../helpers/index.ts";
import {
  formatCurrency,
  formatDateTime,
  fromMinorUnits,
  toMinorUnits,
  formatForDateTimeLocal,
  parseDateTimeLocalToIso,
} from "../lib/utils/format.ts";
import { useToast } from "../context/ToastContext.tsx";
import { subscribeToDbChanges } from "../lib/db/sqliteEngine.ts";
import { MODIFIER_LABEL } from "../lib/hooks/useGlobalShortcuts.ts";
import { PrintBillModal } from "../components/common/PrintBillModal.tsx";
import { ReturnsModal } from "../components/common/ReturnsModal.tsx";
import { ShiftManagementModal } from "../components/common/ShiftManagementModal.tsx";
import { getCurrentOpenShift } from "../lib/services/shiftService.ts";
import { Input } from "../components/common/Input.tsx";
import {
  CustomerInputSection,
  CustomerInputData,
} from "../components/common/CustomerInputSection.tsx";
import { NepaliDatePicker } from "../components/common/NepaliDatePicker.tsx";
import { useLanguage } from "../context/LanguageContext.tsx";
import { PAYMENT_MODE_OPTIONS } from "../constants/index.ts";

interface SalesViewProps {
  currencySymbol: string;
  allowNegativeStock: boolean;
  enableVat?: boolean;
  onSaleCompleted: (saleId: number) => void;
  initialProducts?: Array<{ product: Product; quantity?: number }>;
  onClearInitialProducts?: () => void;
  onRestockProduct?: (product: Product) => void;
}

export const SalesView: React.FC<SalesViewProps> = ({
  currencySymbol,
  allowNegativeStock,
  enableVat = true,
  onSaleCompleted,
  initialProducts,
  onClearInitialProducts,
  onRestockProduct,
}) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t, isNepali, formatNumberByLang } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<
    "all" | "inStock" | "lowStock"
  >("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [batchesByProduct, setBatchesByProduct] = useState<
    Record<number, ProductBatch[]>
  >({});
  const [packagingsByProduct, setPackagingsByProduct] = useState<
    Record<number, ProductPackaging[]>
  >({});
  const [customerData, setCustomerData] = useState<CustomerInputData>({
    customerId: null,
    name: "",
    phone: "",
    pan_vat: "",
    address: "",
    isNew: false,
  });
  const [saleDateTime, setSaleDateTime] = useState<string>(() =>
    formatForDateTimeLocal(),
  );

  const isCustomSaleDate = useMemo(() => {
    if (!saleDateTime) return false;
    const todayYmd = formatForDateTimeLocal().split("T")[0];
    return saleDateTime.split("T")[0] !== todayYmd;
  }, [saleDateTime]);
  const [completedSaleInfo, setCompletedSaleInfo] = useState<{
    id: number;
    billNumber?: string | null;
    subtotal: number;
    discount: number;
    taxableAmount?: number;
    vatAmount?: number;
    grandTotal?: number;
    total: number;
    paidAmount?: number;
    paymentMethod?: string | null;
    dueAmount?: number;
    previousDue?: number;
    totalDue?: number;
    customerName?: string | null;
    customerPhone?: string | null;
    customerPanVat?: string | null;
  } | null>(null);

  // Partial Payment & Dues State
  const [paidAmountInput, setPaidAmountInput] = useState("");
  const [isCustomPaid, setIsCustomPaid] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash");
  const [customPaymentMethod, setCustomPaymentMethod] = useState("");

  // Bill Printing modal
  const [printSaleId, setPrintSaleId] = useState<number | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Whole / Overall Sale Discount State (proportionally divided across line items)
  const [wholeDiscountValue, setWholeDiscountValue] = useState("");
  const [wholeDiscountType, setWholeDiscountType] = useState<
    "fixed" | "percent"
  >("fixed");

  // Active VAT calculation toggle for the sale (defaults to store-level enableVat setting)
  const [applyVat, setApplyVat] = useState(enableVat !== false);

  useEffect(() => {
    setApplyVat(enableVat !== false);
  }, [enableVat]);

  const [isReturnsModalOpen, setIsReturnsModalOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [activeShift, setActiveShift] = useState<any>(() => {
    try {
      return getCurrentOpenShift();
    } catch {
      return null;
    }
  });

  const quickSkuInputRef = useRef<HTMLInputElement>(null);

  const loadCatalog = () => {
    try {
      setProducts(getAllProducts());
      const allBatches = getAllBatches({ includeEmpty: false });
      const bMap: Record<number, ProductBatch[]> = {};
      for (const b of allBatches) {
        if (!bMap[b.product_id]) bMap[b.product_id] = [];
        bMap[b.product_id].push(b);
      }
      setBatchesByProduct(bMap);

      const allPkgs = getAllPackagings();
      const pMap: Record<number, ProductPackaging[]> = {};
      for (const p of allPkgs) {
        if (!pMap[p.product_id]) pMap[p.product_id] = [];
        pMap[p.product_id].push(p);
      }
      setPackagingsByProduct(pMap);

      try {
        setActiveShift(getCurrentOpenShift());
      } catch {}
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
      item.actual_selling_price = item.product.selling_price;
    } else {
      const pkg = packagingsByProduct[item.product.id]?.find(
        (x) => x.id === packagingId,
      );
      if (pkg) {
        item.packaging_id = pkg.id;
        item.package_multiplier = pkg.multiplier;
        item.packaging_name = pkg.package_name;
        item.actual_selling_price =
          pkg.selling_price || item.product.selling_price * pkg.multiplier;
      }
    }
    setCart(updated);
  };

  const handleSelectBatch = (index: number, batchId: number | null) => {
    const updated = [...cart];
    if (batchId === null) {
      updated[index].batch_id = null;
      updated[index].batch_number = null;
      updated[index].expiry_date = null;
    } else {
      const b = batchesByProduct[updated[index].product.id]?.find(
        (x) => x.id === batchId,
      );
      if (b) {
        updated[index].batch_id = b.id;
        updated[index].batch_number = b.batch_number;
        updated[index].expiry_date = b.expiry_date;
      }
    }
    setCart(updated);
  };

  useEffect(() => {
    loadCatalog();
    const unsubscribe = subscribeToDbChanges(loadCatalog);
    return unsubscribe;
  }, []);

  // Filter products for catalog
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

  const handleAddToCart = (product: Product) => {
    // Check if already in cart
    const existingIndex = cart.findIndex(
      (item) => item.product.id === product.id,
    );
    if (existingIndex >= 0) {
      const existing = cart[existingIndex];
      const newQty = existing.quantity + 1;

      // Validate stock
      if (!allowNegativeStock && newQty > product.current_stock) {
        showToast(
          `Cannot add more. Only ${product.current_stock} in stock for "${product.name}".`,
          "warning",
        );
        return;
      }

      const updated = [...cart];
      const isWholesaleQualifying =
        customerData.customer_type === "WHOLESALE" ||
        (product.wholesale_min_qty !== null &&
          product.wholesale_min_qty !== undefined &&
          newQty >= product.wholesale_min_qty);

      let price = existing.actual_selling_price;
      let tier = existing.pricing_tier || "RETAIL";

      if (
        isWholesaleQualifying &&
        product.wholesale_price &&
        product.wholesale_price > 0 &&
        (price === product.selling_price || tier === "RETAIL")
      ) {
        price = product.wholesale_price;
        tier = "WHOLESALE";
      }

      updated[existingIndex] = {
        ...existing,
        quantity: newQty,
        actual_selling_price: price,
        pricing_tier: tier,
      };
      setCart(updated);
    } else {
      // Validate initial 1 quantity
      if (!allowNegativeStock && product.current_stock < 1) {
        showToast(`"${product.name}" is currently out of stock.`, "warning");
        return;
      }

      const isWholesale =
        customerData.customer_type === "WHOLESALE" ||
        (product.wholesale_min_qty !== null &&
          product.wholesale_min_qty !== undefined &&
          1 >= product.wholesale_min_qty);

      const hasWholesalePrice =
        product.wholesale_price !== null &&
        product.wholesale_price !== undefined &&
        product.wholesale_price > 0;

      const initialPrice =
        isWholesale && hasWholesalePrice
          ? product.wholesale_price!
          : product.selling_price;

      const initialTier: "RETAIL" | "WHOLESALE" =
        isWholesale && hasWholesalePrice ? "WHOLESALE" : "RETAIL";

      setCart([
        ...cart,
        {
          product,
          quantity: 1,
          actual_selling_price: initialPrice,
          discount: 0,
          pricing_tier: initialTier,
        },
      ]);
    }
  };

  // Pre-load products if passed from outside (e.g. ProductsView or InventoryView)
  useEffect(() => {
    if (initialProducts && initialProducts.length > 0) {
      initialProducts.forEach((p) => {
        handleAddToCart(p.product);
      });
      onClearInitialProducts?.();
    }
  }, [initialProducts]);

  const handleUpdateQuantity = (index: number, qtyStr: string) => {
    const rawQty = parseInt(qtyStr, 10);
    const updated = [...cart];
    const item = updated[index];
    if (!item) return;

    const availableStock = item.product.current_stock;

    if (isNaN(rawQty) || rawQty <= 0) {
      item.quantity = 1;
    } else if (!allowNegativeStock && rawQty > availableStock) {
      item.quantity = Math.max(1, availableStock);
      showToast(
        `Quantity cannot exceed available stock (${availableStock} ${item.product.unit || "pcs"} for "${item.product.name}").`,
        "warning",
      );
    } else {
      item.quantity = rawQty;
    }

    // Auto-evaluate Wholesale pricing tier threshold
    const p = item.product;
    if (p.wholesale_price && p.wholesale_price > 0 && p.wholesale_min_qty) {
      if (item.quantity >= p.wholesale_min_qty) {
        if (
          item.pricing_tier !== "WHOLESALE" &&
          item.actual_selling_price === p.selling_price
        ) {
          item.pricing_tier = "WHOLESALE";
          item.actual_selling_price = p.wholesale_price;
        }
      } else if (customerData.customer_type !== "WHOLESALE") {
        if (
          item.pricing_tier === "WHOLESALE" &&
          item.actual_selling_price === p.wholesale_price
        ) {
          item.pricing_tier = "RETAIL";
          item.actual_selling_price = p.selling_price;
        }
      }
    }

    setCart(updated);
  };

  const handleTogglePricingTier = (index: number) => {
    const updated = [...cart];
    const item = updated[index];
    if (
      !item ||
      !item.product.wholesale_price ||
      item.product.wholesale_price <= 0
    )
      return;

    if (item.pricing_tier === "WHOLESALE") {
      item.pricing_tier = "RETAIL";
      item.actual_selling_price = item.product.selling_price;
    } else {
      item.pricing_tier = "WHOLESALE";
      item.actual_selling_price = item.product.wholesale_price;
    }
    setCart(updated);
  };

  const handleUpdateActualPrice = (index: number, priceStr: string) => {
    const updated = [...cart];
    updated[index].actual_selling_price = toMinorUnits(priceStr);
    setCart(updated);
  };

  const handleRemoveFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const handleClearCart = () => {
    setCart([]);
    setWholeDiscountValue("");
    setWholeDiscountType("fixed");
    setCustomerData({
      customerId: null,
      name: "",
      phone: "",
      pan_vat: "",
      address: "",
      isNew: false,
    });
    setSaleDateTime(formatForDateTimeLocal());
    setPaidAmountInput("");
    setIsCustomPaid(false);
  };

  // Calculations with Proportional Whole Discount Division
  const calculations = useMemo(() => {
    let subtotal = 0;
    let totalUnits = 0;
    let hasStockViolation = false;
    let violationMessage = "";

    const itemsForDiscount = cart.map((item) => {
      const gross = item.quantity * item.actual_selling_price;
      subtotal += gross;
      totalUnits += item.quantity;

      const multiplier = item.package_multiplier || 1;
      const baseUnitsNeeded = item.quantity * multiplier;
      if (!allowNegativeStock && baseUnitsNeeded > item.product.current_stock) {
        hasStockViolation = true;
        violationMessage = `Item "${item.product.name}" exceeds current stock (${baseUnitsNeeded} > ${item.product.current_stock} ${item.product.unit || "pcs"})`;
      }

      return {
        gross,
        individualDiscount: 0,
      };
    });

    // Calculate target whole discount in minor units
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

    // Distribute whole discount proportionally across all items based on item gross
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
      total: grandTotal,
      totalUnits,
      itemsWithDiscounts,
      hasStockViolation,
      violationMessage,
    };
  }, [
    cart,
    allowNegativeStock,
    wholeDiscountValue,
    wholeDiscountType,
    applyVat,
  ]);

  // Customer outstanding previous due and current bill due calculations
  const customerPreviousDue = useMemo(() => {
    return getCustomerTotalDue(customerData.customerId, customerData.phone);
  }, [customerData.customerId, customerData.phone]);

  const effectivePaidAmount = useMemo(() => {
    if (!isCustomPaid) {
      return calculations.grandTotal;
    }
    const trimmed = paidAmountInput.trim();
    if (trimmed === "") return 0;
    const val = parseFloat(trimmed);
    if (isNaN(val) || val < 0) return 0;
    return toMinorUnits(val);
  }, [isCustomPaid, paidAmountInput, calculations.grandTotal]);

  const totalPayableOverall = calculations.grandTotal + customerPreviousDue;
  const settlePreviousDue =
    customerPreviousDue > 0 && effectivePaidAmount > calculations.grandTotal
      ? Math.min(
          effectivePaidAmount - calculations.grandTotal,
          customerPreviousDue,
        )
      : 0;
  const remainingPreviousDue = customerPreviousDue - settlePreviousDue;
  const currentBillDue = Math.max(
    0,
    calculations.grandTotal - effectivePaidAmount,
  );
  const changeToReturn = Math.max(0, effectivePaidAmount - totalPayableOverall);
  const totalCustomerDue = currentBillDue + remainingPreviousDue;

  const handleCompleteSale = () => {
    if (cart.length === 0) {
      showToast("Please add at least one product to the sale", "warning");
      return;
    }

    if (calculations.hasStockViolation) {
      showToast(calculations.violationMessage, "error");
      return;
    }

    try {
      const itemsInput = calculations.itemsWithDiscounts.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        actualSellingPrice: item.actual_selling_price,
        discount: item.effectiveTotalDiscount,
        batchId: item.batch_id,
        pricingTier: item.pricing_tier,
        packagingId: item.packaging_id,
        packageMultiplier: item.package_multiplier,
      }));

      const sale = processSale(itemsInput, {
        customerId: customerData.customerId || undefined,
        customerName: customerData.name.trim() || undefined,
        customerPhone: customerData.phone.trim() || undefined,
        customerPanVat: customerData.pan_vat.trim() || undefined,
        customerAddress: customerData.address.trim() || undefined,
        applyVat: applyVat,
        paidAmount: effectivePaidAmount,
        paymentMethod:
          paymentMethod === "Other" && customPaymentMethod.trim()
            ? customPaymentMethod.trim()
            : paymentMethod,
        createdAt: parseDateTimeLocalToIso(saleDateTime),
        customerInput: {
          name: customerData.name.trim(),
          phone: customerData.phone.trim() || undefined,
          pan_vat: customerData.pan_vat.trim() || undefined,
          address: customerData.address.trim() || undefined,
        },
      });

      showToast(`Sale #${sale.id} completed successfully!`, "success");

      // Alert the user if any product's stock levels fall to or below their specific minimum alert threshold
      if (sale.lowStockAlerts && sale.lowStockAlerts.length > 0) {
        sale.lowStockAlerts.forEach((alert) => {
          showToast(
            `"${alert.productName}" stock is now ${alert.remainingStock} unit${
              alert.remainingStock === 1 ? "" : "s"
            } (below minimum alert threshold of ${alert.threshold}). Restock recommended!`,
            "warning",
            {
              title: "⚠️ Low Stock Alert",
              duration: 8500,
              action: onRestockProduct
                ? {
                    label: "Restock Product",
                    onClick: () => {
                      const prod = products.find(
                        (p) => p.id === alert.productId,
                      );
                      if (prod) {
                        onRestockProduct(prod);
                      } else {
                        navigate("/inventory");
                      }
                    },
                  }
                : {
                    label: "View Inventory",
                    onClick: () => navigate("/inventory"),
                  },
            },
          );
        });
      }

      setCompletedSaleInfo({
        id: sale.id,
        billNumber: sale.bill_number,
        subtotal: sale.subtotal,
        discount: sale.discount,
        taxableAmount: sale.taxable_amount,
        vatAmount: sale.vat_amount,
        grandTotal: sale.grand_total,
        total: sale.grand_total ?? sale.total,
        paidAmount: sale.paid_amount ?? effectivePaidAmount,
        paymentMethod: sale.payment_method || paymentMethod,
        dueAmount: sale.due_amount ?? currentBillDue,
        previousDue: customerPreviousDue,
        totalDue: totalCustomerDue,
        customerName: sale.customer_name,
        customerPhone: sale.customer_phone,
        customerPanVat: sale.customer_pan_vat,
      });

      setCart([]);
      setPaidAmountInput("");
      setIsCustomPaid(false);
      setPaymentMethod("Cash");
      setCustomPaymentMethod("");
      setCustomerData({
        customerId: null,
        name: "",
        phone: "",
        pan_vat: "",
        address: "",
        isNew: false,
      });
      setSaleDateTime(formatForDateTimeLocal());
      loadCatalog();
      onSaleCompleted(sale.id);
    } catch (err: unknown) {
      showToast((err as Error).message, "error", "Transaction Failed");
    }
  };

  const handleCompleteSaleRef = useRef(handleCompleteSale);
  useEffect(() => {
    handleCompleteSaleRef.current = handleCompleteSale;
  });

  // POS-Specific Keyboard Shortcuts (F2 / Ctrl+Enter for sale completion, Ctrl+B to focus scanner)
  useEffect(() => {
    const handlePosKeyDown = (e: KeyboardEvent) => {
      const isModifier = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // F2 or Ctrl+Enter: Complete sale
      if (e.key === "F2" || (isModifier && e.key === "Enter")) {
        if (cart.length > 0 && !calculations.hasStockViolation) {
          e.preventDefault();
          handleCompleteSaleRef.current();
        }
        return;
      }

      // Ctrl+B or Cmd+B: Focus barcode / quick SKU input
      if (isModifier && key === "b") {
        e.preventDefault();
        quickSkuInputRef.current?.focus();
        quickSkuInputRef.current?.select();
        return;
      }
    };

    window.addEventListener("keydown", handlePosKeyDown);
    return () => window.removeEventListener("keydown", handlePosKeyDown);
  }, [cart, calculations.hasStockViolation]);

  return (
    <div className="p-8 flex flex-col gap-6 animate-in fade-in duration-150 h-full min-h-0">
      {/* Main Grid: Left Catalog Picker / Right Active Sale Cart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Left Column: Product Selection & Catalog (5 cols) */}
        <div className="lg:col-span-5 h-full min-h-0 flex flex-col">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col h-full min-h-0 gap-3">
            <div className="flex items-center justify-between shrink-0">
              <div>
                <div className="text-xs font-semibold text-neutral-200">
                  {isNepali
                    ? "उत्पादन क्याटलग (सामान छान्नुहोस्)"
                    : "Product Catalog"}
                </div>
                <div className="text-[11px] text-neutral-400 mt-0.5">
                  {isNepali
                    ? "सामान थप्न क्लिक गर्नुहोस्"
                    : "Click item or + to add to sale cart"}
                </div>
              </div>
            </div>

            {/* Quick Filter Tabs & Search */}
            <div className="space-y-2 shrink-0">
              <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setStockFilter("all")}
                  className={`flex-1 py-1 rounded transition-colors text-center cursor-pointer ${
                    stockFilter === "all"
                      ? "bg-neutral-800 text-neutral-100 font-semibold"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  {t("pos_all_products")} ({formatNumberByLang(products.length)}
                  )
                </button>
                <button
                  type="button"
                  onClick={() => setStockFilter("inStock")}
                  className={`flex-1 py-1 rounded transition-colors text-center cursor-pointer ${
                    stockFilter === "inStock"
                      ? "bg-emerald-500/20 text-emerald-300 font-semibold"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  {t("pos_in_stock")}
                </button>
                <button
                  type="button"
                  onClick={() => setStockFilter("lowStock")}
                  className={`flex-1 py-1 rounded transition-colors text-center cursor-pointer ${
                    stockFilter === "lowStock"
                      ? "bg-amber-500/20 text-amber-300 font-semibold"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  {t("pos_low_stock")}
                </button>
              </div>

              {/* Quick Search */}
              <div className="shrink-0">
                <Input
                  type="text"
                  placeholder={
                    isNepali
                      ? "सामानको नाम वा SKU बाट खोज्नुहोस्..."
                      : "Search catalog or SKU to add..."
                  }
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  icon={Search}
                  clearable
                  onClear={() => setSearch("")}
                  className="py-1.5 text-xs"
                />
              </div>
            </div>

            {/* Product List */}
            <div className="space-y-1.5 flex-1 min-h-0 overflow-y-auto pr-1">
              {availableProducts.length === 0 ? (
                <div className="text-center py-8 text-neutral-500 text-xs">
                  {isNepali ? "कुनै सामान भेटिएन।" : "No products found."}
                </div>
              ) : (
                availableProducts.map((p) => {
                  const isOutOfStock = p.current_stock <= 0;
                  const inCartIndex = cart.findIndex(
                    (ci) => ci.product.id === p.id,
                  );
                  const inCartItem =
                    inCartIndex >= 0 ? cart[inCartIndex] : null;
                  const cartQty = inCartItem ? inCartItem.quantity : 0;
                  const isMaxInCart =
                    !allowNegativeStock && cartQty >= p.current_stock;

                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        if (isOutOfStock && !allowNegativeStock) return;
                        if (isMaxInCart) return;
                        handleAddToCart(p);
                      }}
                      className={`p-2.5 rounded-lg border transition-all flex items-center justify-between select-none cursor-pointer group ${
                        cartQty > 0
                          ? "bg-emerald-950/20 border-emerald-500/40 ring-1 ring-emerald-500/20"
                          : isOutOfStock && !allowNegativeStock
                            ? "bg-neutral-950/40 border-neutral-800/40 opacity-50 cursor-not-allowed"
                            : "bg-neutral-950 border-neutral-800/80 hover:border-neutral-700 hover:bg-neutral-900/50"
                      }`}
                    >
                      {/* Product Info */}
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="text-xs font-semibold text-neutral-200 group-hover:text-emerald-300 truncate capitalize flex items-center gap-1.5">
                          <span>{p.name}</span>
                          {cartQty > 0 && (
                            <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/30">
                              {cartQty} {p.unit || "pcs"}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-neutral-500 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-neutral-300">
                            {formatCurrency(p.selling_price, currencySymbol)}
                          </span>
                          {p.wholesale_price && p.wholesale_price > 0 && (
                            <span className="text-amber-400 font-normal">
                              · W:{" "}
                              {formatCurrency(
                                p.wholesale_price,
                                currencySymbol,
                              )}
                              {p.wholesale_min_qty
                                ? ` (≥${p.wholesale_min_qty})`
                                : ""}
                            </span>
                          )}
                          <span>·</span>
                          <span>{p.sku || "No SKU"}</span>
                          <span>·</span>
                          <span className="px-1 py-0.2 rounded bg-neutral-900 text-neutral-400 border border-neutral-800">
                            {p.unit || "pcs"}
                          </span>
                          <span>·</span>
                          <span
                            className={
                              p.current_stock <= 5
                                ? "text-amber-400 font-semibold"
                                : "text-neutral-400"
                            }
                          >
                            Stock: {p.current_stock}
                          </span>
                        </div>
                      </div>

                      {/* Right side: Stepper if in cart, or "+ Add" button */}
                      <div
                        className="flex items-center gap-1.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {cartQty > 0 ? (
                          <div className="flex items-center bg-neutral-900 border border-emerald-500/40 rounded-lg p-0.5 shadow-xs">
                            <button
                              type="button"
                              onClick={() => {
                                if (cartQty <= 1) {
                                  handleRemoveFromCart(inCartIndex);
                                } else {
                                  handleUpdateQuantity(
                                    inCartIndex,
                                    (cartQty - 1).toString(),
                                  );
                                }
                              }}
                              className="w-7 h-7 flex items-center justify-center text-neutral-300 hover:text-white rounded hover:bg-neutral-800 transition-colors cursor-pointer"
                              title={
                                cartQty <= 1
                                  ? isNepali
                                    ? "बिक्रीबाट हटाउनुहोस्"
                                    : "Remove from sale"
                                  : isNepali
                                    ? "घटाउनुहोस्"
                                    : "Decrease quantity"
                              }
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              max={
                                !allowNegativeStock
                                  ? Math.max(1, p.current_stock)
                                  : undefined
                              }
                              value={cartQty}
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
                              disabled={isMaxInCart}
                              onClick={() => {
                                if (isMaxInCart) return;
                                handleUpdateQuantity(
                                  inCartIndex,
                                  (cartQty + 1).toString(),
                                );
                              }}
                              title={
                                isMaxInCart
                                  ? `Max stock reached (${p.current_stock})`
                                  : isNepali
                                    ? "बढाउनुहोस्"
                                    : "Increase quantity"
                              }
                              className="w-7 h-7 flex items-center justify-center text-neutral-300 hover:text-white rounded hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={isOutOfStock && !allowNegativeStock}
                            onClick={() => handleAddToCart(p)}
                            title={
                              isOutOfStock && !allowNegativeStock
                                ? "Out of stock"
                                : "Add to sale"
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-emerald-600 text-neutral-300 hover:text-white border border-neutral-800 hover:border-emerald-500 flex items-center gap-1 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>
                              {isOutOfStock && !allowNegativeStock
                                ? isNepali
                                  ? "सकियो"
                                  : "Out of Stock"
                                : isNepali
                                  ? "थप्नुहोस्"
                                  : "Add"}
                            </span>
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

        {/* Right Column: Active Sale Line Items & Summary (7 cols) */}
        <div className="lg:col-span-7 h-full min-h-0 flex flex-col">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden flex flex-col h-full min-h-0">
            {/* Cart Header */}
            <div className="px-3.5 py-2.5 border-b border-neutral-800 bg-neutral-950/70 flex items-center justify-between flex-wrap gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-neutral-200">
                  {isNepali ? "चालु बिक्री सामानहरू" : "Current Transaction Items"}
                </span>
                <span className="text-[11px] text-neutral-400 font-mono ml-1">
                  ({cart.length} {cart.length === 1 ? "item" : "items"} ·{" "}
                  {calculations.totalUnits} units)
                </span>
              </div>

              <div className="flex items-center gap-1.5 self-start sm:self-auto flex-wrap">
                {/* Till Shift Button */}
                <button
                  type="button"
                  onClick={() => setIsShiftModalOpen(true)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-md shadow-xs transition-colors cursor-pointer border ${
                    activeShift
                      ? "text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30"
                      : "text-neutral-400 bg-neutral-800 hover:bg-neutral-700 border-neutral-700"
                  }`}
                  title={
                    isNepali
                      ? "काउन्टर सिफ्ट तथा क्यास ड्रयर"
                      : "Cash Drawer & Shift Management"
                  }
                >
                  <span
                    className={`w-2 h-2 rounded-full ${activeShift ? "bg-emerald-400 animate-pulse" : "bg-neutral-500"}`}
                  />
                  <span>
                    {activeShift
                      ? isNepali
                        ? "सिफ्ट खुला"
                        : "Till Open"
                      : isNepali
                        ? "सिफ्ट बन्द"
                        : "Open Till"}
                  </span>
                </button>

                {/* Returns Button */}
                <button
                  type="button"
                  onClick={() => setIsReturnsModalOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-md shadow-xs transition-colors cursor-pointer"
                  title={
                    isNepali
                      ? "बिक्री फिर्ता तथा क्रेडिट नोट"
                      : "Customer Returns & Credit Note"
                  }
                >
                  <RotateCcw className="w-3 h-3 text-rose-400" />
                  <span>{isNepali ? "फिर्ता" : "Returns"}</span>
                </button>

                {/* Clear Cart Button */}
                {cart.length > 0 && (
                  <button
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
                    <Receipt className="w-8 h-8 text-neutral-600 mb-2" />
                    <p className="max-w-xs">
                      {isNepali
                        ? "बिक्री कार्ट खाली छ। बायाँतर्फको क्याटलगबाट सामान क्लिक गरी थप्नुहोस्।"
                        : "Your sale cart is empty. Click on any product in the catalog on the left to add it."}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-900/90 text-neutral-400 font-medium border-b border-neutral-800 sticky top-0 z-10 text-[11px]">
                        <tr>
                          <th className="py-1.5 px-3">Item</th>
                          <th className="py-1.5 px-2 text-center w-28">Qty</th>
                          <th className="py-1.5 px-2 text-right font-mono w-24">Sale Price</th>
                          <th className="py-1.5 px-3 text-right font-mono w-28">Total</th>
                          <th className="py-1.5 px-2 text-center w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800/60">
                        {calculations.itemsWithDiscounts.map((item, index) => {
                          const multiplier = item.package_multiplier || 1;
                          const baseQtyNeeded = item.quantity * multiplier;
                          const isOverStock =
                            !allowNegativeStock &&
                            baseQtyNeeded > item.product.current_stock;

                          return (
                            <tr
                              key={item.product.id}
                              className={`hover:bg-neutral-800/30 transition-colors ${
                                isOverStock ? "bg-rose-500/5" : ""
                              }`}
                            >
                              {/* Product Info */}
                              <td className="py-2 px-3">
                                <div className="font-semibold text-neutral-200 flex items-center gap-1.5 flex-wrap">
                                  <span className="capitalize">{item.product.name}</span>
                                  <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-neutral-800 text-neutral-300 border border-neutral-700/60">
                                    {item.product.unit || "pcs"}
                                  </span>
                                  {item.packaging_name && (
                                    <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-semibold">
                                      {item.packaging_name} (×{item.package_multiplier})
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-neutral-400 font-mono mt-0.5 flex items-center gap-1.5">
                                  <span>
                                    Default: {formatCurrency(item.product.selling_price, currencySymbol)}
                                  </span>
                                  <span>·</span>
                                  <span className={isOverStock ? "text-rose-400 font-bold" : "text-neutral-400"}>
                                    Stock: {item.product.current_stock} {item.product.unit || "pcs"}
                                  </span>
                                </div>
                                {isOverStock && (
                                  <div className="text-[10px] text-rose-400 mt-1 flex items-center gap-1 font-semibold">
                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                    <span>
                                      Exceeds stock (Needs {baseQtyNeeded}, Available: {item.product.current_stock})
                                    </span>
                                  </div>
                                )}

                                {/* Packaging & Batch Controls */}
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  {packagingsByProduct[item.product.id]?.length > 0 && (
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
                                        <option value="">Base ({item.product.unit || "pcs"})</option>
                                        {packagingsByProduct[item.product.id].map((pkg) => (
                                          <option key={pkg.id} value={pkg.id}>
                                            {pkg.package_name} (×{pkg.multiplier})
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  )}

                                  {batchesByProduct[item.product.id]?.length > 0 && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] text-neutral-400 font-medium">
                                        {isNepali ? "ब्याच:" : "Batch:"}
                                      </span>
                                      <select
                                        value={item.batch_id ?? ""}
                                        onChange={(e) => {
                                          const val = e.target.value
                                            ? parseInt(e.target.value, 10)
                                            : null;
                                          handleSelectBatch(index, val);
                                        }}
                                        className="bg-neutral-900 border border-neutral-700/80 rounded px-1.5 py-0.5 text-[10px] text-amber-300 font-mono focus:outline-none focus:border-amber-500 cursor-pointer"
                                      >
                                        <option value="">
                                          Auto FEFO ({batchesByProduct[item.product.id][0].batch_number})
                                        </option>
                                        {batchesByProduct[item.product.id].map((b) => (
                                          <option key={b.id} value={b.id}>
                                            {b.batch_number} (Exp: {b.expiry_date}, Stk: {b.quantity})
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Quantity with in-line stepper */}
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
                                          ? "बिक्रीबाट हटाउनुहोस्"
                                          : "Remove from sale"
                                        : isNepali
                                          ? "घटाउनुहोस्"
                                          : "Decrease quantity"
                                    }
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <input
                                    type="number"
                                    min="1"
                                    max={
                                      !allowNegativeStock
                                        ? Math.max(1, item.product.current_stock)
                                        : undefined
                                    }
                                    value={item.quantity}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value, 10);
                                      if (isNaN(val) || val <= 0) {
                                        handleRemoveFromCart(index);
                                      } else {
                                        handleUpdateQuantity(index, val.toString());
                                      }
                                    }}
                                    className="w-10 h-7 border-0 p-0 text-center text-xs font-mono font-bold text-neutral-100 bg-transparent focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    disabled={
                                      !allowNegativeStock &&
                                      item.quantity >= item.product.current_stock
                                    }
                                    onClick={() =>
                                      handleUpdateQuantity(
                                        index,
                                        (item.quantity + 1).toString(),
                                      )
                                    }
                                    title={
                                      !allowNegativeStock &&
                                      item.quantity >= item.product.current_stock
                                        ? `Max available stock reached (${item.product.current_stock})`
                                        : isNepali
                                          ? "बढाउनुहोस्"
                                          : "Increase quantity"
                                    }
                                    className="w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>

                              {/* Actual Selling Price (Editable) */}
                              <td className="py-2 px-2 text-right">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={fromMinorUnits(item.actual_selling_price)}
                                  onChange={(e) =>
                                    handleUpdateActualPrice(index, e.target.value)
                                  }
                                  containerClassName="w-20 ml-auto"
                                  className="px-1.5 py-1 text-xs text-right font-mono text-neutral-100 h-7"
                                />
                                {item.product.wholesale_price &&
                                  item.product.wholesale_price > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => handleTogglePricingTier(index)}
                                      className={`mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                                        item.pricing_tier === "WHOLESALE"
                                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold"
                                          : "bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-700/60"
                                      }`}
                                      title="Click to toggle Retail / Wholesale rate"
                                    >
                                      {item.pricing_tier === "WHOLESALE"
                                        ? isNepali
                                          ? "थोक"
                                          : "Wholesale"
                                        : isNepali
                                          ? "खुदरा"
                                          : "Retail"}
                                    </button>
                                  )}
                              </td>

                              {/* Line Total */}
                              <td className="py-2 px-3 text-right font-mono tabular-nums">
                                <div className="font-bold text-neutral-100">
                                  {formatCurrency(item.netTotal, currencySymbol)}
                                </div>
                                {item.allocatedWholeDiscount > 0 && (
                                  <div className="text-[10px] font-normal text-amber-400 font-mono">
                                    -{formatCurrency(item.allocatedWholeDiscount, currencySymbol)}
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

            {/* 2. Customer Information & Two-Column Billing Grid */}
            <div className="shrink-0 p-3 pt-2.5 space-y-2.5 max-h-[46vh] overflow-y-auto border-t border-neutral-800/80 bg-neutral-900/40">
              {/* Customer Information & Transaction Date Card */}
              <div className="p-3 bg-neutral-950/80 border border-neutral-800/80 rounded-lg">
                <div className="flex flex-col md:flex-row md:items-stretch gap-2.5">
                  <div className="flex-1 min-w-0">
                    <CustomerInputSection
                      value={customerData}
                      onChange={setCustomerData}
                    />
                  </div>

                  {/* Transaction Date & Time */}
                  <div className="w-full md:w-auto md:min-w-[270px] shrink-0 p-3 bg-neutral-900/60 border border-neutral-800 rounded-xl flex flex-col justify-between gap-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                          <Calendar className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-neutral-200">
                            {isNepali ? "कारोबार मिति र समय" : "Sale Date & Time"}
                          </div>
                          <p className="text-[10px] text-neutral-400">
                            {isNepali ? "बिल जारी मिति" : "Invoice issue timestamp"}
                          </p>
                        </div>
                      </div>
                      {isCustomSaleDate && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-medium shrink-0">
                          {isNepali ? "कस्टम मिति" : "Backdated"}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <NepaliDatePicker
                          value={saleDateTime}
                          showTime={true}
                          sizeVariant="sm"
                          onChange={(adDateTime) => setSaleDateTime(adDateTime)}
                        />
                      </div>
                      {isCustomSaleDate && (
                        <button
                          type="button"
                          onClick={() => setSaleDateTime(formatForDateTimeLocal())}
                          className="px-2 py-1 text-[10px] font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded transition-colors cursor-pointer shrink-0"
                          title={isNepali ? "अहिलेको मितिमा फर्काउनुहोस्" : "Reset to current date & time"}
                        >
                          {isNepali ? "अहिले" : "Now"}
                        </button>
                      )}
                    </div>
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
                          -{formatCurrency(calculations.totalDiscount, currencySymbol)}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-neutral-400">
                      <span>{isNepali ? "करयोग्य रकम" : "Taxable Amount"}</span>
                      <span className="font-mono text-neutral-200">
                        {formatCurrency(calculations.taxableAmount, currencySymbol)}
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
                        {formatCurrency(calculations.grandTotal, currencySymbol)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Column 2: Payment, Presets & Dues / Outstanding */}
                <div className="space-y-2 min-w-0">
                  {cart.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-neutral-950/80 border border-neutral-800/80 space-y-2.5">
                      {/* Bill Discount */}
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
                            ? "प्राप्त रकम (Paid Amount)"
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
                            {isNepali ? "बिल चुक्ता" : "Current Bill"}
                          </button>
                          {customerPreviousDue > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsCustomPaid(true);
                                setPaidAmountInput(
                                  fromMinorUnits(totalPayableOverall).toString(),
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
                                  : "Settle current bill + all previous due"
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
                                ? "कुनै रकम नलिई पूर्ण उधारो"
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
                          htmlFor="sales-payment-mode-select"
                          className="text-xs font-semibold text-neutral-200 shrink-0"
                        >
                          {isNepali
                            ? "भुक्तानी माध्यम (Payment Mode)"
                            : "Payment Mode"}
                        </label>
                        <div className="flex items-center gap-1.5">
                          <div className="relative">
                            <select
                              id="sales-payment-mode-select"
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
                                  ? "माध्यम (e.g. eSewa)..."
                                  : "Specify mode (e.g. eSewa)..."
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
                              {isNepali ? "फिर्ता रकम" : "Change to Return"}:
                            </span>
                            <span className="font-mono font-bold">
                              {formatCurrency(changeToReturn, currencySymbol)}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-neutral-300">
                          <span>
                            {isNepali ? "यस बिलको बाँकी" : "Current Bill Due"}:
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
                              {isNepali ? "साविक चुक्ता" : "Prev. Settled"}:
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

                        {customerPreviousDue > 0 && (
                          <div className="flex items-center justify-between text-amber-400">
                            <span>
                              {isNepali ? "साविक बाँकी" : "Previous Due"}:
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
                              {isNepali ? "कुल बाँकी" : "Total Due"}:
                            </span>
                            <span className="font-mono text-xs font-bold text-rose-400">
                              {formatCurrency(
                                totalCustomerDue,
                                currencySymbol,
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Sticky Footer: Bottom Summary & Complete Sale Action */}
            <div className="shrink-0 border-t border-neutral-800 bg-neutral-950/95 px-3.5 py-2.5 backdrop-blur-md">
              {calculations.hasStockViolation && (
                <div className="p-2 mb-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Cannot complete sale: one or more items exceed current inventory.
                  </span>
                </div>
              )}

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
                      <span className="font-semibold text-neutral-200">{paymentMethod}</span>
                    </div>
                    <div className="font-mono text-[11px] font-bold">
                      {effectivePaidAmount >= calculations.grandTotal ? (
                        <span className="text-emerald-400">
                          {isNepali ? "पूर्ण चुक्ता" : "Fully Paid"}
                        </span>
                      ) : (
                        <span className="text-rose-400">
                          {isNepali ? "बाँकी" : "Due"}: {formatCurrency(currentBillDue, currencySymbol)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Primary Complete Action Button */}
                <button
                  type="button"
                  disabled={cart.length === 0 || calculations.hasStockViolation}
                  onClick={handleCompleteSale}
                  className={`py-2 px-4 rounded-lg text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0 ${
                    cart.length === 0 || calculations.hasStockViolation
                      ? "bg-neutral-800 text-neutral-500 cursor-not-allowed shadow-none"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white active:scale-[0.99]"
                  }`}
                  title="Complete sale and record transaction (F2 or Enter)"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>
                    {isNepali ? "बिक्री सम्पन्न" : "Complete Sale"} (
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

      {/* Completed Sale Notification Card */}
      {completedSaleInfo && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-neutral-100 flex items-center flex-wrap gap-x-2">
                <span>
                  {completedSaleInfo.billNumber
                    ? `Invoice ${completedSaleInfo.billNumber} (Sale #${completedSaleInfo.id})`
                    : `Transaction #${completedSaleInfo.id}`}{" "}
                  Successfully Recorded
                </span>
                {completedSaleInfo.customerName && (
                  <span className="font-normal text-emerald-300 text-xs">
                    · Customer:{" "}
                    <span className="font-semibold text-neutral-100">
                      {completedSaleInfo.customerName}
                    </span>
                    {completedSaleInfo.customerPhone && (
                      <span className="font-mono text-neutral-400 text-[11px] ml-1">
                        ({completedSaleInfo.customerPhone})
                      </span>
                    )}
                    {completedSaleInfo.customerPanVat && (
                      <span className="font-mono text-emerald-300 text-[11px] ml-1">
                        [PAN: {completedSaleInfo.customerPanVat}]
                      </span>
                    )}
                  </span>
                )}
                {!completedSaleInfo.customerName &&
                  completedSaleInfo.customerPhone && (
                    <span className="font-normal text-emerald-300 text-xs font-mono">
                      · Phone: {completedSaleInfo.customerPhone}
                    </span>
                  )}
              </div>
              <div className="text-[11px] text-neutral-400 mt-0.5">
                Grand Total:{" "}
                <span className="font-mono text-emerald-300 font-semibold">
                  {formatCurrency(
                    completedSaleInfo.grandTotal ?? completedSaleInfo.total,
                    currencySymbol,
                  )}
                </span>
                {completedSaleInfo.vatAmount !== undefined &&
                  completedSaleInfo.vatAmount > 0 && (
                    <span>
                      {" "}
                      · 13% VAT:{" "}
                      <span className="font-mono text-sky-400">
                        +
                        {formatCurrency(
                          completedSaleInfo.vatAmount,
                          currencySymbol,
                        )}
                      </span>
                    </span>
                  )}
                <span>
                  {" "}
                  · Subtotal:{" "}
                  {formatCurrency(completedSaleInfo.subtotal, currencySymbol)}
                </span>
                {completedSaleInfo.discount > 0 && (
                  <span>
                    {" "}
                    · Discounts:{" "}
                    {formatCurrency(completedSaleInfo.discount, currencySymbol)}
                  </span>
                )}
                {completedSaleInfo.paidAmount !== undefined && (
                  <span>
                    {" "}
                    · Paid:{" "}
                    <span className="font-mono text-emerald-300 font-medium">
                      {formatCurrency(
                        completedSaleInfo.paidAmount,
                        currencySymbol,
                      )}
                    </span>
                    <span className="text-neutral-400 text-[11px] ml-1">
                      ({completedSaleInfo.paymentMethod || "Cash"})
                    </span>
                  </span>
                )}
                {completedSaleInfo.dueAmount !== undefined &&
                  completedSaleInfo.dueAmount > 0 && (
                    <span>
                      {" "}
                      · Bill Due:{" "}
                      <span className="font-mono text-amber-400 font-medium">
                        {formatCurrency(
                          completedSaleInfo.dueAmount,
                          currencySymbol,
                        )}
                      </span>
                    </span>
                  )}
                {completedSaleInfo.previousDue !== undefined &&
                  completedSaleInfo.previousDue > 0 && (
                    <span>
                      {" "}
                      · Prev Due:{" "}
                      <span className="font-mono text-amber-300">
                        {formatCurrency(
                          completedSaleInfo.previousDue,
                          currencySymbol,
                        )}
                      </span>
                    </span>
                  )}
                {completedSaleInfo.totalDue !== undefined &&
                  completedSaleInfo.totalDue > 0 && (
                    <span>
                      {" "}
                      · Total Due:{" "}
                      <span className="font-mono text-rose-400 font-semibold">
                        {formatCurrency(
                          completedSaleInfo.totalDue,
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
                setPrintSaleId(completedSaleInfo.id);
                setIsPrintModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Bill</span>
            </button>
            <button
              onClick={() => setCompletedSaleInfo(null)}
              className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors px-2 py-1 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Bill Printing Modal */}
      <PrintBillModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        saleId={printSaleId}
        currencySymbol={currencySymbol}
      />

      {/* Returns & Credit/Debit Notes Modal */}
      <ReturnsModal
        isOpen={isReturnsModalOpen}
        onClose={() => setIsReturnsModalOpen(false)}
        currencySymbol={currencySymbol}
        initialMode="SALE"
      />

      {/* Cash Drawer & Shift Management Modal */}
      <ShiftManagementModal
        isOpen={isShiftModalOpen}
        onClose={() => {
          setIsShiftModalOpen(false);
          loadCatalog();
        }}
        currencySymbol={currencySymbol}
      />
    </div>
  );
};
