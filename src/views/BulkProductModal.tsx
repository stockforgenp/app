import React, { useState, useEffect, useRef } from "react";
import {
  Plus,
  Trash2,
  Copy,
  ClipboardPaste,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { Modal } from "../components/common/Modal.tsx";
import { Select } from "../components/common/Select.tsx";
import { Product } from "../types/index.ts";
import { toMinorUnits, formatCurrency } from "../lib/utils/format.ts";
import {
  getAllProducts,
  createProductsBatch,
} from "../lib/services/productService.ts";
import { useLanguage } from "../context/LanguageContext.tsx";
import { useToast } from "../context/ToastContext.tsx";
import { COMMON_UNITS, DEFAULT_PRODUCT_UNIT } from "../constants/index.ts";

export interface BulkProductRow {
  id: string;
  name: string;
  sku: string;
  unit: string;
  costPrice: string;
  sellingPrice: string;
  initialStock: string;
  minStockAlert: string;
}

export interface RowErrors {
  name?: string;
  sku?: string;
  costPrice?: string;
  sellingPrice?: string;
  initialStock?: string;
}

export interface BulkProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  currencySymbol: string;
  lowStockThreshold: number;
  onSuccess: () => void;
}

const createEmptyRow = (
  defaultUnit = DEFAULT_PRODUCT_UNIT,
): BulkProductRow => ({
  id: Math.random().toString(36).substring(2, 9),
  name: "",
  sku: "",
  unit: defaultUnit,
  costPrice: "",
  sellingPrice: "",
  initialStock: "0",
  minStockAlert: "",
});

export const BulkProductModal: React.FC<BulkProductModalProps> = ({
  isOpen,
  onClose,
  currencySymbol,
  lowStockThreshold,
  onSuccess,
}) => {
  const { isNepali, t } = useLanguage();
  const { showToast } = useToast();

  // Existing database products for duplicate validation
  const [existingProducts, setExistingProducts] = useState<Product[]>([]);

  // Rows state
  const [rows, setRows] = useState<BulkProductRow[]>(() => [createEmptyRow()]);

  // Track validation errors per row: rowId -> RowErrors
  const [rowErrors, setRowErrors] = useState<Record<string, RowErrors>>({});

  // Track which rows have been touched or attempted to submit/add
  const [touchedRowIds, setTouchedRowIds] = useState<Set<string>>(new Set());

  // Paste dialog state
  const [isPasteDialogOpen, setIsPasteDialogOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // References to input elements for auto-focusing on validation failure or new row add
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Load existing products from DB when modal opens
  useEffect(() => {
    if (isOpen) {
      try {
        setExistingProducts(getAllProducts());
      } catch (err) {
        console.error("Error fetching existing products for validation:", err);
      }
      setRows([createEmptyRow()]);
      setRowErrors({});
      setTouchedRowIds(new Set());
      setPasteText("");
      setIsPasteDialogOpen(false);
    }
  }, [isOpen]);

  // Core row validation function
  const validateRow = (
    row: BulkProductRow,
    rowIndex: number,
    allRows: BulkProductRow[],
  ): RowErrors => {
    const errors: RowErrors = {};

    // 1. Product Name Validation
    const trimmedName = row.name.trim();
    if (!trimmedName) {
      errors.name = t("prod_bulk_val_name_req", "Product name is required");
    } else {
      // Check duplicate within the current batch
      const dupInBatch = allRows.some(
        (r, idx) =>
          idx !== rowIndex &&
          r.name.trim().toLowerCase() === trimmedName.toLowerCase(),
      );
      if (dupInBatch) {
        errors.name = t(
          "prod_bulk_val_dup_name",
          "Duplicate product name in table",
        );
      } else {
        // Check duplicate against existing inventory in database
        const existsInDb = existingProducts.some(
          (p) => p.name.trim().toLowerCase() === trimmedName.toLowerCase(),
        );
        if (existsInDb) {
          errors.name = t(
            "prod_bulk_val_exists_name",
            "Product already exists in inventory",
          );
        }
      }
    }

    // 2. SKU Validation (if provided)
    const trimmedSku = row.sku.trim();
    if (trimmedSku) {
      // Check duplicate within batch
      const dupSkuInBatch = allRows.some(
        (r, idx) =>
          idx !== rowIndex &&
          r.sku.trim().toLowerCase() === trimmedSku.toLowerCase(),
      );
      if (dupSkuInBatch) {
        errors.sku = t("prod_bulk_val_dup_sku", "Duplicate SKU in table");
      } else {
        // Check duplicate in database
        const existsSkuInDb = existingProducts.some(
          (p) =>
            p.sku && p.sku.trim().toLowerCase() === trimmedSku.toLowerCase(),
        );
        if (existsSkuInDb) {
          errors.sku = t(
            "prod_bulk_val_exists_sku",
            "SKU already exists in inventory",
          );
        }
      }
    }

    // 3. Cost Price Validation
    const trimmedCost = row.costPrice.trim();
    if (!trimmedCost) {
      errors.costPrice = t("prod_bulk_val_cost_req", "Cost price is required");
    } else {
      const costNum = parseFloat(trimmedCost);
      if (isNaN(costNum) || costNum < 0) {
        errors.costPrice = isNepali
          ? "मान्य सकारात्मक लागत रकम हुनुपर्छ"
          : "Must be a valid positive amount";
      }
    }

    // 4. Selling Price Validation
    const trimmedSelling = row.sellingPrice.trim();
    if (!trimmedSelling) {
      errors.sellingPrice = t(
        "prod_bulk_val_sell_req",
        "Selling price is required",
      );
    } else {
      const sellingNum = parseFloat(trimmedSelling);
      if (isNaN(sellingNum) || sellingNum < 0) {
        errors.sellingPrice = isNepali
          ? "मान्य सकारात्मक बिक्री रकम हुनुपर्छ"
          : "Must be a valid positive amount";
      }
    }

    // 5. Initial Stock Validation (if not empty)
    const trimmedStock = row.initialStock.trim();
    if (trimmedStock) {
      const stockNum = parseFloat(trimmedStock);
      if (isNaN(stockNum) || stockNum < 0 || !Number.isInteger(stockNum)) {
        errors.initialStock = isNepali
          ? "मौज्दात शून्य वा धनात्मक पूर्ण संख्या हुनुपर्छ"
          : "Stock must be a whole non-negative number";
      }
    }

    return errors;
  };

  // Re-validate all touched rows whenever rows change
  const handleUpdateRow = (
    id: string,
    field: keyof BulkProductRow,
    value: string,
  ) => {
    setRows((prev) => {
      const updated = prev.map((r) =>
        r.id === id ? { ...r, [field]: value } : r,
      );

      // Re-run validation for updated row and any row that might share duplicate name/sku
      const newErrors = { ...rowErrors };
      updated.forEach((r, idx) => {
        if (touchedRowIds.has(r.id) || r.id === id) {
          const errs = validateRow(r, idx, updated);
          if (Object.keys(errs).length > 0) {
            newErrors[r.id] = errs;
          } else {
            delete newErrors[r.id];
          }
        }
      });
      setRowErrors(newErrors);

      return updated;
    });
  };

  /**
   * VALIDATE BEFORE ADDING ANOTHER PRODUCT:
   * When user clicks "+ Add Another Product" or presses Enter on the last row:
   * Validates all current rows (especially the last row).
   * If any required fields are missing or invalid:
   * - Marks the row as touched
   * - Displays inline error indicators
   * - Focuses the first invalid input
   * - Alerts the user with a descriptive toast
   * - Blocks addition of a new row until valid
   */
  const handleAddAnotherProduct = () => {
    if (rows.length === 0) {
      const firstRow = createEmptyRow();
      setRows([firstRow]);
      return;
    }

    // Check all existing rows for validation errors
    let firstInvalidFieldRef: string | null = null;
    let firstErrorMessage = "";
    const newErrorsMap: Record<string, RowErrors> = {};
    const updatedTouched = new Set(touchedRowIds);

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      updatedTouched.add(r.id);
      const errs = validateRow(r, i, rows);

      if (Object.keys(errs).length > 0) {
        newErrorsMap[r.id] = errs;
        if (!firstInvalidFieldRef) {
          if (errs.name) {
            firstInvalidFieldRef = `${r.id}-name`;
            firstErrorMessage = errs.name;
          } else if (errs.costPrice) {
            firstInvalidFieldRef = `${r.id}-costPrice`;
            firstErrorMessage = errs.costPrice;
          } else if (errs.sellingPrice) {
            firstInvalidFieldRef = `${r.id}-sellingPrice`;
            firstErrorMessage = errs.sellingPrice;
          } else if (errs.sku) {
            firstInvalidFieldRef = `${r.id}-sku`;
            firstErrorMessage = errs.sku;
          } else if (errs.initialStock) {
            firstInvalidFieldRef = `${r.id}-initialStock`;
            firstErrorMessage = errs.initialStock;
          }
        }
      }
    }

    setTouchedRowIds(updatedTouched);
    setRowErrors(newErrorsMap);

    if (Object.keys(newErrorsMap).length > 0) {
      showToast(
        isNepali
          ? `नयाँ सामान थप्नु अघि पङ्क्ति #${rows.length} को विवरण पूरा गर्नुहोस्: ${firstErrorMessage}`
          : `Please complete the current product (#${rows.length}) before adding another: ${firstErrorMessage}`,
        "warning",
      );

      // Auto-focus the problematic input
      if (firstInvalidFieldRef && inputRefs.current[firstInvalidFieldRef]) {
        inputRefs.current[firstInvalidFieldRef]?.focus();
      }
      return;
    }

    // All current rows are valid -> safely add a new row
    const newRow = createEmptyRow();
    setRows((prev) => [...prev, newRow]);

    // Auto-scroll to bottom and focus the product name input of the new row
    setTimeout(() => {
      if (tableContainerRef.current) {
        tableContainerRef.current.scrollTop =
          tableContainerRef.current.scrollHeight;
      }
      const newNameRef = `${newRow.id}-name`;
      if (inputRefs.current[newNameRef]) {
        inputRefs.current[newNameRef]?.focus();
      }
    }, 60);

    showToast(
      isNepali
        ? `पङ्क्ति #${rows.length} मान्य भयो। नयाँ पङ्क्ति #${rows.length + 1} थपियो।`
        : `Product #${rows.length} validated. Added row #${rows.length + 1}.`,
      "info",
    );
  };

  const handleRemoveRow = (id: string) => {
    if (rows.length <= 1) {
      const reset = createEmptyRow();
      setRows([reset]);
      setRowErrors({});
      setTouchedRowIds(new Set());
      return;
    }

    setRows((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      // Revalidate remaining rows to clear batch duplicates if any
      const newErrors: Record<string, RowErrors> = {};
      updated.forEach((r, idx) => {
        if (touchedRowIds.has(r.id)) {
          const errs = validateRow(r, idx, updated);
          if (Object.keys(errs).length > 0) {
            newErrors[r.id] = errs;
          }
        }
      });
      setRowErrors(newErrors);
      return updated;
    });

    const updatedTouched = new Set(touchedRowIds);
    updatedTouched.delete(id);
    setTouchedRowIds(updatedTouched);
  };

  const handleDuplicateRow = (row: BulkProductRow) => {
    // Validate the row being duplicated first
    const rowErrorsCurrent = validateRow(
      row,
      rows.findIndex((r) => r.id === row.id),
      rows,
    );
    if (Object.keys(rowErrorsCurrent).length > 0) {
      setTouchedRowIds((prev) => new Set([...prev, row.id]));
      setRowErrors((prev) => ({ ...prev, [row.id]: rowErrorsCurrent }));
      showToast(
        isNepali
          ? "यो सामानको विवरण पूरा गरेपछि मात्र कपी गर्नुहोस्।"
          : "Please resolve errors before duplicating this product.",
        "warning",
      );
      return;
    }

    const duplicated: BulkProductRow = {
      ...row,
      id: Math.random().toString(36).substring(2, 9),
      name: `${row.name} (Copy)`,
      sku: "", // Clear SKU so it auto-generates uniquely
    };
    setRows((prev) => [...prev, duplicated]);
  };

  // Keyboard navigation: Enter on the last input of the last row triggers adding another product with validation
  const handleKeyDown = (
    e: React.KeyboardEvent,
    index: number,
    field: keyof BulkProductRow,
  ) => {
    if (e.key === "Enter") {
      if (index === rows.length - 1) {
        e.preventDefault();
        handleAddAnotherProduct();
      } else {
        // Jump to next row's same field
        e.preventDefault();
        const nextRow = rows[index + 1];
        const nextRefKey = `${nextRow.id}-${field}`;
        if (inputRefs.current[nextRefKey]) {
          inputRefs.current[nextRefKey]?.focus();
        }
      }
    }
  };

  // Parsing pasted spreadsheet / CSV data
  const handleParsePaste = () => {
    if (!pasteText.trim()) return;

    const lines = pasteText
      .trim()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const parsedRows: BulkProductRow[] = [];

    for (const line of lines) {
      let cols = line.split("\t");
      if (cols.length === 1 && line.includes(",")) {
        cols = line.split(",").map((c) => c.replace(/^"(.*)"$/, "$1").trim());
      } else {
        cols = cols.map((c) => c.trim());
      }

      const firstCol = cols[0]?.toLowerCase() || "";
      if (
        firstCol === "name" ||
        firstCol === "product name" ||
        firstCol === "सामानको नाम" ||
        firstCol === "item"
      ) {
        continue;
      }

      const name = cols[0] || "";
      const sku = cols[1] || "";
      const unit = cols[2] || "pcs";
      const costPrice = cols[3] || "";
      const sellingPrice = cols[4] || "";
      const initialStock = cols[5] || "0";
      const minStockAlert = cols[6] || "";

      if (name || costPrice || sellingPrice) {
        parsedRows.push({
          id: Math.random().toString(36).substring(2, 9),
          name,
          sku,
          unit: unit || "pcs",
          costPrice,
          sellingPrice,
          initialStock: initialStock || "0",
          minStockAlert,
        });
      }
    }

    if (parsedRows.length > 0) {
      // Replace existing row if it is empty, else append
      const isFirstRowBlank =
        rows.length === 1 &&
        !rows[0].name.trim() &&
        !rows[0].costPrice.trim() &&
        !rows[0].sellingPrice.trim();

      const combined = isFirstRowBlank ? parsedRows : [...rows, ...parsedRows];

      // Run validation on all combined rows
      const newErrorsMap: Record<string, RowErrors> = {};
      const newTouched = new Set<string>();
      combined.forEach((r, idx) => {
        newTouched.add(r.id);
        const errs = validateRow(r, idx, combined);
        if (Object.keys(errs).length > 0) {
          newErrorsMap[r.id] = errs;
        }
      });

      setRows(combined);
      setTouchedRowIds(newTouched);
      setRowErrors(newErrorsMap);
      setIsPasteDialogOpen(false);
      setPasteText("");

      showToast(
        isNepali
          ? `${parsedRows.length} वटा सामान तालिकामा थपियो`
          : `Imported ${parsedRows.length} rows into table`,
        "success",
      );
    } else {
      showToast(
        isNepali
          ? "कुनै मान्य सामान डाटा फेला परेन"
          : "No valid product data found in pasted text",
        "warning",
      );
    }
  };

  // Real-time calculation of overall state
  const invalidRowsCount = Object.keys(rowErrors).length;
  const validRows = rows.filter((r) => {
    const errs = validateRow(
      r,
      rows.findIndex((item) => item.id === r.id),
      rows,
    );
    return Object.keys(errs).length === 0;
  });

  const totalStockValuation = validRows.reduce((acc, r) => {
    const qty = parseInt(r.initialStock, 10) || 0;
    const cost = parseFloat(r.costPrice) || 0;
    return acc + Math.max(0, qty) * Math.max(0, cost);
  }, 0);

  // Submit and save all valid products
  const handleSaveAll = async () => {
    // Validate every single row
    const newErrorsMap: Record<string, RowErrors> = {};
    const updatedTouched = new Set<string>();
    let firstInvalidFieldRef: string | null = null;
    let firstErrorMessage = "";

    rows.forEach((r, idx) => {
      updatedTouched.add(r.id);
      const errs = validateRow(r, idx, rows);
      if (Object.keys(errs).length > 0) {
        newErrorsMap[r.id] = errs;
        if (!firstInvalidFieldRef) {
          if (errs.name) {
            firstInvalidFieldRef = `${r.id}-name`;
            firstErrorMessage = `Row #${idx + 1}: ${errs.name}`;
          } else if (errs.costPrice) {
            firstInvalidFieldRef = `${r.id}-costPrice`;
            firstErrorMessage = `Row #${idx + 1}: ${errs.costPrice}`;
          } else if (errs.sellingPrice) {
            firstInvalidFieldRef = `${r.id}-sellingPrice`;
            firstErrorMessage = `Row #${idx + 1}: ${errs.sellingPrice}`;
          } else if (errs.sku) {
            firstInvalidFieldRef = `${r.id}-sku`;
            firstErrorMessage = `Row #${idx + 1}: ${errs.sku}`;
          }
        }
      }
    });

    setTouchedRowIds(updatedTouched);
    setRowErrors(newErrorsMap);

    if (Object.keys(newErrorsMap).length > 0) {
      showToast(
        isNepali
          ? `कृपया सबै त्रुटिहरू सच्याउनुहोस्: ${firstErrorMessage}`
          : `Please resolve all product errors before saving: ${firstErrorMessage}`,
        "warning",
      );
      if (firstInvalidFieldRef && inputRefs.current[firstInvalidFieldRef]) {
        inputRefs.current[firstInvalidFieldRef]?.focus();
      }
      return;
    }

    if (rows.length === 0) {
      showToast(
        isNepali
          ? "कृपया कम्तिमा एउटा सामान थप्नुहोस्।"
          : "Please add at least one product.",
        "warning",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const batchPayload = rows.map((r) => {
        const parsedAlert =
          r.minStockAlert.trim() !== "" ? parseInt(r.minStockAlert, 10) : null;
        const minAlert =
          parsedAlert !== null && !isNaN(parsedAlert)
            ? Math.max(0, parsedAlert)
            : null;

        return {
          name: r.name.trim(),
          sku: r.sku.trim() || null,
          unit: r.unit.trim().toLowerCase() || "pcs",
          cost_price: toMinorUnits(r.costPrice),
          selling_price: toMinorUnits(r.sellingPrice),
          current_stock: Math.max(0, parseInt(r.initialStock, 10) || 0),
          min_stock_alert: minAlert,
        };
      });

      const created = createProductsBatch(batchPayload);

      showToast(
        isNepali
          ? `${created.length} वटा सामानहरू सफलतापूर्वक थपियो!`
          : `Successfully created ${created.length} products!`,
        "success",
      );
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error("Bulk product creation failed:", err);
      showToast(
        (err as Error)?.message || "Failed to save products in batch",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={t("prod_bulk_title", "Add Multiple Products (Table Mode)")}
        subtitle={t(
          "prod_bulk_subtitle",
          "Rapidly enter products in spreadsheet format or paste from Excel / Google Sheets",
        )}
        maxWidth="full"
      >
        <div className="space-y-4">
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-neutral-800">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Add Another Product with validation button */}
              <button
                type="button"
                onClick={handleAddAnotherProduct}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs transition-colors cursor-pointer"
                title="Validate current row and add another product"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t("prod_bulk_add_another", "Add Another Product")}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPasteDialogOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 hover:text-white border border-neutral-700 rounded-lg transition-colors cursor-pointer"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-sky-400" />
                <span>{t("prod_bulk_paste", "Paste from Spreadsheet")}</span>
              </button>
            </div>

            {/* Live Status Indicators */}
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {validRows.length}{" "}
                  {t("prod_bulk_ready_count", "Ready to save")}
                </span>
              </span>
              {invalidRowsCount > 0 && (
                <span className="flex items-center gap-1.5 text-rose-400 font-medium">
                  <AlertCircle className="w-4 h-4" />
                  <span>
                    {invalidRowsCount}{" "}
                    {t("prod_bulk_incomplete_count", "Incomplete rows")}
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Validation Guidance Hint */}
          <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-lg px-3 py-2 text-xs flex items-center justify-between gap-2 text-neutral-400">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                {isNepali
                  ? "नयाँ सामान थप्नका लागि नाम, लागत र बिक्री मूल्य अनिवार्य छन्। फारम पूरा गरेपछि 'अर्को सामान थप्नुहोस्' वा 'Enter' थिच्नुहोस्।"
                  : "Product Name, Cost Price, and Selling Price are required. Press 'Add Another Product' or 'Enter' on the row to validate and proceed."}
              </span>
            </div>
            <span className="text-[11px] font-mono text-neutral-500 shrink-0 hidden sm:inline">
              Enter = Validate & Next Row
            </span>
          </div>

          {/* Interactive Table */}
          <div
            ref={tableContainerRef}
            className="overflow-x-auto overflow-y-auto max-h-[56vh] rounded-xl border border-neutral-800 bg-neutral-950/70"
          >
            <table className="w-full text-left text-xs border-collapse min-w-[980px]">
              <thead className="bg-neutral-900 sticky top-0 z-20 border-b border-neutral-800 text-neutral-300 uppercase tracking-wider text-[11px] font-semibold">
                <tr>
                  <th className="py-2.5 px-3 text-center w-14">#</th>
                  <th className="py-2.5 px-3 min-w-[220px]">
                    {t("prod_name", "Product Name")}{" "}
                    <span className="text-rose-400">*</span>
                  </th>
                  <th className="py-2.5 px-3 w-36">
                    {t("prod_sku", "SKU / Code")}
                  </th>
                  <th className="py-2.5 px-3 w-32">
                    {t("prod_unit_short", "Unit")}
                  </th>
                  <th className="py-2.5 px-3 w-36 text-right">
                    {t("prod_cost_price", "Cost Price")} ({currencySymbol}){" "}
                    <span className="text-rose-400">*</span>
                  </th>
                  <th className="py-2.5 px-3 w-36 text-right">
                    {t("prod_selling_price", "Selling Price")} ({currencySymbol}
                    ) <span className="text-rose-400">*</span>
                  </th>
                  <th className="py-2.5 px-3 w-28 text-right">
                    {t("prod_initial_stock", "Stock Qty")}
                  </th>
                  <th className="py-2.5 px-3 w-28 text-right">
                    {t("prod_min_alert", "Min Alert")}
                  </th>
                  <th className="py-2.5 px-3 text-center w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {rows.map((row, index) => {
                  const errors = rowErrors[row.id] || {};
                  const isTouched = touchedRowIds.has(row.id);
                  const hasErrors = isTouched && Object.keys(errors).length > 0;
                  const isValid =
                    !hasErrors &&
                    row.name.trim() &&
                    row.costPrice.trim() &&
                    row.sellingPrice.trim();

                  // Selling price below cost warning
                  const costNum = parseFloat(row.costPrice);
                  const sellNum = parseFloat(row.sellingPrice);
                  const isSellingBelowCost =
                    !isNaN(costNum) &&
                    !isNaN(sellNum) &&
                    costNum > 0 &&
                    sellNum > 0 &&
                    sellNum < costNum;

                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors group ${
                        hasErrors
                          ? "bg-rose-950/20 hover:bg-rose-950/30"
                          : isValid
                            ? "hover:bg-neutral-900/60"
                            : "hover:bg-neutral-900/40"
                      }`}
                    >
                      {/* Row # & Validation Status Badge */}
                      <td className="py-2 px-3 text-center font-mono text-[11px]">
                        <div className="flex items-center justify-center gap-1">
                          <span
                            className={
                              hasErrors
                                ? "text-rose-400 font-bold"
                                : isValid
                                  ? "text-emerald-400"
                                  : "text-neutral-500"
                            }
                          >
                            {index + 1}
                          </span>
                          {hasErrors ? (
                            <span
                              title={Object.values(errors).join(" · ")}
                              className="text-rose-400 cursor-help"
                            >
                              <AlertCircle className="w-3.5 h-3.5" />
                            </span>
                          ) : isValid ? (
                            <span
                              title="Valid product"
                              className="text-emerald-400"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Product Name */}
                      <td className="py-2 px-2 align-top">
                        <div>
                          <input
                            ref={(el) => {
                              inputRefs.current[`${row.id}-name`] = el;
                            }}
                            type="text"
                            placeholder={
                              isNepali
                                ? "सामानको नाम (उदा. बासमती चामल)"
                                : "e.g. Basmati Rice 25kg"
                            }
                            value={row.name}
                            onChange={(e) =>
                              handleUpdateRow(row.id, "name", e.target.value)
                            }
                            onKeyDown={(e) => handleKeyDown(e, index, "name")}
                            className={`w-full bg-neutral-900 border rounded-md px-2.5 py-1.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 ${
                              isTouched && errors.name
                                ? "border-rose-500/90 focus:ring-rose-500/40 bg-rose-950/20"
                                : "border-neutral-800 focus:border-emerald-500 focus:ring-emerald-500/30"
                            }`}
                          />
                          {isTouched && errors.name && (
                            <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1 font-sans">
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              <span>{errors.name}</span>
                            </p>
                          )}
                        </div>
                      </td>

                      {/* SKU */}
                      <td className="py-2 px-2 align-top">
                        <div>
                          <input
                            ref={(el) => {
                              inputRefs.current[`${row.id}-sku`] = el;
                            }}
                            type="text"
                            placeholder="Auto-generated"
                            value={row.sku}
                            onChange={(e) =>
                              handleUpdateRow(row.id, "sku", e.target.value)
                            }
                            onKeyDown={(e) => handleKeyDown(e, index, "sku")}
                            className={`w-full bg-neutral-900 border rounded-md px-2 py-1.5 text-xs font-mono text-neutral-300 placeholder-neutral-600 focus:outline-none focus:ring-1 ${
                              isTouched && errors.sku
                                ? "border-rose-500/90 focus:ring-rose-500/40 bg-rose-950/20"
                                : "border-neutral-800 focus:border-emerald-500 focus:ring-emerald-500/30"
                            }`}
                          />
                          {isTouched && errors.sku && (
                            <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1 font-sans">
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              <span>{errors.sku}</span>
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Unit (Searchable Select) */}
                      <td className="py-2 px-2 align-top">
                        <Select
                          portal
                          sizeVariant="sm"
                          searchable
                          searchPlaceholder={
                            isNepali
                              ? "एकाइ खोज्नुहोस् वा नयाँ लेख्नुहोस्..."
                              : "Search or type unit..."
                          }
                          allowCustom
                          value={row.unit || "pcs"}
                          onChange={(e) => {
                            if (
                              e.target.value !== undefined &&
                              e.target.value !== null
                            ) {
                              handleUpdateRow(
                                row.id,
                                "unit",
                                String(e.target.value),
                              );
                            }
                          }}
                          options={[
                            ...(row.unit &&
                            !COMMON_UNITS.some(
                              (u) =>
                                u.value.toLowerCase() ===
                                row.unit.toLowerCase(),
                            )
                              ? [
                                  {
                                    value: row.unit,
                                    label: `${row.unit} (custom)`,
                                    searchLabel: row.unit,
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
                      </td>

                      {/* Cost Price */}
                      <td className="py-2 px-2 align-top">
                        <div>
                          <input
                            ref={(el) => {
                              inputRefs.current[`${row.id}-costPrice`] = el;
                            }}
                            type="number"
                            step="any"
                            min="0"
                            placeholder="0.00"
                            value={row.costPrice}
                            onChange={(e) =>
                              handleUpdateRow(
                                row.id,
                                "costPrice",
                                e.target.value,
                              )
                            }
                            onKeyDown={(e) =>
                              handleKeyDown(e, index, "costPrice")
                            }
                            className={`w-full bg-neutral-900 border rounded-md px-2 py-1.5 text-xs font-mono text-right text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 ${
                              isTouched && errors.costPrice
                                ? "border-rose-500/90 focus:ring-rose-500/40 bg-rose-950/20"
                                : "border-neutral-800 focus:border-emerald-500 focus:ring-emerald-500/30"
                            }`}
                          />
                          {isTouched && errors.costPrice && (
                            <p className="text-[10px] text-rose-400 mt-1 flex items-center justify-end gap-1 font-sans">
                              <span>{errors.costPrice}</span>
                              <AlertCircle className="w-3 h-3 shrink-0" />
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Selling Price */}
                      <td className="py-2 px-2 align-top">
                        <div>
                          <input
                            ref={(el) => {
                              inputRefs.current[`${row.id}-sellingPrice`] = el;
                            }}
                            type="number"
                            step="any"
                            min="0"
                            placeholder="0.00"
                            value={row.sellingPrice}
                            onChange={(e) =>
                              handleUpdateRow(
                                row.id,
                                "sellingPrice",
                                e.target.value,
                              )
                            }
                            onKeyDown={(e) =>
                              handleKeyDown(e, index, "sellingPrice")
                            }
                            className={`w-full bg-neutral-900 border rounded-md px-2 py-1.5 text-xs font-mono text-right text-emerald-400 placeholder-neutral-600 focus:outline-none focus:ring-1 ${
                              isTouched && errors.sellingPrice
                                ? "border-rose-500/90 focus:ring-rose-500/40 bg-rose-950/20"
                                : "border-neutral-800 focus:border-emerald-500 focus:ring-emerald-500/30"
                            }`}
                          />
                          {isTouched && errors.sellingPrice ? (
                            <p className="text-[10px] text-rose-400 mt-1 flex items-center justify-end gap-1 font-sans">
                              <span>{errors.sellingPrice}</span>
                              <AlertCircle className="w-3 h-3 shrink-0" />
                            </p>
                          ) : isSellingBelowCost ? (
                            <p
                              className="text-[10px] text-amber-400 mt-1 flex items-center justify-end gap-1 font-sans"
                              title="Selling price is lower than cost price"
                            >
                              <span>
                                {isNepali
                                  ? "घाटा मूल्य (Loss)"
                                  : "Selling < Cost"}
                              </span>
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                            </p>
                          ) : null}
                        </div>
                      </td>

                      {/* Initial Stock */}
                      <td className="py-2 px-2 align-top">
                        <div>
                          <input
                            ref={(el) => {
                              inputRefs.current[`${row.id}-initialStock`] = el;
                            }}
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0"
                            value={row.initialStock}
                            onChange={(e) =>
                              handleUpdateRow(
                                row.id,
                                "initialStock",
                                e.target.value,
                              )
                            }
                            onKeyDown={(e) =>
                              handleKeyDown(e, index, "initialStock")
                            }
                            className={`w-full bg-neutral-900 border rounded-md px-2 py-1.5 text-xs font-mono text-right text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 ${
                              isTouched && errors.initialStock
                                ? "border-rose-500/90 focus:ring-rose-500/40 bg-rose-950/20"
                                : "border-neutral-800 focus:border-emerald-500 focus:ring-emerald-500/30"
                            }`}
                          />
                          {isTouched && errors.initialStock && (
                            <p className="text-[10px] text-rose-400 mt-1 flex items-center justify-end gap-1 font-sans">
                              <span>{errors.initialStock}</span>
                              <AlertCircle className="w-3 h-3 shrink-0" />
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Min Alert */}
                      <td className="py-2 px-2 align-top">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder={lowStockThreshold.toString()}
                          value={row.minStockAlert}
                          onChange={(e) =>
                            handleUpdateRow(
                              row.id,
                              "minStockAlert",
                              e.target.value,
                            )
                          }
                          onKeyDown={(e) =>
                            handleKeyDown(e, index, "minStockAlert")
                          }
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5 text-xs font-mono text-right text-neutral-400 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                        />
                      </td>

                      {/* Actions */}
                      <td className="py-2 px-2 text-center align-top">
                        <div className="flex items-center justify-center gap-1 mt-0.5">
                          <button
                            type="button"
                            onClick={() => handleDuplicateRow(row)}
                            className="p-1 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors cursor-pointer"
                            title="Duplicate Row"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(row.id)}
                            className="p-1 text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 rounded transition-colors cursor-pointer"
                            title="Delete Row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Bottom Summary & Actions Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-neutral-800 bg-neutral-900/60 p-4 rounded-xl">
            <div className="flex items-center gap-6 text-xs text-neutral-300 flex-wrap">
              <div>
                <span className="text-neutral-500">
                  {isNepali ? "कुल सामान:" : "Total Products:"}
                </span>{" "}
                <span className="font-mono font-semibold text-neutral-100">
                  {rows.length}
                </span>
              </div>
              <div>
                <span className="text-neutral-500">
                  {isNepali ? "सेभ गर्न तयार:" : "Valid Ready:"}
                </span>{" "}
                <span className="font-mono font-semibold text-emerald-400">
                  {validRows.length}
                </span>
              </div>
              {invalidRowsCount > 0 && (
                <div>
                  <span className="text-neutral-500">
                    {isNepali ? "त्रुटि भएका:" : "With Errors:"}
                  </span>{" "}
                  <span className="font-mono font-semibold text-rose-400">
                    {invalidRowsCount}
                  </span>
                </div>
              )}
              <div>
                <span className="text-neutral-500">
                  {t("prod_bulk_total_value", "Estimated Stock Value")}:
                </span>{" "}
                <span className="font-mono font-bold text-neutral-100">
                  {formatCurrency(
                    toMinorUnits(totalStockValuation.toString()),
                    currencySymbol,
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
              >
                {t("action_cancel", "Cancel")}
              </button>
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={isSubmitting || validRows.length === 0}
                className={`flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white rounded-lg shadow-sm transition-all cursor-pointer ${
                  validRows.length === 0 || isSubmitting
                    ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-500"
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? isNepali
                      ? "सेभ गरिँदैछ..."
                      : "Saving..."
                    : isNepali
                      ? `${validRows.length} सामानहरू सेभ गर्नुहोस्`
                      : `Save ${validRows.length} Products`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Spreadsheet / CSV Paste Sub-Modal */}
      {isPasteDialogOpen && (
        <Modal
          isOpen={isPasteDialogOpen}
          onClose={() => setIsPasteDialogOpen(false)}
          title={t("prod_bulk_paste_title", "Paste Spreadsheet / CSV Data")}
          subtitle={t(
            "prod_bulk_paste_hint",
            "Paste tab-separated rows copied from Excel or Google Sheets. Columns: Name | SKU | Unit | Cost Price | Selling Price | Initial Stock | Min Alert",
          )}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <textarea
              rows={8}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`Basmati Rice 25kg\tBR-001\tbag\t2200\t2500\t10\t2\nSunflower Oil 1L\tSO-002\tltr\t190\t220\t24\t5\nWai Wai Noodles\tWW-003\tpkt\t20\t25\t120\t20`}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs font-mono text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
            />
            <div className="flex items-center justify-between text-[11px] text-neutral-400">
              <span>
                {isNepali
                  ? "एक्सेलबाट सिधै सेलहरू छनौट गरी Copy (Ctrl+C) गर्नुहोस् र यहाँ Paste (Ctrl+V) गर्नुहोस्।"
                  : "Copy rows in Excel/Sheets (Ctrl+C) and paste here (Ctrl+V)."}
              </span>
              <button
                type="button"
                onClick={handleParsePaste}
                disabled={!pasteText.trim()}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isNepali ? "डेटा तालिकामा भर्नुहोस्" : "Populate Table"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};
