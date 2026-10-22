/**
 * Table Column Definitions: Products & Stock Inventory
 */
import {
  History,
  ShoppingCart,
  PlusCircle,
  SlidersHorizontal,
  Edit2,
  Trash2,
  Barcode,
  AlertOctagon,
} from "lucide-react";
import { Column } from "../components/common/DataTable.tsx";
import { Product } from "../types/index.ts";
import { ActionMenu } from "../components/common/ActionMenu.tsx";
import {
  formatCurrency,
  formatDate,
  capitalizeWords,
} from "../lib/utils/format.ts";

export interface ProductColumnsOptions {
  isNepali: boolean;
  currencySymbol: string;
  lowStockThreshold: number;
  formatNumberByLang?: (num: number) => string;
  onViewLedger: (product: Product) => void;
  onSellInPos?: (product: Product) => void;
  onRestock: (product: Product) => void;
  onAdjust: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onPrintBarcode?: (product: Product) => void;
  onWriteOff?: (product: Product) => void;
}

export function getProductColumns(
  options: ProductColumnsOptions,
): Column<Product>[] {
  const {
    isNepali,
    currencySymbol,
    lowStockThreshold,
    onViewLedger,
    onSellInPos,
    onRestock,
    onAdjust,
    onEdit,
    onDelete,
    onPrintBarcode,
    onWriteOff,
  } = options;

  return [
    {
      id: "name",
      header: isNepali ? "सामानको नाम" : "Product Name",
      accessor: (p: Product) => (
        <div>
          <button
            type="button"
            onClick={() => onViewLedger(p)}
            className="text-left font-semibold text-neutral-100 hover:text-emerald-400 transition-colors cursor-pointer capitalize"
            title={
              isNepali ? "चलान इतिहास हेर्नुहोस्" : "View stock movement ledger"
            }
          >
            {capitalizeWords(p.name)}
          </button>
          <div className="text-[11px] text-neutral-500 mt-0.5 font-mono">
            ID: #{p.id} · Added: {formatDate(p.created_at)}
          </div>
        </div>
      ),
      sortable: true,
      sortKey: (p: Product) => capitalizeWords(p.name),
    },
    {
      id: "sku",
      header: "SKU",
      accessor: (p: Product) => (
        <span className="font-mono text-neutral-400">
          {p.sku || <span className="text-neutral-600 italic">None</span>}
        </span>
      ),
      sortable: true,
      sortKey: (p: Product) => p.sku || "",
    },
    {
      id: "unit",
      header: isNepali ? "इकाइ" : "Unit",
      align: "center",
      accessor: (p: Product) => (
        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-neutral-800 text-neutral-300 border border-neutral-700/60">
          {p.unit || "pcs"}
        </span>
      ),
      sortable: true,
      sortKey: (p: Product) => p.unit || "pcs",
    },
    {
      id: "cost_price",
      header: isNepali ? "लागत मूल्य" : "Cost Price",
      align: "right",
      accessor: (p: Product) => (
        <span className="font-mono text-neutral-400 tabular-nums">
          {formatCurrency(p.cost_price, currencySymbol)}
        </span>
      ),
      sortable: true,
      sortKey: (p: Product) => p.cost_price,
    },
    {
      id: "selling_price",
      header: isNepali ? "बिक्री मूल्य" : "Selling Price",
      align: "right",
      accessor: (p: Product) => {
        const marginPct =
          p.selling_price > 0
            ? Math.round(
                ((p.selling_price - p.cost_price) / p.selling_price) * 100,
              )
            : 0;
        return (
          <div className="font-mono text-neutral-200 font-medium tabular-nums">
            <div>{formatCurrency(p.selling_price, currencySymbol)}</div>
            <div className="text-[10px] text-neutral-500 font-sans">
              {marginPct}% margin
            </div>
            {p.wholesale_price && p.wholesale_price > 0 && (
              <div className="text-[10px] text-amber-400 font-sans font-medium">
                W: {formatCurrency(p.wholesale_price, currencySymbol)}
              </div>
            )}
          </div>
        );
      },
      sortable: true,
      sortKey: (p: Product) => p.selling_price,
    },
    {
      id: "current_stock",
      header: isNepali ? "हालको मौज्दात" : "Current Stock",
      align: "right",
      accessor: (p: Product) => {
        const specificThreshold =
          p.min_stock_alert !== null && p.min_stock_alert !== undefined
            ? p.min_stock_alert
            : lowStockThreshold;
        const isLow = p.current_stock <= specificThreshold;
        return (
          <div className="font-mono tabular-nums">
            <div>
              <span
                className={`font-semibold ${
                  isLow ? "text-amber-400 font-bold" : "text-neutral-200"
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
          </div>
        );
      },
      sortable: true,
      sortKey: (p: Product) => p.current_stock,
    },
    {
      id: "valuation",
      header: isNepali ? "मौज्दात मूल्य" : "Stock Value",
      align: "right",
      accessor: (p: Product) => {
        const valuation = Math.max(0, p.current_stock * p.cost_price);
        return (
          <span className="font-mono font-semibold text-emerald-400 tabular-nums">
            {formatCurrency(valuation, currencySymbol)}
          </span>
        );
      },
      sortable: true,
      sortKey: (p: Product) => Math.max(0, p.current_stock * p.cost_price),
    },
    {
      id: "actions",
      header: isNepali ? "कार्यहरू" : "Actions",
      align: "right",
      accessor: (p: Product) => (
        <div className="flex items-center justify-end">
          <ActionMenu
            align="right"
            items={[
              ...(onSellInPos
                ? [
                    {
                      label: isNepali ? "बिक्रीमा थप्नुहोस्" : "Sell in POS",
                      icon: ShoppingCart,
                      color: "emerald" as const,
                      action: () => onSellInPos(p),
                    },
                  ]
                : []),
              {
                label: isNepali ? "मौज्दात थप (Restock)" : "Restock Units",
                icon: PlusCircle,
                color: "emerald" as const,
                action: () => onRestock(p),
              },
              ...(onPrintBarcode
                ? [
                    {
                      label: isNepali ? "बारकोड प्रिन्ट (Barcode)" : "Print Barcode",
                      icon: Barcode,
                      color: "sky" as const,
                      action: () => onPrintBarcode(p),
                    },
                  ]
                : []),
              {
                label: isNepali ? "मौज्दात मिलान (Adjust)" : "Adjust Count",
                icon: SlidersHorizontal,
                color: "amber" as const,
                action: () => onAdjust(p),
              },
              ...(onWriteOff
                ? [
                    {
                      label: isNepali ? "ड्यामेज / नष्ट (Write-Off)" : "Scrap / Write-Off",
                      icon: AlertOctagon,
                      color: "rose" as const,
                      action: () => onWriteOff(p),
                    },
                  ]
                : []),
              {
                label: isNepali ? "चलान इतिहास (Ledger)" : "Movement History",
                icon: History,
                color: "indigo" as const,
                action: () => onViewLedger(p),
              },
              {
                label: isNepali ? "विवरण सम्पादन (Edit)" : "Edit Product",
                icon: Edit2,
                color: "sky" as const,
                action: () => onEdit(p),
              },
              {
                label: isNepali
                  ? "सामान मेटाउनुहोस् (Delete)"
                  : "Delete Product",
                icon: Trash2,
                color: "rose" as const,
                isDestructive: true,
                action: () => onDelete(p),
              },
            ]}
          />
        </div>
      ),
    },
  ];
}
