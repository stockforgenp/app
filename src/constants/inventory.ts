/**
 * Inventory, Stock Ledger & Movement Constants
 * Filter definitions, stock thresholds, and transaction movement types.
 */

export type StockStatusFilter =
  | "all"
  | "in_stock"
  | "low_stock"
  | "out_of_stock";

export interface StockStatusOption {
  value: StockStatusFilter;
  label: string;
}

export const getStockStatusOptions = (
  isNepali: boolean = false,
): StockStatusOption[] => [
  {
    value: "all",
    label: isNepali ? "सबै मौज्दात अवस्था" : "All Stock Levels",
  },
  {
    value: "in_stock",
    label: isNepali ? "मौज्दातमा उपलब्ध (> 0)" : "In Stock (> 0)",
  },
  {
    value: "low_stock",
    label: `⚠️ ${isNepali ? "कम मौज्दात मात्र (Low Stock)" : "Low Stock (≤ threshold)"}`,
  },
  {
    value: "out_of_stock",
    label: `❌ ${isNepali ? "रित्तिएको मौज्दात (Out of Stock)" : "Out of Stock (0)"}`,
  },
];

export const STOCK_STATUS_OPTIONS: StockStatusOption[] =
  getStockStatusOptions(false);

export type MovementTypeFilter =
  | "ALL"
  | "RESTOCK"
  | "PURCHASE"
  | "SALE"
  | "ADJUSTMENT"
  | "RETURN";

export interface MovementTypeOption {
  value: MovementTypeFilter;
  label: string;
}

export const getMovementTypeOptions = (
  isNepali: boolean = false,
): MovementTypeOption[] => [
  {
    value: "ALL",
    label: isNepali ? "सबै चलान प्रकार (All)" : "All Movement Types",
  },
  { value: "RESTOCK", label: "RESTOCK (Manual / Delivery)" },
  { value: "PURCHASE", label: "PURCHASE (Supplier Order)" },
  { value: "SALE", label: "SALE (Customer Order)" },
  { value: "ADJUSTMENT", label: "ADJUSTMENT (Count Recount)" },
  {
    value: "RETURN",
    label: isNepali
      ? "फिर्ता (Sales / Purchase Return)"
      : "RETURN (Sales / Purchase Return)",
  },
];

export const MOVEMENT_TYPE_OPTIONS: MovementTypeOption[] =
  getMovementTypeOptions(false);

export type ProductSortField =
  | "name"
  | "stock"
  | "cost"
  | "selling"
  | "valuation"
  | "date";

export type SortOrder = "asc" | "desc";
