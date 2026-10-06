import { Building2 } from "lucide-react";
import { StockMovement } from "../types/index.ts";
import { Column } from "../components/common/DataTable.tsx";
import { formatDateTime } from "../helpers/formatHelpers.ts";

export interface StockMovementColumnOptions {
  isNepali: boolean;
  formatNumberByLang?: (num: number) => string;
}

export function getStockMovementColumns(
  options: StockMovementColumnOptions,
): Column<StockMovement>[] {
  const { isNepali, formatNumberByLang } = options;

  return [
    {
      id: "created_at",
      header: isNepali ? "मिति र समय" : "Timestamp",
      accessor: (m) => (
        <span className="font-mono text-neutral-400 whitespace-nowrap">
          {formatDateTime(m.created_at)}
        </span>
      ),
      sortable: true,
      sortKey: (m) => m.created_at,
    },
    {
      id: "product",
      header: isNepali ? "सामान विवरण" : "Product Item",
      accessor: (m) => (
        <div>
          <div className="font-semibold text-neutral-200">
            {m.product_name || `Product #${m.product_id}`}
          </div>
          <div className="text-[10px] text-neutral-500 font-mono">
            ID: #{m.product_id}
          </div>
        </div>
      ),
      sortable: true,
      sortKey: (m) => m.product_name || "",
    },
    {
      id: "type",
      header: isNepali ? "प्रकार" : "Movement Type",
      align: "center",
      accessor: (m) => (
        <span
          className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded ${
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
      ),
      sortable: true,
      sortKey: (m) => m.type,
    },
    {
      id: "vendor",
      header: isNepali ? "स्रोत / आपूर्तिकर्ता" : "Vendor / Source",
      accessor: (m) =>
        m.vendor_name ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-800 text-neutral-300 border border-neutral-700/60">
            <Building2 className="w-3 h-3 text-emerald-400" />
            <span className="truncate max-w-[140px]">{m.vendor_name}</span>
          </span>
        ) : (
          <span className="text-neutral-600 text-[11px]">—</span>
        ),
      sortable: true,
      sortKey: (m) => m.vendor_name || "",
    },
    {
      id: "quantity",
      header: isNepali ? "मात्रा परिवर्तन (Delta)" : "Quantity Delta",
      align: "right",
      accessor: (m) => {
        const isPositive = m.quantity > 0;
        const formattedQty = formatNumberByLang
          ? formatNumberByLang(Math.abs(m.quantity))
          : Math.abs(m.quantity);
        return (
          <span
            className={`font-mono font-bold whitespace-nowrap ${
              isPositive ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {isPositive ? `+${formattedQty}` : `-${formattedQty}`}{" "}
            {m.product_unit || "units"}
          </span>
        );
      },
      sortable: true,
      sortKey: (m) => m.quantity,
    },
    {
      id: "note",
      header: isNepali ? "कैफियत / सन्दर्भ" : "Audit Reference / Note",
      accessor: (m) => (
        <span className="text-neutral-300 break-words">{m.note || "—"}</span>
      ),
    },
  ];
}
