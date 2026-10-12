/**
 * Table Column Definitions: Customers
 */
import {
  Users,
  Phone,
  Mail,
  MapPin,
  ShoppingBag,
  Copy,
  Check,
  Edit2,
  Trash2,
  Eye,
} from "lucide-react";
import { Column } from "../components/common/DataTable.tsx";
import { Customer } from "../types/index.ts";
import { ActionMenu } from "../components/common/ActionMenu.tsx";
import { formatCurrency } from "../helpers/formatHelpers.ts";

export interface CustomerColumnsOptions {
  isNepali: boolean;
  currencySymbol?: string;
  copiedPan?: string | null;
  formatNumberByLang?: (num: number) => string;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
  onViewSales?: (customer: Customer) => void;
  onCopyPan: (pan: string) => void;
  onCopyPhone?: (phone: string) => void;
}

export function getCustomerColumns(
  options: CustomerColumnsOptions,
): Column<Customer>[] {
  const {
    isNepali,
    currencySymbol = "Rs.",
    copiedPan,
    formatNumberByLang,
    onEdit,
    onDelete,
    onViewSales,
    onCopyPan,
    onCopyPhone,
  } = options;

  return [
    {
      id: "name",
      header: isNepali ? "ग्राहक" : "Customer",
      accessor: (c: Customer) => (
        <div>
          <div className="font-semibold text-neutral-200 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{c.name}</span>
            {(c.sales_count || 0) > 1 && (
              <span className="text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1.5 py-0.2 rounded font-medium">
                {isNepali ? "नियमित" : "Repeat"}
              </span>
            )}
          </div>
          {c.notes && (
            <p className="text-[10px] text-neutral-500 truncate max-w-xs mt-0.5">
              {c.notes}
            </p>
          )}
        </div>
      ),
      sortable: true,
      sortKey: (c: Customer) => c.name,
    },
    {
      id: "phone",
      header: isNepali ? "सम्पर्क नम्बर" : "Phone / Mobile",
      accessor: (c: Customer) =>
        c.phone ? (
          <div className="flex items-center gap-1 text-neutral-300 font-mono">
            <Phone className="w-3 h-3 text-neutral-500" />
            <span>{c.phone}</span>
          </div>
        ) : (
          <span className="text-neutral-600">—</span>
        ),
      sortable: true,
      sortKey: (c: Customer) => c.phone || "",
    },
    {
      id: "pan_vat",
      header: isNepali ? "PAN / VAT नम्बर" : "PAN / VAT",
      accessor: (c: Customer) =>
        c.pan_vat ? (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-neutral-200 bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-800 text-[11px]">
              {c.pan_vat}
            </span>
            <button
              type="button"
              onClick={() => onCopyPan(c.pan_vat!)}
              className="p-1 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded transition-colors cursor-pointer"
              title="Copy PAN/VAT"
            >
              {copiedPan === c.pan_vat ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
        ) : (
          <span className="text-neutral-600">—</span>
        ),
      sortable: true,
      sortKey: (c: Customer) => c.pan_vat || "",
    },
    {
      id: "address_email",
      header: isNepali ? "ठेगाना र इमेल" : "Email & Address",
      accessor: (c: Customer) => (
        <div className="space-y-0.5">
          {c.email && (
            <div className="flex items-center gap-1 text-neutral-300 truncate max-w-[200px]">
              <Mail className="w-3 h-3 text-neutral-500 shrink-0" />
              <span className="truncate">{c.email}</span>
            </div>
          )}
          {c.address && (
            <div className="flex items-center gap-1 text-neutral-400 text-[11px] truncate max-w-[200px]">
              <MapPin className="w-3 h-3 text-neutral-500 shrink-0" />
              <span className="truncate">{c.address}</span>
            </div>
          )}
          {!c.email && !c.address && (
            <span className="text-neutral-600">—</span>
          )}
        </div>
      ),
    },
    {
      id: "sales_count",
      header: isNepali ? "कुल अर्डर" : "Orders",
      align: "center",
      accessor: (c: Customer) =>
        onViewSales ? (
          <button
            type="button"
            onClick={() => onViewSales(c)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors cursor-pointer"
            title={
              isNepali
                ? "बिक्री रसिदहरू हेर्नुहोस्"
                : "View purchase history receipts"
            }
          >
            <ShoppingBag className="w-3 h-3" />
            <span>
              {formatNumberByLang
                ? formatNumberByLang(c.sales_count || 0)
                : c.sales_count || 0}
            </span>
          </button>
        ) : (
          <span className="font-mono text-neutral-300">
            {c.sales_count || 0}
          </span>
        ),
      sortable: true,
      sortKey: (c: Customer) => c.sales_count || 0,
    },
    {
      id: "total_spent",
      header: isNepali ? "कुल कारोबार" : "Total Spent",
      align: "right",
      accessor: (c: Customer) => (
        <span className="font-mono font-medium text-emerald-400">
          {formatCurrency(c.total_spent || 0, currencySymbol)}
        </span>
      ),
      sortable: true,
      sortKey: (c: Customer) => c.total_spent || 0,
    },
    {
      id: "total_due",
      header: isNepali ? "बाँकी बक्यौता" : "Outstanding Due",
      align: "right",
      accessor: (c: Customer) => {
        const due = c.total_due || 0;
        return due > 0 ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 tabular-nums">
            {formatCurrency(due, currencySymbol)}
          </span>
        ) : (
          <span className="text-neutral-500 font-mono text-xs">
            {formatCurrency(0, currencySymbol)}
          </span>
        );
      },
      sortable: true,
      sortKey: (c: Customer) => c.total_due || 0,
    },
    {
      id: "actions",
      header: isNepali ? "कार्य" : "Actions",
      align: "center",
      accessor: (c: Customer) => (
        <ActionMenu
          items={[
            onViewSales
              ? {
                  label: isNepali
                    ? "कारोबार इतिहास हेर्नुहोस्"
                    : "View Purchases",
                  icon: Eye,
                  color: "sky",
                  onClick: () => onViewSales(c),
                }
              : null,
            {
              label: isNepali ? "सम्पादन गर्नुहोस्" : "Edit Customer",
              icon: Edit2,
              color: "emerald",
              onClick: () => onEdit(c),
            },
            c.phone && onCopyPhone
              ? {
                  label: isNepali
                    ? "फोन नं. कपी गर्नुहोस्"
                    : "Copy Phone Number",
                  icon: Copy,
                  color: "default",
                  onClick: () => onCopyPhone(c.phone!),
                }
              : null,
            c.pan_vat
              ? {
                  label: isNepali
                    ? "PAN/VAT कपी गर्नुहोस्"
                    : "Copy PAN/VAT Number",
                  icon: Copy,
                  color: "default",
                  onClick: () => onCopyPan(c.pan_vat!),
                }
              : null,
            {
              label: isNepali ? "हटाउनुहोस्" : "Delete Customer",
              icon: Trash2,
              color: "rose",
              isDestructive: true,
              divider: true,
              onClick: () => onDelete(c),
            },
          ]}
        />
      ),
    },
  ];
}
