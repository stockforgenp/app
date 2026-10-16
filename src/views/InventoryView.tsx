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
import { motion } from "framer-motion";
import { Plus, Boxes, Building2, Table2, Printer } from "lucide-react";
import { Product, StockMovement, Vendor } from "../types/index.ts";
import {
  getAllProducts,
  deleteProduct,
} from "../lib/services/productService.ts";
import {
  restockProduct,
  adjustStock,
  getStockMovements,
} from "../lib/services/inventoryService.ts";
import { getAllVendors } from "../lib/services/vendorService.ts";
import { formatCurrency, formatDateTime, capitalizeWords } from "../lib/utils/format.ts";
import { Modal } from "../components/common/Modal.tsx";
import { ConfirmDialog } from "../components/common/ConfirmDialog.tsx";
import { DataTable, Column } from "../components/common/DataTable.tsx";
import { getProductColumns } from "../columns/index.ts";
import { Select } from "../components/common/Select.tsx";
import { Input } from "../components/common/Input.tsx";
import { NewProductForm } from "../components/forms/NewProductForm.tsx";
import { BulkProductModal } from "./BulkProductModal.tsx";
import { PrintStockLedgerModal } from "../components/common/PrintStockLedgerModal.tsx";
import { DatePreset } from "../lib/utils/dateFilters.ts";
import { useToast } from "../context/ToastContext.tsx";
import { subscribeToDbChanges } from "../lib/db/sqliteEngine.ts";
import { useLanguage } from "../context/LanguageContext.tsx";
import {
  getStockStatusOptions,
  StockStatusFilter,
  ProductSortField,
  SortOrder,
} from "../constants/index.ts";

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
  const [stockStatusFilter, setStockStatusFilter] =
    useState<StockStatusFilter>("all");
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>("ALL");

  // Sorting
  const [sortBy, setSortBy] = useState<ProductSortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

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

  // Stock Ledger Print Modals State
  const [isPrintCatalogLedgerOpen, setIsPrintCatalogLedgerOpen] = useState(false);
  const [isPrintItemLedgerOpen, setIsPrintItemLedgerOpen] = useState(false);

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
    const targetProductId = productId ?? selectedMovements?.id;
    if (!targetProductId) {
      setMovementsList([]);
      return;
    }
    try {
      setMovementsList(
        getStockMovements({
          productId: targetProductId,
        }),
      );
    } catch (e) {
      console.error("Error loading movements:", e);
    }
  };

  useEffect(() => {
    loadData();
    if (selectedMovements) {
      loadMovements(selectedMovements.id);
    } else {
      setMovementsList([]);
    }
    const unsubscribe = subscribeToDbChanges(() => {
      loadData();
      if (selectedMovements) {
        loadMovements(selectedMovements.id);
      }
    });
    return unsubscribe;
  }, [selectedMovements]);

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
    setEditingProduct(null);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setIsCreateOpen(false);
    setEditingProduct(p);
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

  // Table Columns for Shared DataTable
  const productColumns = useMemo<Column<Product>[]>(
    () =>
      getProductColumns({
        isNepali,
        currencySymbol,
        lowStockThreshold,
        formatNumberByLang,
        onViewLedger: (p) => {
          setSelectedMovements(p);
          loadMovements(p.id);
        },
        onSellInPos: onStartSaleWithProducts
          ? (p) => onStartSaleWithProducts([{ product: p, quantity: 1 }])
          : undefined,
        onRestock: (p) => {
          setSelectedRestock(p);
          setRestockQty("10");
          setRestockNote("Inventory restock delivery");
          setRestockVendorId("");
        },
        onAdjust: (p) => {
          setSelectedAdjust(p);
          setAdjustTargetStock(p.current_stock.toString());
          setAdjustNote("Physical inventory recount");
        },
        onEdit: (p) => handleOpenEdit(p),
        onDelete: (p) => setDeletingProduct(p),
      }),
    [
      isNepali,
      currencySymbol,
      lowStockThreshold,
      formatNumberByLang,
      onStartSaleWithProducts,
    ],
  );

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

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-150">
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

      {/* Unified Shared DataTable with Integrated Search, Date Filter, Status Filter, Sorting, Actions, and Pagination */}
      <DataTable<Product>
        data={filteredProducts}
        columns={productColumns}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder={
          isNepali
            ? "सामानको नाम, SKU वा कोड खोज्नुहोस्..."
            : "Search by title, SKU, or ID..."
        }
        filtersSlot={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={stockStatusFilter}
              onChange={(e) =>
                setStockStatusFilter(e.target.value as StockStatusFilter)
              }
              options={getStockStatusOptions(isNepali)}
              containerClassName="w-full sm:w-48"
              sizeVariant="sm"
            />
          </div>
        }
        dateFilterConfig={{
          preset: datePreset,
          onPresetChange: (p, start, end) => {
            setDatePreset(p);
            setStartDate(start);
            setEndDate(end);
          },
          startDate,
          endDate,
          onStartDateChange: setStartDate,
          onEndDateChange: setEndDate,
          hasActiveFilters,
          onClear: handleClearFilters,
        }}
        extraActionsSlot={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPrintCatalogLedgerOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-neutral-200 bg-neutral-800 hover:bg-neutral-700 hover:text-white border border-neutral-700 rounded-lg shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isNepali ? "खाता प्रिन्ट" : "Print Ledger"}</span>
            </button>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t("prod_add_button", "Add Product")}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsBulkCreateOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-neutral-200 bg-neutral-800 hover:bg-neutral-700 hover:text-white border border-neutral-700 rounded-lg shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <Table2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {isNepali
                  ? "थोक सामान थप्नुहोस् (तालिका)"
                  : "Add Multiple (Table)"}
              </span>
            </button>
          </div>
        }
        enablePagination={true}
        pageSize={15}
        pageSizeOptions={[10, 15, 25, 50, 100]}
        emptyIcon={Boxes}
        emptyTitle={
          isNepali
            ? "कुनै सामान फेला परेन।"
            : "No matching inventory items found."
        }
        emptyMessage={
          hasActiveFilters
            ? isNepali
              ? "फिल्टर वा खोज हटाएर पुनः प्रयास गर्नुहोस्।"
              : "Try clearing date, vendor, or search filters to see all products."
            : isNepali
              ? "सामान थप्न तलका बटनहरू प्रयोग गर्नुहोस्।"
              : "Click below to register products one by one or in bulk table format."
        }
        emptyAction={
          !hasActiveFilters ? (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleOpenCreate}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t("prod_add_button", "Add Product")}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsBulkCreateOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-neutral-200 bg-neutral-800 hover:bg-neutral-700 hover:text-white border border-neutral-700 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <Table2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {isNepali
                    ? "थोक सामान थप्नुहोस् (तालिका)"
                    : "Add Multiple (Table)"}
                </span>
              </button>
            </div>
          ) : undefined
        }
      />

      {/* ==================== MODAL: CREATE / EDIT PRODUCT ==================== */}
      <Modal
        isOpen={isCreateOpen || !!editingProduct}
        onClose={() => {
          setIsCreateOpen(false);
          setEditingProduct(null);
        }}
        title={
          editingProduct
            ? t("prod_edit_title", "Edit Product Master")
            : t("prod_create_title", "Create New Product")
        }
        subtitle={
          editingProduct
            ? t(
                "prod_edit_subtitle",
                "Update attributes, pricing, or unit of measure",
              )
            : isNepali
              ? "नयाँ सामानको विवरण, मूल्य, आपूर्तिकर्ता र प्रारम्भिक मौज्दात प्रविष्टि गर्नुहोस्।"
              : "Specify product attributes, pricing, vendor supplier, and initial stock."
        }
        maxWidth="md"
      >
        <NewProductForm
          editingProduct={editingProduct}
          onClose={() => {
            setIsCreateOpen(false);
            setEditingProduct(null);
          }}
          currencySymbol={currencySymbol}
          lowStockThreshold={lowStockThreshold}
          loadProducts={() => {
            loadData();
            loadMovements();
          }}
          onOpenBulkCreate={() => {
            setIsCreateOpen(false);
            setIsBulkCreateOpen(true);
          }}
        />
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
          setMovementsList([]);
          onClearActiveModals?.();
        }}
        title={
          selectedMovements
            ? isNepali
              ? `चलान खाता (Stock Ledger): ${selectedMovements.name}`
              : `Stock Movement Ledger: ${selectedMovements.name}`
            : isNepali
              ? "चलान अडिट लग"
              : "Stock Movements Audit Log"
        }
        subtitle={
          selectedMovements
            ? isNepali
              ? `SKU: ${selectedMovements.sku || "None"} · हालको मौज्दात: ${selectedMovements.current_stock} ${selectedMovements.unit || "pcs"} · यस सामानको सम्पूर्ण दाखिला, बिक्री तथा मौज्दात मिलानको विवरण`
              : `SKU: ${selectedMovements.sku || "None"} · Current Stock: ${selectedMovements.current_stock} ${selectedMovements.unit || "pcs"} · Complete audit log of restocks, purchases, sales, and adjustments.`
            : "Every stock increase, decrease, sale, purchase, and adjustment recorded with timestamp."
        }
        maxWidth="2xl"
      >
        <div className="space-y-3">
          <div className="max-h-[480px] overflow-y-auto border border-neutral-800 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-950 text-neutral-400 font-medium sticky top-0 border-b border-neutral-800">
                <tr>
                  <th className="py-2.5 px-4 font-mono">
                    {isNepali ? "मिति र समय" : "Date / Time"}
                  </th>
                  {!selectedMovements && (
                    <th className="py-2.5 px-3">
                      {isNepali ? "सामान" : "Product"}
                    </th>
                  )}
                  <th className="py-2.5 px-3 text-center">
                    {isNepali ? "प्रकार" : "Type"}
                  </th>
                  <th className="py-2.5 px-3">
                    {isNepali ? "आपूर्तिकर्ता" : "Supplier"}
                  </th>
                  <th className="py-2.5 px-3 text-right font-mono">
                    {isNepali ? "मात्रा परिवर्तन" : "Qty Delta"}
                  </th>
                  <th className="py-2.5 px-4">
                    {isNepali ? "कैफियत" : "Audit Note"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {movementsList.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-8 text-center text-neutral-500"
                    >
                      {isNepali
                        ? "यो सामानको कुनै चलान अभिलेख फेला परेन।"
                        : "No stock movement records found for this item."}
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
                                    : m.type === "RETURN"
                                      ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                      : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            }`}
                          >
                            {m.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-neutral-400 capitalize">
                          {m.vendor_name ? capitalizeWords(m.vendor_name) : "—"}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap ${
                            isPositive ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {isPositive ? `+${m.quantity}` : m.quantity}{" "}
                          <span className="font-normal text-[11px] text-neutral-400 font-sans">
                            {selectedMovements?.unit || m.product_unit || "pcs"}
                          </span>
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

          <div className="pt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsPrintItemLedgerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isNepali ? "चलान खाता प्रिन्ट" : "Print Ledger"}</span>
            </button>
            <button
              onClick={() => {
                setSelectedMovements(null);
                setMovementsList([]);
                onClearActiveModals?.();
              }}
              className="px-4 py-1.5 text-xs text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer"
            >
              {isNepali ? "बन्द गर्नुहोस्" : "Close"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ==================== MODAL: PRINT CATALOG STOCK LEDGER ==================== */}
      <PrintStockLedgerModal
        isOpen={isPrintCatalogLedgerOpen}
        onClose={() => setIsPrintCatalogLedgerOpen(false)}
        currencySymbol={currencySymbol}
        products={filteredProducts}
        lowStockThreshold={lowStockThreshold}
        filterLabel={
          stockStatusFilter !== "all"
            ? `Status: ${stockStatusFilter}`
            : undefined
        }
      />

      {/* ==================== MODAL: PRINT SINGLE ITEM STOCK LEDGER ==================== */}
      {selectedMovements && (
        <PrintStockLedgerModal
          isOpen={isPrintItemLedgerOpen}
          onClose={() => setIsPrintItemLedgerOpen(false)}
          currencySymbol={currencySymbol}
          product={selectedMovements}
          movements={movementsList}
        />
      )}

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
