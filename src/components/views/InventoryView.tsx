/**
 * Unified Inventory & Products Management View
 * Features:
 * - Product catalog master data management (Create, Edit, Delete, SKU generator, Units)
 * - Inventory stock tracking & real-time valuation KPIs
 * - Multi-criteria Filtering:
 *     - By Date: Presets (Today, Yesterday, Last 7 Days, This Month, All Time) + Custom Date Range
 *     - By Vendor: Filter products & movements by supplier/vendor
 *     - By Stock Status: All, In Stock, Low Stock, Out of Stock
 *     - By Search: Product title, SKU, ID, or Movement note
 * - Movement Audit Log: In-page transaction ledger with type filtering (RESTOCK, PURCHASE, SALE, ADJUSTMENT)
 * - Bulk actions: Multi-select products to Sell in POS
 */
import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  ArrowUpDown,
  History,
  AlertCircle,
  Package,
  Receipt,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Boxes,
  Building2,
  PlusCircle,
  Table2,
} from "lucide-react";
import { Product, StockMovement, Vendor } from "../../types/index.ts";
import {
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  generateProductSku,
} from "../../lib/services/productService.ts";
import {
  restockProduct,
  adjustStock,
  getStockMovements,
} from "../../lib/services/inventoryService.ts";
import { getAllVendors } from "../../lib/services/vendorService.ts";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  fromMinorUnits,
  toMinorUnits,
} from "../../lib/utils/format.ts";
import { Modal } from "../common/Modal.tsx";
import { ConfirmDialog } from "../common/ConfirmDialog.tsx";
import { ActionMenu } from "../common/ActionMenu.tsx";
import { Select } from "../common/Select.tsx";
import { Input } from "../common/Input.tsx";
import { BulkProductModal } from "./BulkProductModal.tsx";
import { DateFilterBar } from "../common/DateFilterBar.tsx";
import { DatePreset } from "../../lib/utils/dateFilters.ts";
import { useToast } from "../../context/ToastContext.tsx";
import { subscribeToDbChanges } from "../../lib/db/sqliteEngine.ts";
import { useLanguage } from "../../context/LanguageContext.tsx";
import { MODIFIER_LABEL } from "../../lib/hooks/useGlobalShortcuts.ts";

export interface InventoryViewProps {
  currencySymbol: string;
  lowStockThreshold: number;
  allowNegativeStock?: boolean;
  activeRestockProduct?: Product | null;
  activeAdjustProduct?: Product | null;
  activeMovementsProduct?: Product | null;
  onClearActiveModals?: () => void;
  onStartSaleWithProducts?: (
    items: Array<{ product: Product; quantity?: number }>,
  ) => void;
  initialOpenCreate?: boolean;
  onClearInitialOpenCreate?: () => void;
  onEditProduct?: (product: Product) => void;
}

const COMMON_UNITS = [
  { value: "pcs", label: "pcs (piece)" },
  { value: "kg", label: "kg (kilogram)" },
  { value: "g", label: "g (gram)" },
  { value: "ltr", label: "ltr (litre)" },
  { value: "ml", label: "ml (millilitre)" },
  { value: "pkt", label: "pkt (packet)" },
  { value: "box", label: "box (box)" },
  { value: "bottle", label: "bottle" },
  { value: "can", label: "can" },
  { value: "dozen", label: "dozen" },
  { value: "m", label: "m (meter)" },
];

export const InventoryView: React.FC<InventoryViewProps> = ({
  currencySymbol,
  lowStockThreshold,
  allowNegativeStock = false,
  activeRestockProduct,
  activeAdjustProduct,
  activeMovementsProduct,
  onClearActiveModals,
  onStartSaleWithProducts,
  initialOpenCreate,
  onClearInitialOpenCreate,
}) => {
  const { showToast } = useToast();
  const { t, isNepali, formatNumberByLang } = useLanguage();



  // Master Data
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [movementsList, setMovementsList] = useState<StockMovement[]>([]);

  // Filter States
  const [search, setSearch] = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState<string>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [stockStatusFilter, setStockStatusFilter] = useState<
    "all" | "in_stock" | "low_stock" | "out_of_stock"
  >("all");
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>("ALL");

  // Multi-selection & Sorting
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState<
    "name" | "stock" | "cost" | "selling" | "valuation" | "date"
  >("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBulkCreateOpen, setIsBulkCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [selectedRestock, setSelectedRestock] = useState<Product | null>(
    activeRestockProduct || null,
  );
  const [selectedAdjust, setSelectedAdjust] = useState<Product | null>(
    activeAdjustProduct || null,
  );
  const [selectedMovements, setSelectedMovements] = useState<Product | null>(
    activeMovementsProduct || null,
  );

  // Form states for Add/Edit Product
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    unit: "pcs",
    costPrice: "",
    sellingPrice: "",
    initialStock: "",
    minStockAlert: "",
  });

  // Restock Form
  const [restockQty, setRestockQty] = useState("10");
  const [restockNote, setRestockNote] = useState("");
  const [restockVendorId, setRestockVendorId] = useState("");

  // Adjust Form
  const [adjustTargetStock, setAdjustTargetStock] = useState("0");
  const [adjustNote, setAdjustNote] = useState("");

  // Load Data
  const loadData = () => {
    try {
      setProducts(getAllProducts());
      setVendors(getAllVendors());
    } catch (e) {
      console.error("Error fetching inventory data:", e);
    }
  };

  const loadMovements = (productId?: number) => {
    try {
      setMovementsList(
        getStockMovements({
          productId,
          vendorId:
            selectedVendorId !== "all" ? Number(selectedVendorId) : undefined,
          type: movementTypeFilter !== "ALL" ? movementTypeFilter : undefined,
          startDate: startDate ? `${startDate}T00:00:00.000Z` : undefined,
          endDate: endDate ? `${endDate}T23:59:59.999Z` : undefined,
          search: search.trim() || undefined,
        }),
      );
    } catch (e) {
      console.error("Error loading movements:", e);
    }
  };

  useEffect(() => {
    loadData();
    loadMovements();
    const unsubscribe = subscribeToDbChanges(() => {
      loadData();
      if (selectedMovements) {
        loadMovements(selectedMovements.id);
      } else {
        loadMovements();
      }
    });
    return unsubscribe;
  }, [
    selectedMovements,
    selectedVendorId,
    movementTypeFilter,
    startDate,
    endDate,
    search,
  ]);

  // Sync external props
  useEffect(() => {
    if (initialOpenCreate) {
      handleOpenCreate();
      onClearInitialOpenCreate?.();
    }
  }, [initialOpenCreate]);

  useEffect(() => {
    if (activeRestockProduct) {
      setSelectedRestock(activeRestockProduct);
      setRestockQty("10");
      setRestockNote("Inventory restock delivery");
      setRestockVendorId("");
    }
  }, [activeRestockProduct]);

  useEffect(() => {
    if (activeAdjustProduct) {
      setSelectedAdjust(activeAdjustProduct);
      setAdjustTargetStock(activeAdjustProduct.current_stock.toString());
      setAdjustNote("Physical inventory recount");
    }
  }, [activeAdjustProduct]);

  useEffect(() => {
    if (activeMovementsProduct) {
      setSelectedMovements(activeMovementsProduct);
      loadMovements(activeMovementsProduct.id);
    }
  }, [activeMovementsProduct]);

  const handleClearFilters = () => {
    setSearch("");
    setSelectedVendorId("all");
    setDatePreset("all");
    setStartDate("");
    setEndDate("");
    setStockStatusFilter("all");
    setMovementTypeFilter("ALL");
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    selectedVendorId !== "all" ||
    datePreset !== "all" ||
    startDate !== "" ||
    endDate !== "" ||
    stockStatusFilter !== "all" ||
    movementTypeFilter !== "ALL";

  // Product Create/Edit Handlers
  const handleOpenCreate = () => {
    setFormData({
      name: "",
      sku: "",
      unit: "pcs",
      costPrice: "",
      sellingPrice: "",
      initialStock: "0",
      minStockAlert: "",
    });
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      sku: p.sku || "",
      unit: p.unit || "pcs",
      costPrice: fromMinorUnits(p.cost_price).toString(),
      sellingPrice: fromMinorUnits(p.selling_price).toString(),
      initialStock: p.current_stock.toString(),
      minStockAlert:
        p.min_stock_alert !== null && p.min_stock_alert !== undefined
          ? p.min_stock_alert.toString()
          : "",
    });
  };

  const handleSaveCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast("Product name is required", "warning");
      return;
    }

    const cost = toMinorUnits(formData.costPrice);
    const selling = toMinorUnits(formData.sellingPrice);
    const stock = parseInt(formData.initialStock, 10) || 0;
    const parsedMinAlert =
      formData.minStockAlert.trim() !== ""
        ? parseInt(formData.minStockAlert, 10)
        : null;
    const minStockAlert =
      parsedMinAlert !== null && !isNaN(parsedMinAlert)
        ? Math.max(0, parsedMinAlert)
        : null;

    try {
      const created = createProduct({
        name: formData.name.trim(),
        sku: formData.sku.trim() || null,
        unit: formData.unit.trim() || "pcs",
        cost_price: cost,
        selling_price: selling,
        current_stock: stock,
        min_stock_alert: minStockAlert,
      });

      showToast(
        isNepali
          ? `सामान "${created.name}" (एकाइ: ${created.unit || "pcs"}) सफलतापूर्वक थपियो`
          : `Product "${created.name}" created successfully`,
        "success",
      );
      setIsCreateOpen(false);
      loadData();
      loadMovements();
    } catch (err: unknown) {
      showToast((err as Error).message, "error");
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (!formData.name.trim()) {
      showToast("Product name is required", "warning");
      return;
    }

    const cost = toMinorUnits(formData.costPrice);
    const selling = toMinorUnits(formData.sellingPrice);
    const parsedMinAlert =
      formData.minStockAlert.trim() !== ""
        ? parseInt(formData.minStockAlert, 10)
        : null;
    const minStockAlert =
      parsedMinAlert !== null && !isNaN(parsedMinAlert)
        ? Math.max(0, parsedMinAlert)
        : null;

    try {
      updateProduct(editingProduct.id, {
        name: formData.name.trim(),
        sku: formData.sku.trim() || null,
        unit: formData.unit.trim() || "pcs",
        cost_price: cost,
        selling_price: selling,
        min_stock_alert: minStockAlert,
      });

      showToast(
        isNepali
          ? "सामानको विवरण अद्यावधिक गरियो"
          : "Product updated successfully",
        "success",
      );
      setEditingProduct(null);
      loadData();
      loadMovements();
    } catch (err: unknown) {
      showToast((err as Error).message, "error");
    }
  };

  const handleConfirmDelete = () => {
    if (!deletingProduct) return;
    try {
      deleteProduct(deletingProduct.id);
      showToast(`Product "${deletingProduct.name}" deleted`, "success");
      loadData();
      loadMovements();
    } catch (err: unknown) {
      showToast((err as Error).message, "error", "Deletion Prevented");
    } finally {
      setDeletingProduct(null);
    }
  };

  // Restock & Adjust Handlers
  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRestock) return;
    const qty = parseInt(restockQty, 10);
    if (isNaN(qty) || qty <= 0) {
      showToast("Restock quantity must be at least 1", "warning");
      return;
    }

    const vId = restockVendorId ? Number(restockVendorId) : null;
    const vObj = vendors.find((v) => String(v.id) === restockVendorId);
    const vName = vObj?.name || null;

    try {
      restockProduct(selectedRestock.id, qty, restockNote, vId, vName);
      showToast(
        `Added +${qty} units to "${selectedRestock.name}". New stock: ${
          selectedRestock.current_stock + qty
        }`,
        "success",
      );
      setSelectedRestock(null);
      onClearActiveModals?.();
      loadData();
      loadMovements();
    } catch (err: unknown) {
      showToast((err as Error).message, "error");
    }
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdjust) return;
    const target = parseInt(adjustTargetStock, 10);
    if (isNaN(target)) {
      showToast("Please specify a valid numeric stock count", "warning");
      return;
    }

    if (target < 0 && !allowNegativeStock) {
      showToast("Negative stock is disabled by system settings", "warning");
      return;
    }

    try {
      adjustStock(selectedAdjust.id, target, adjustNote);
      showToast(
        `Stock for "${selectedAdjust.name}" adjusted to ${target} units`,
        "success",
      );
      setSelectedAdjust(null);
      onClearActiveModals?.();
      loadData();
      loadMovements();
    } catch (err: unknown) {
      showToast((err as Error).message, "error");
    }
  };

  // Selection & Selling Handlers
  const toggleSelectProduct = (id: number) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    if (filteredProducts.length === 0) return;
    if (selectedProductIds.length === filteredProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredProducts.map((p) => p.id));
    }
  };

  const handleSellSelected = () => {
    const selected = products.filter((p) => selectedProductIds.includes(p.id));
    if (selected.length === 0) return;
    if (onStartSaleWithProducts) {
      onStartSaleWithProducts(
        selected.map((p) => ({ product: p, quantity: 1 })),
      );
      setSelectedProductIds([]);
    }
  };

  // Sorting
  const toggleSort = (
    column: "name" | "stock" | "cost" | "selling" | "valuation" | "date",
  ) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  // Filtered Products (Stock Ledger)
  const filteredProducts = useMemo(() => {
    let result = products;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          p.id.toString() === q,
      );
    }

    // Date filter (based on created_at added date)
    if (startDate) {
      result = result.filter((p) => p.created_at.slice(0, 10) >= startDate);
    }
    if (endDate) {
      result = result.filter((p) => p.created_at.slice(0, 10) <= endDate);
    }

    // Stock status filter
    if (stockStatusFilter === "in_stock") {
      result = result.filter((p) => p.current_stock > 0);
    } else if (stockStatusFilter === "low_stock") {
      result = result.filter((p) => {
        const threshold =
          p.min_stock_alert !== null && p.min_stock_alert !== undefined
            ? p.min_stock_alert
            : lowStockThreshold;
        return p.current_stock <= threshold;
      });
    } else if (stockStatusFilter === "out_of_stock") {
      result = result.filter((p) => p.current_stock <= 0);
    }

    // Sorting
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === "stock") {
        comparison = a.current_stock - b.current_stock;
      } else if (sortBy === "cost") {
        comparison = a.cost_price - b.cost_price;
      } else if (sortBy === "selling") {
        comparison = a.selling_price - b.selling_price;
      } else if (sortBy === "valuation") {
        comparison =
          Math.max(0, a.current_stock * a.cost_price) -
          Math.max(0, b.current_stock * b.cost_price);
      } else if (sortBy === "date") {
        comparison = a.created_at.localeCompare(b.created_at);
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [
    products,
    search,
    startDate,
    endDate,
    stockStatusFilter,
    lowStockThreshold,
    sortBy,
    sortOrder,
  ]);

  // Aggregate KPI Stats based on current products list
  const totals = useMemo(() => {
    let units = 0;
    let costValuation = 0;
    let retailValuation = 0;
    let lowCount = 0;

    for (const p of products) {
      units += p.current_stock;
      if (p.current_stock > 0) {
        costValuation += p.current_stock * p.cost_price;
        retailValuation += p.current_stock * p.selling_price;
      }
      const specificThreshold =
        p.min_stock_alert !== null && p.min_stock_alert !== undefined
          ? p.min_stock_alert
          : lowStockThreshold;
      if (p.current_stock <= specificThreshold) {
        lowCount++;
      }
    }

    return {
      productCount: products.length,
      units,
      costValuation,
      retailValuation,
      lowCount,
    };
  }, [products, lowStockThreshold]);

  // Filtered movements for in-page audit log
  const filteredMovements = useMemo(() => {
    let result = movementsList;
    if (movementTypeFilter !== "ALL") {
      result = result.filter((m) => m.type === movementTypeFilter);
    }
    if (selectedVendorId !== "all") {
      const vId = Number(selectedVendorId);
      result = result.filter((m) => m.vendor_id === vId);
    }
    if (startDate) {
      result = result.filter((m) => m.created_at.slice(0, 10) >= startDate);
    }
    if (endDate) {
      result = result.filter((m) => m.created_at.slice(0, 10) <= endDate);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          (m.product_name && m.product_name.toLowerCase().includes(q)) ||
          (m.note && m.note.toLowerCase().includes(q)) ||
          m.product_id.toString() === q ||
          (m.vendor_name && m.vendor_name.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [
    movementsList,
    movementTypeFilter,
    selectedVendorId,
    startDate,
    endDate,
    search,
  ]);

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-150">
      {/* Top Header & Main Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-100 flex items-center gap-2.5">
            <Boxes className="w-5 h-5 text-emerald-400" />
            <span>{t("inv_title", "Inventory & Products")}</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            {isNepali
              ? `सामानको सूची, आपूर्तिकर्ता (Vendor), मिति अनुसार फिल्टर र मौज्दात मूल्याङ्कन`
              : `Catalog master, supplier link, date & vendor filtering, stock movements & valuation`}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Link to Global Movement Log */}
          <Link
            to="/movements"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-300 hover:text-neutral-100 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 shadow-xs transition-colors cursor-pointer"
            title="View Stock Movement Audit Log"
          >
            <History className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {isNepali ? "चलान अडिट लग" : "Movement Log"}
            </span>
          </Link>

          {/* Quick Create Product Button */}
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs transition-colors cursor-pointer"
            title={`Add New Product (${MODIFIER_LABEL}+Shift+P)`}
          >
            <Plus className="w-4 h-4" />
            <span>{t("prod_add_button", "Add Product")}</span>
          </button>

          {/* Add Multiple (Table) Button */}
          <button
            onClick={() => setIsBulkCreateOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-neutral-200 bg-neutral-800 hover:bg-neutral-700 hover:text-white border border-neutral-700 rounded-lg shadow-xs transition-colors cursor-pointer"
            title="Add Multiple Products in Table Format"
          >
            <Table2 className="w-4 h-4 text-emerald-400" />
            <span>
              {isNepali
                ? "थोक सामान थप्नुहोस् (तालिका)"
                : "Add Multiple (Table)"}
            </span>
          </button>
        </div>
      </div>

      {/* Aggregate KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Products */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="p-4 rounded-xl bg-neutral-900 border border-neutral-800"
        >
          <div className="text-xs text-neutral-400">
            {isNepali ? "कुल सामान संख्या" : "Total Items"}
          </div>
          <div className="text-xl font-bold text-neutral-100 font-mono tabular-nums mt-1">
            {formatNumberByLang(totals.productCount)}{" "}
            <span className="text-xs font-normal text-neutral-400">
              {isNepali ? "सामान" : "items"}
            </span>
          </div>
        </motion.div>

        {/* Total Stock Units */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="p-4 rounded-xl bg-neutral-900 border border-neutral-800"
        >
          <div className="text-xs text-neutral-400">
            {t("inv_total_units", "Total In-Stock Units")}
          </div>
          <div className="text-xl font-bold text-neutral-100 font-mono tabular-nums mt-1">
            {formatNumberByLang(totals.units)}{" "}
            <span className="text-xs font-normal text-neutral-400">
              {isNepali ? "एकाइ" : "units"}
            </span>
          </div>
        </motion.div>

        {/* Total Cost Valuation */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="p-4 rounded-xl bg-neutral-900 border border-neutral-800"
        >
          <div className="text-xs text-neutral-400">
            {t("inv_total_valuation", "Cost Valuation")}
          </div>
          <div className="text-xl font-bold text-emerald-400 font-mono tabular-nums mt-1">
            {formatCurrency(totals.costValuation, currencySymbol)}
          </div>
        </motion.div>

        {/* Low Stock Alerts */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between"
        >
          <div>
            <div className="text-xs text-neutral-400">
              {t("inv_low_stock_items", "Low Stock Items")} (≤{" "}
              {formatNumberByLang(lowStockThreshold)})
            </div>
            <div
              className={`text-xl font-bold font-mono tabular-nums mt-1 ${
                totals.lowCount > 0 ? "text-amber-400" : "text-neutral-100"
              }`}
            >
              {formatNumberByLang(totals.lowCount)}{" "}
              {isNepali ? "सामान" : "items"}
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() =>
              setStockStatusFilter(
                stockStatusFilter === "low_stock" ? "all" : "low_stock",
              )
            }
            className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
              stockStatusFilter === "low_stock"
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                : "bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200"
            }`}
          >
            {stockStatusFilter === "low_stock"
              ? isNepali
                ? "कम मौज्दात मात्र"
                : "Filtering Low"
              : isNepali
                ? "फिल्टर"
                : "Filter"}
          </motion.button>
        </motion.div>
      </div>

      {/* Multi-Select Floating Action Bar */}
      {selectedProductIds.length > 0 && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2 text-xs text-neutral-200">
            <span className="font-bold text-emerald-400 font-mono text-sm">
              {formatNumberByLang(selectedProductIds.length)}
            </span>
            <span>{isNepali ? "सामान छानिएको" : "products selected"}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedProductIds([])}
              className="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
            >
              {isNepali ? "सबै हटाउनुहोस्" : "Deselect All"}
            </button>
            <button
              type="button"
              onClick={handleSellSelected}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>
                {isNepali
                  ? `छानिएका सामान बिक्रीमा राख्नुहोस् (${formatNumberByLang(selectedProductIds.length)})`
                  : `Sell Selected in POS (${selectedProductIds.length})`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ==================== RICH FILTERING TOOLBAR ==================== */}
      <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 space-y-3">
        {/* Row 1: Search & Core Filters */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="md:col-span-7">
            <Input
              type="text"
              placeholder={
                isNepali
                  ? "सामानको नाम, SKU वा कोड खोज्नुहोस्..."
                  : "Search by title, SKU, or ID..."
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={Search}
              clearable
              onClear={() => setSearch("")}
              className="py-2 text-xs"
            />
          </div>

          {/* Stock Status Filter */}
          <div className="md:col-span-5">
            <Select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value as any)}
              options={[
                {
                  value: "all",
                  label: isNepali ? "सबै मौज्दात अवस्था" : "All Stock Levels",
                },
                {
                  value: "in_stock",
                  label: isNepali
                    ? "मौज्दातमा उपलब्ध (> 0)"
                    : "In Stock (> 0)",
                },
                {
                  value: "low_stock",
                  label: `⚠️ ${isNepali ? "कम मौज्दात मात्र (Low Stock)" : "Low Stock (≤ threshold)"}`,
                },
                {
                  value: "out_of_stock",
                  label: `❌ ${isNepali ? "रित्तिएको मौज्दात (Out of Stock)" : "Out of Stock (0)"}`,
                },
              ]}
            />
          </div>
        </div>

        {/* Row 2: Standard DateFilterBar */}
        <div className="pt-2 border-t border-neutral-800/80">
          <DateFilterBar
            preset={datePreset}
            onPresetChange={(p, start, end) => {
              setDatePreset(p);
              setStartDate(start);
              setEndDate(end);
            }}
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            hasActiveFilters={hasActiveFilters}
            onClear={handleClearFilters}
          />
        </div>
      </div>

      {/* Main Stock Ledger Content */}
      {/* ==================== PRODUCT & STOCK INVENTORY LEDGER ==================== */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-950 text-neutral-400 font-medium border-b border-neutral-800 select-none">
                <tr>
                  <th className="py-3 px-4 w-10 text-center">
                    <Input
                      type="checkbox"
                      checked={
                        filteredProducts.length > 0 &&
                        selectedProductIds.length === filteredProducts.length
                      }
                      onChange={toggleSelectAll}
                      title="Select/Deselect all filtered"
                      className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                    />
                  </th>
                  <th
                    onClick={() => toggleSort("name")}
                    className="py-3 px-6 cursor-pointer hover:text-neutral-200"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{t("prod_name", "Product Name")}</span>
                      <ArrowUpDown className="w-3.5 h-3.5 text-neutral-500" />
                    </div>
                  </th>
                  <th className="py-3 px-4 font-mono">
                    {t("prod_sku", "SKU")}
                  </th>
                  <th className="py-3 px-3 text-center font-mono">
                    {t("prod_unit_short", "Unit")}
                  </th>
                  <th
                    onClick={() => toggleSort("cost")}
                    className="py-3 px-4 text-right font-mono cursor-pointer hover:text-neutral-200"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>{t("prod_cost_price", "Cost Price")}</span>
                      <ArrowUpDown className="w-3.5 h-3.5 text-neutral-500" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort("selling")}
                    className="py-3 px-4 text-right font-mono cursor-pointer hover:text-neutral-200"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>{t("prod_selling_price", "Selling Price")}</span>
                      <ArrowUpDown className="w-3.5 h-3.5 text-neutral-500" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort("stock")}
                    className="py-3 px-4 text-right font-mono cursor-pointer hover:text-neutral-200"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>{t("prod_current_stock", "Current Stock")}</span>
                      <ArrowUpDown className="w-3.5 h-3.5 text-neutral-500" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort("valuation")}
                    className="py-3 px-4 text-right font-mono cursor-pointer hover:text-neutral-200"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>{t("inv_col_valuation", "Stock Value")}</span>
                      <ArrowUpDown className="w-3.5 h-3.5 text-neutral-500" />
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center">
                    {isNepali ? "इतिहास" : "Ledger"}
                  </th>
                  <th className="py-3 px-6 text-right">
                    {t("prod_actions", "Actions")}
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-neutral-800/60">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="py-12 text-center text-neutral-400 text-xs"
                    >
                      <Boxes className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                      <p className="font-semibold text-neutral-300">
                        {isNepali
                          ? "कुनै सामान फेला परेन।"
                          : "No matching inventory items found."}
                      </p>
                      <p className="text-neutral-500 text-[11px] mt-1">
                        {hasActiveFilters
                          ? "Try clearing date, vendor, or search filters to see all products."
                          : isNepali
                            ? "सामान थप्न तलका बटनहरू प्रयोग गर्नुहोस्।"
                            : "Click below to register products one by one or in bulk table format."}
                      </p>
                      {!hasActiveFilters && (
                        <div className="flex items-center justify-center gap-3 mt-4">
                          <button
                            type="button"
                            onClick={handleOpenCreate}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs transition-colors cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            <span>{t("prod_add_button", "Add Product")}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsBulkCreateOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-200 bg-neutral-800 hover:bg-neutral-700 hover:text-white border border-neutral-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                          >
                            <Table2 className="w-4 h-4 text-emerald-400" />
                            <span>
                              {isNepali
                                ? "थोक सामान थप्नुहोस् (तालिका)"
                                : "Add Multiple (Table)"}
                            </span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const specificThreshold =
                      p.min_stock_alert !== null &&
                      p.min_stock_alert !== undefined
                        ? p.min_stock_alert
                        : lowStockThreshold;
                    const isLow = p.current_stock <= specificThreshold;
                    const isSelected = selectedProductIds.includes(p.id);
                    const valuation = Math.max(
                      0,
                      p.current_stock * p.cost_price,
                    );
                    const marginPct =
                      p.selling_price > 0
                        ? Math.round(
                            ((p.selling_price - p.cost_price) /
                              p.selling_price) *
                              100,
                          )
                        : 0;

                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-neutral-800/40 transition-colors group ${
                          isSelected ? "bg-emerald-950/20" : ""
                        }`}
                      >
                        <td className="py-3 px-4 text-center">
                          <Input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectProduct(p.id)}
                            className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                          />
                        </td>

                        <td className="py-3 px-6">
                          <div className="font-semibold text-neutral-100">
                            {p.name}
                          </div>
                          <div className="text-[11px] text-neutral-500 mt-0.5 font-mono">
                            ID: #{p.id} · Added: {formatDate(p.created_at)}
                          </div>
                        </td>

                        <td className="py-3 px-4 font-mono text-neutral-400">
                          {p.sku || (
                            <span className="text-neutral-600 italic">
                              None
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-center">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-neutral-800 text-neutral-300 border border-neutral-700/60">
                            {p.unit || "pcs"}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right font-mono text-neutral-400 tabular-nums">
                          {formatCurrency(p.cost_price, currencySymbol)}
                        </td>

                        <td className="py-3 px-4 text-right font-mono text-neutral-200 font-medium tabular-nums">
                          <div>
                            {formatCurrency(p.selling_price, currencySymbol)}
                          </div>
                          <div className="text-[10px] text-neutral-500 font-sans">
                            {marginPct}% margin
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          <div>
                            <span
                              className={`font-semibold ${
                                isLow
                                  ? "text-amber-400 font-bold"
                                  : "text-neutral-200"
                              }`}
                            >
                              {p.current_stock}
                            </span>
                            <span className="text-[11px] text-neutral-400 font-sans ml-1">
                              {p.unit || "pcs"}
                            </span>
                            {isLow && (
                              <span className="ml-1.5 px-1.5 py-0.2 rounded text-[10px] font-sans font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">
                                low
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-neutral-500 font-sans mt-0.5">
                            Alert ≤ {specificThreshold}
                            {p.min_stock_alert !== null &&
                              p.min_stock_alert !== undefined && (
                                <span className="text-emerald-400 ml-1 font-mono text-[9px]">
                                  (custom)
                                </span>
                              )}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-400 tabular-nums">
                          {formatCurrency(valuation, currencySymbol)}
                        </td>

                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => {
                              setSelectedMovements(p);
                              loadMovements(p.id);
                            }}
                            className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors cursor-pointer"
                            title="View stock movement ledger"
                          >
                            <History className="w-4 h-4" />
                          </button>
                        </td>

                        <td className="py-3 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <ActionMenu
                              align="right"
                              items={[
                                {
                                  label: isNepali
                                    ? "बिक्रीमा थप्नुहोस्"
                                    : "Sell in POS",
                                  icon: ShoppingCart,
                                  color: "emerald",
                                  action: () =>
                                    onStartSaleWithProducts?.([
                                      { product: p, quantity: 1 },
                                    ]),
                                },
                                {
                                  label: isNepali
                                    ? "मौज्दात थप (Restock)"
                                    : "Restock Units",
                                  icon: PlusCircle,
                                  color: "emerald",
                                  action: () => {
                                    setSelectedRestock(p);
                                    setRestockQty("10");
                                    setRestockNote(
                                      "Inventory restock delivery",
                                    );
                                    setRestockVendorId("");
                                  },
                                },
                                {
                                  label: isNepali
                                    ? "मौज्दात मिलान (Adjust)"
                                    : "Adjust Count",
                                  icon: SlidersHorizontal,
                                  color: "amber",
                                  action: () => {
                                    setSelectedAdjust(p);
                                    setAdjustTargetStock(
                                      p.current_stock.toString(),
                                    );
                                    setAdjustNote("Physical inventory recount");
                                  },
                                },
                                {
                                  label: isNepali
                                    ? "चलान इतिहास (Ledger)"
                                    : "Movement History",
                                  icon: History,
                                  color: "indigo",
                                  action: () => {
                                    setSelectedMovements(p);
                                    loadMovements(p.id);
                                  },
                                },
                                {
                                  label: isNepali
                                    ? "विवरण सम्पादन (Edit)"
                                    : "Edit Product",
                                  icon: Edit2,
                                  color: "sky",
                                  action: () => handleOpenEdit(p),
                                },
                                {
                                  label: isNepali
                                    ? "सामान मेटाउनुहोस् (Delete)"
                                    : "Delete Product",
                                  icon: Trash2,
                                  color: "rose",
                                  isDestructive: true,
                                  divider: true,
                                  action: () => setDeletingProduct(p),
                                },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>


      {/* ==================== MODAL: CREATE PRODUCT ==================== */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={t("prod_create_title", "Create New Product")}
        subtitle={
          isNepali
            ? "नयाँ सामानको विवरण, मूल्य, आपूर्तिकर्ता र प्रारम्भिक मौज्दात प्रविष्टि गर्नुहोस्।"
            : "Specify product attributes, pricing, vendor supplier, and initial stock."
        }
        maxWidth="md"
      >
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-neutral-800">
          <span className="text-xs text-neutral-400">
            {isNepali ? "एक पटकमा एउटा सामान दर्ता" : "Single Product Entry"}
          </span>
          <button
            type="button"
            onClick={() => {
              setIsCreateOpen(false);
              setIsBulkCreateOpen(true);
            }}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Table2 className="w-3.5 h-3.5" />
            <span>
              {isNepali
                ? "तालिकामा धेरै सामान थप्नुहोस् (Bulk Mode)"
                : "Add Multiple in Table Mode"}
            </span>
          </button>
        </div>

        <form onSubmit={handleSaveCreate} className="space-y-4">
          <div>
            <Input
              label={`${t("prod_name", "Product Name")} *`}
              type="text"
              required
              placeholder={
                isNepali ? "उदा. कोकाकोला ५०० मि.लि." : "e.g. Coca Cola 500ml"
              }
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-neutral-300">
                {t("prod_sku", "SKU / Barcode")}
                <span className="text-neutral-500 font-normal ml-1">
                  ({t("prod_sku_auto_hint", "Auto-generated if left blank")})
                </span>
              </label>
              <button
                type="button"
                onClick={() => {
                  const gen = generateProductSku(formData.name);
                  setFormData((prev) => ({ ...prev, sku: gen }));
                }}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-mono transition-colors cursor-pointer"
                title={
                  isNepali
                    ? "स्वतः SKU कोड बनाउनुहोस्"
                    : "Auto-generate unique SKU code"
                }
              >
                <Sparkles className="w-3 h-3" />
                <span>{t("prod_sku_auto_btn", "Auto-Generate")}</span>
              </button>
            </div>
            <Input
              type="text"
              placeholder={t(
                "prod_sku_placeholder",
                "e.g. BEV-CC-500 (or leave blank to auto-generate)",
              )}
              value={formData.sku}
              onChange={(e) =>
                setFormData({ ...formData, sku: e.target.value })
              }
              className="font-mono"
              clearable
              onClear={() => setFormData((prev) => ({ ...prev, sku: "" }))}
            />
          </div>

          {/* Unit of Measure */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-neutral-300">
                {t("prod_unit", "Unit of Measure")} *
              </label>
              <span className="text-[10px] text-neutral-400 font-mono">
                {isNepali
                  ? "उदा. pcs, kg, ltr, box"
                  : "e.g. pcs, kg, litre, box"}
              </span>
            </div>
            <Select
              searchable
              allowCustom
              searchPlaceholder={
                isNepali
                  ? "एकाइ खोज्नुहोस् वा नयाँ एकाइ लेख्नुहोस्..."
                  : "Search unit or type custom unit..."
              }
              value={formData.unit || "pcs"}
              onChange={(e) => {
                if (e.target.value) {
                  setFormData({ ...formData, unit: String(e.target.value) });
                }
              }}
              placeholder={
                isNepali ? "-- एकाइ छान्नुहोस् --" : "-- Select Unit --"
              }
              options={[
                ...(formData.unit &&
                !COMMON_UNITS.some(
                  (u) => u.value.toLowerCase() === formData.unit.toLowerCase(),
                )
                  ? [
                      {
                        value: formData.unit,
                        label: `${formData.unit} (custom)`,
                        searchLabel: formData.unit,
                      },
                    ]
                  : []),
                ...COMMON_UNITS.map((u) => ({
                  value: u.value,
                  label: u.label,
                  searchLabel: `${u.value} ${u.label}`,
                })),
              ]}
              className="font-mono"
            />
            {/* Quick unit chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {["pcs", "kg", "ltr", "g", "ml", "pkt", "box", "bottle"].map(
                (u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setFormData({ ...formData, unit: u })}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                      formData.unit.toLowerCase() === u
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold"
                        : "bg-neutral-800/80 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-700/60"
                    }`}
                  >
                    {u}
                  </button>
                ),
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                label={`${t("prod_cost_price", "Cost Price")} (${currencySymbol}) *`}
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="45.00"
                value={formData.costPrice}
                onChange={(e) =>
                  setFormData({ ...formData, costPrice: e.target.value })
                }
                className="font-mono"
              />
            </div>

            <div>
              <Input
                label={`${t("prod_selling_price", "Default Selling")} (${currencySymbol}) *`}
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="60.00"
                value={formData.sellingPrice}
                onChange={(e) =>
                  setFormData({ ...formData, sellingPrice: e.target.value })
                }
                className="font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                label={t("prod_initial_stock", "Opening Stock")}
                helperText={
                  isNepali
                    ? "प्रारम्भिक मौज्दात प्रविष्टि गर्दछ।"
                    : "Creates initial 'RESTOCK' movement."
                }
                type="number"
                min="0"
                placeholder="100"
                value={formData.initialStock}
                onChange={(e) =>
                  setFormData({ ...formData, initialStock: e.target.value })
                }
                className="font-mono"
              />
            </div>

            <div>
              <Input
                label={t("prod_min_alert", "Minimum Alert Threshold")}
                helperText={t(
                  "prod_min_alert_hint",
                  "Triggers low-stock warning when below threshold.",
                )}
                type="number"
                min="0"
                placeholder={
                  isNepali
                    ? `डिफल्ट: ${lowStockThreshold} एकाइ`
                    : `Default: ${lowStockThreshold} units`
                }
                value={formData.minStockAlert}
                onChange={(e) =>
                  setFormData({ ...formData, minStockAlert: e.target.value })
                }
                className="font-mono"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
            >
              {t("action_cancel", "Cancel")}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer"
            >
              {t("action_create", "Create Product")}
            </button>
          </div>
        </form>
      </Modal>

      {/* ==================== MODAL: EDIT PRODUCT ==================== */}
      <Modal
        isOpen={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        title={t("prod_edit_title", "Edit Product Master")}
        subtitle={t(
          "prod_edit_subtitle",
          "Update attributes, pricing, or unit of measure",
        )}
        maxWidth="md"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <Input
              label={`${t("prod_name", "Product Name")} *`}
              type="text"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-neutral-300">
                {t("prod_sku", "SKU / Barcode")}
                <span className="text-neutral-500 font-normal ml-1">
                  ({t("prod_sku_auto_hint", "Auto-generated if left blank")})
                </span>
              </label>
              <button
                type="button"
                onClick={() => {
                  const gen = generateProductSku(formData.name);
                  setFormData((prev) => ({ ...prev, sku: gen }));
                }}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-mono transition-colors cursor-pointer"
                title={
                  isNepali
                    ? "स्वतः नयाँ SKU बनाउनुहोस्"
                    : "Auto-generate new SKU code"
                }
              >
                <Sparkles className="w-3 h-3" />
                <span>{t("prod_sku_auto_btn", "Auto-Generate")}</span>
              </button>
            </div>
            <Input
              type="text"
              placeholder={t(
                "prod_sku_placeholder",
                "e.g. BEV-CC-500 (or leave blank to auto-generate)",
              )}
              value={formData.sku}
              onChange={(e) =>
                setFormData({ ...formData, sku: e.target.value })
              }
              className="font-mono"
              clearable
              onClear={() => setFormData((prev) => ({ ...prev, sku: "" }))}
            />
          </div>

          {/* Unit of Measure */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-neutral-300">
                {t("prod_unit", "Unit of Measure")} *
              </label>
              <span className="text-[10px] text-neutral-400 font-mono">
                {isNepali
                  ? "उदा. pcs, kg, ltr, box"
                  : "e.g. pcs, kg, litre, box"}
              </span>
            </div>
            <Select
              searchable
              allowCustom
              searchPlaceholder={
                isNepali
                  ? "एकाइ खोज्नुहोस् वा नयाँ एकाइ लेख्नुहोस्..."
                  : "Search unit or type custom unit..."
              }
              value={formData.unit || "pcs"}
              onChange={(e) => {
                if (e.target.value) {
                  setFormData({ ...formData, unit: String(e.target.value) });
                }
              }}
              placeholder={
                isNepali ? "-- एकाइ छान्नुहोस् --" : "-- Select Unit --"
              }
              options={[
                ...(formData.unit &&
                !COMMON_UNITS.some(
                  (u) => u.value.toLowerCase() === formData.unit.toLowerCase(),
                )
                  ? [
                      {
                        value: formData.unit,
                        label: `${formData.unit} (custom)`,
                        searchLabel: formData.unit,
                      },
                    ]
                  : []),
                ...COMMON_UNITS.map((u) => ({
                  value: u.value,
                  label: u.label,
                  searchLabel: `${u.value} ${u.label}`,
                })),
              ]}
              className="font-mono"
            />
            {/* Quick unit chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {["pcs", "kg", "ltr", "g", "ml", "pkt", "box", "bottle"].map(
                (u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setFormData({ ...formData, unit: u })}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                      formData.unit.toLowerCase() === u
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold"
                        : "bg-neutral-800/80 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-700/60"
                    }`}
                  >
                    {u}
                  </button>
                ),
              )}
            </div>
          </div>

          {/* Supplier / Vendor Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                label={`${t("prod_cost_price", "Cost Price")} (${currencySymbol}) *`}
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.costPrice}
                onChange={(e) =>
                  setFormData({ ...formData, costPrice: e.target.value })
                }
                className="font-mono"
              />
            </div>

            <div>
              <Input
                label={`${t("prod_selling_price", "Default Selling")} (${currencySymbol}) *`}
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.sellingPrice}
                onChange={(e) =>
                  setFormData({ ...formData, sellingPrice: e.target.value })
                }
                className="font-mono"
              />
            </div>
          </div>

          <div>
            <Input
              label={`${t("prod_min_alert", "Minimum Alert Threshold")} (${isNepali ? "वैकल्पिक" : "Optional"})`}
              helperText={t(
                "prod_min_alert_hint",
                "Triggers low-stock warning when below threshold.",
              )}
              type="number"
              min="0"
              placeholder={
                isNepali
                  ? `डिफल्ट: ${lowStockThreshold} एकाइ`
                  : `Default: ${lowStockThreshold} units`
              }
              value={formData.minStockAlert}
              onChange={(e) =>
                setFormData({ ...formData, minStockAlert: e.target.value })
              }
              className="font-mono"
            />
          </div>

          <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800/80 text-[11px] text-neutral-400 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-neutral-200">
                {isNepali
                  ? "ऐतिहासिक स्न्यापसट नियम: "
                  : "Historical Snapshot Rule: "}
              </span>
              {isNepali
                ? "मूल्य परिवर्तन भविष्यका कारोबारहरूमा मात्र लागू हुन्छ। पुराना बिलहरूमा ऐतिहासिक लागत र बिक्री मूल्य सुरक्षित रहन्छ।"
                : "Updating prices applies to future transactions only. Past sales retain their original snapshot cost and selling values."}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => setEditingProduct(null)}
              className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
            >
              {t("action_cancel", "Cancel")}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer"
            >
              {t("action_save_changes", "Save Changes")}
            </button>
          </div>
        </form>
      </Modal>

      {/* ==================== DIALOG: CONFIRM DELETE ==================== */}
      <ConfirmDialog
        isOpen={!!deletingProduct}
        onClose={() => setDeletingProduct(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Product"
        message={`Are you sure you want to delete "${deletingProduct?.name}"? If this product has been involved in previous sales or purchases, deletion will be blocked to maintain historical financial audit integrity.`}
        confirmText="Delete"
        isDestructive={true}
      />

      {/* ==================== MODAL: RESTOCK PRODUCT ==================== */}
      <Modal
        isOpen={!!selectedRestock}
        onClose={() => {
          setSelectedRestock(null);
          onClearActiveModals?.();
        }}
        title={`Restock: ${selectedRestock?.name}`}
        subtitle="Increases product stock and registers a RESTOCK movement record with supplier attribution."
        maxWidth="md"
      >
        <form onSubmit={handleRestockSubmit} className="space-y-4">
          <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-xs flex items-center justify-between">
            <span className="text-neutral-400">Current In-Stock Quantity:</span>
            <span className="font-mono font-bold text-neutral-100">
              {selectedRestock?.current_stock}{" "}
              {selectedRestock?.unit || "units"}
            </span>
          </div>

          <div>
            <Input
              label="Quantity to Add *"
              type="number"
              min="1"
              required
              value={restockQty}
              onChange={(e) => setRestockQty(e.target.value)}
              className="font-mono"
            />
          </div>

          <Select
            label={
              <>
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Supplier / Vendor (Optional)</span>
              </>
            }
            value={restockVendorId}
            onChange={(e) => setRestockVendorId(e.target.value)}
            options={[
              { value: "", label: "-- No Specific Vendor --" },
              ...vendors.map((v) => ({
                value: String(v.id),
                label: `${v.name} ${v.pan_vat ? `(PAN: ${v.pan_vat})` : ""}`,
              })),
            ]}
          />

          <div>
            <Input
              label="Movement Note / Reference (Optional)"
              type="text"
              placeholder="e.g. Delivery Batch #842 from distributor"
              value={restockNote}
              onChange={(e) => setRestockNote(e.target.value)}
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => {
                setSelectedRestock(null);
                onClearActiveModals?.();
              }}
              className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer"
            >
              Confirm Restock
            </button>
          </div>
        </form>
      </Modal>

      {/* ==================== MODAL: ADJUST STOCK ==================== */}
      <Modal
        isOpen={!!selectedAdjust}
        onClose={() => {
          setSelectedAdjust(null);
          onClearActiveModals?.();
        }}
        title={`Adjust Stock: ${selectedAdjust?.name}`}
        subtitle="Manually override inventory level and log an ADJUSTMENT movement."
        maxWidth="md"
      >
        <form onSubmit={handleAdjustSubmit} className="space-y-4">
          <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-xs flex items-center justify-between">
            <span className="text-neutral-400">Current Recorded Stock:</span>
            <span className="font-mono font-bold text-neutral-100">
              {selectedAdjust?.current_stock} {selectedAdjust?.unit || "units"}
            </span>
          </div>

          <div>
            <Input
              label="New Accurate Stock Count *"
              type="number"
              required
              value={adjustTargetStock}
              onChange={(e) => setAdjustTargetStock(e.target.value)}
              className="font-mono"
            />
            {selectedAdjust && (
              <div className="text-[11px] text-neutral-500 mt-1 font-mono">
                Calculated adjustment delta:{" "}
                <span
                  className={
                    parseInt(adjustTargetStock, 10) -
                      selectedAdjust.current_stock >=
                    0
                      ? "text-emerald-400 font-semibold"
                      : "text-rose-400 font-semibold"
                  }
                >
                  {parseInt(adjustTargetStock, 10) -
                    selectedAdjust.current_stock >=
                  0
                    ? "+"
                    : ""}
                  {isNaN(parseInt(adjustTargetStock, 10))
                    ? 0
                    : parseInt(adjustTargetStock, 10) -
                      selectedAdjust.current_stock}{" "}
                  {selectedAdjust.unit || "units"}
                </span>
              </div>
            )}
          </div>

          <div>
            <Input
              label="Adjustment Reason *"
              type="text"
              required
              placeholder="e.g. Physical inventory recount / damaged items"
              value={adjustNote}
              onChange={(e) => setAdjustNote(e.target.value)}
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => {
                setSelectedAdjust(null);
                onClearActiveModals?.();
              }}
              className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer"
            >
              Apply Adjustment
            </button>
          </div>
        </form>
      </Modal>

      {/* ==================== MODAL: INDIVIDUAL MOVEMENT HISTORY ==================== */}
      <Modal
        isOpen={selectedMovements !== undefined && selectedMovements !== null}
        onClose={() => {
          setSelectedMovements(null);
          onClearActiveModals?.();
        }}
        title={
          selectedMovements
            ? `Stock Movement Ledger: ${selectedMovements.name}`
            : "All Stock Movements Audit Log"
        }
        subtitle="Every stock increase, decrease, sale, purchase, and adjustment recorded with timestamp."
        maxWidth="2xl"
      >
        <div className="space-y-3">
          <div className="max-h-[480px] overflow-y-auto border border-neutral-800 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-950 text-neutral-400 font-medium sticky top-0 border-b border-neutral-800">
                <tr>
                  <th className="py-2.5 px-4 font-mono">Date / Time</th>
                  {!selectedMovements && (
                    <th className="py-2.5 px-3">Product</th>
                  )}
                  <th className="py-2.5 px-3 text-center">Type</th>
                  <th className="py-2.5 px-3">Supplier</th>
                  <th className="py-2.5 px-3 text-right font-mono">
                    Qty Delta
                  </th>
                  <th className="py-2.5 px-4">Audit Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {movementsList.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-8 text-center text-neutral-500"
                    >
                      No stock movement records found for this item.
                    </td>
                  </tr>
                ) : (
                  movementsList.map((m) => {
                    const isPositive = m.quantity > 0;
                    return (
                      <tr key={m.id} className="hover:bg-neutral-800/30">
                        <td className="py-2.5 px-4 font-mono text-neutral-400 whitespace-nowrap">
                          {formatDateTime(m.created_at)}
                        </td>
                        {!selectedMovements && (
                          <td className="py-2.5 px-3 font-medium text-neutral-200">
                            {m.product_name}
                          </td>
                        )}
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                              m.type === "RESTOCK"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : m.type === "PURCHASE"
                                  ? "bg-teal-500/10 text-teal-400 border border-teal-500/20"
                                  : m.type === "SALE"
                                    ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            }`}
                          >
                            {m.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-neutral-400">
                          {m.vendor_name || "—"}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap ${
                            isPositive ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {isPositive ? `+${m.quantity}` : m.quantity}
                        </td>
                        <td className="py-2.5 px-4 text-neutral-300 break-words">
                          {m.note || "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="pt-3 flex justify-end">
            <button
              onClick={() => {
                setSelectedMovements(null);
                onClearActiveModals?.();
              }}
              className="px-4 py-1.5 text-xs text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* ==================== MODAL: BULK CREATE PRODUCTS (TABLE) ==================== */}
      <BulkProductModal
        isOpen={isBulkCreateOpen}
        onClose={() => setIsBulkCreateOpen(false)}
        currencySymbol={currencySymbol}
        lowStockThreshold={lowStockThreshold}
        onSuccess={() => {
          loadData();
          loadMovements();
        }}
      />
    </div>
  );
};
