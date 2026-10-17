import {
  Building2,
  Copy,
  Check,
  Phone,
  Mail,
  MapPin,
  Package,
  Receipt,
  Eye,
  Edit2,
  Trash2,
  FileText,
  DollarSign,
} from "lucide-react";
import { Vendor } from "../types/index.ts";
import { Column } from "../components/common/DataTable.tsx";
import { ActionMenu } from "../components/common/ActionMenu.tsx";
import { formatCurrency, capitalizeWords } from "../helpers/formatHelpers.ts";

export interface VendorColumnOptions {
  isNepali: boolean;
  currencySymbol: string;
  copiedPan: string | null;
  formatNumberByLang: (num: number) => string;
  onCopyPan: (pan: string) => void;
  onViewProducts: (vendor: Vendor) => void;
  onViewPurchases: (vendor: Vendor) => void;
  onViewStatement?: (vendor: Vendor) => void;
  onSettleDue?: (vendor: Vendor) => void;
  onEdit: (vendor: Vendor) => void;
  onDelete: (vendor: Vendor) => void;
  onCopyPhone?: (phone: string) => void;
}


export function getVendorColumns(options: VendorColumnOptions): Column<Vendor>[] {
  const {
    isNepali,
    currencySymbol,
    copiedPan,
    formatNumberByLang,
    onCopyPan,
    onViewProducts,
    onViewPurchases,
    onViewStatement,
    onSettleDue,
    onEdit,
    onDelete,
    onCopyPhone,
  } = options;

  return [
    {
      id: "name",
      header: isNepali ? "आपूर्तिकर्ताको नाम" : "Vendor / Supplier",
      accessor: (vendor) => (
        <div className="font-medium text-neutral-100 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Building2 className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-neutral-100 capitalize">
              {capitalizeWords(vendor.name)}
            </p>
            {vendor.notes && (
              <p className="text-xs text-neutral-500 truncate max-w-xs">
                {vendor.notes}
              </p>
            )}
          </div>
        </div>
      ),
      sortable: true,
      sortKey: (v) => capitalizeWords(v.name),
    },
    {
      id: "pan_vat",
      header: "PAN / VAT",
      accessor: (vendor) =>
        vendor.pan_vat ? (
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-neutral-800 border border-neutral-700/80 text-xs font-mono text-neutral-200">
            <span>{vendor.pan_vat}</span>
            <button
              type="button"
              onClick={() => onCopyPan(vendor.pan_vat!)}
              title="Copy PAN/VAT"
              className="text-neutral-400 hover:text-emerald-400 transition-colors cursor-pointer p-0.5"
            >
              {copiedPan === vendor.pan_vat ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
        ) : (
          <span className="text-xs text-neutral-500 italic">
            {isNepali ? "उल्लेख छैन" : "Not recorded"}
          </span>
        ),
      sortable: true,
      sortKey: (v) => v.pan_vat || "",
    },
    {
      id: "contact",
      header: isNepali ? "सम्पर्क" : "Contact",
      accessor: (vendor) => (
        <div className="space-y-0.5 text-xs">
          {vendor.phone && (
            <div className="flex items-center gap-1.5 text-neutral-300">
              <Phone className="w-3 h-3 text-neutral-500" />
              <span>{vendor.phone}</span>
            </div>
          )}
          {vendor.email && (
            <div className="flex items-center gap-1.5 text-neutral-400">
              <Mail className="w-3 h-3 text-neutral-500" />
              <span className="truncate max-w-[160px]">{vendor.email}</span>
            </div>
          )}
          {!vendor.phone && !vendor.email && (
            <span className="text-neutral-500 italic">—</span>
          )}
        </div>
      ),
    },
    {
      id: "address",
      header: isNepali ? "ठेगाना" : "Address",
      accessor: (vendor) =>
        vendor.address ? (
          <div className="flex items-center gap-1.5 max-w-xs truncate text-xs text-neutral-300">
            <MapPin className="w-3 h-3 text-neutral-500 shrink-0" />
            <span className="truncate">{vendor.address}</span>
          </div>
        ) : (
          <span className="text-neutral-500 italic text-xs">—</span>
        ),
    },
    {
      id: "product_count",
      header: isNepali ? "सामान" : "Products",
      align: "center",
      accessor: (vendor) => (
        <button
          onClick={() => onViewProducts(vendor)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-800 hover:bg-neutral-750 text-neutral-300 hover:text-neutral-100 border border-neutral-700/60 transition-colors cursor-pointer"
          title={
            isNepali
              ? "सम्बन्धित सामानहरू हेर्नुहोस्"
              : "View supplied products"
          }
        >
          <Package className="w-3 h-3 text-amber-400" />
          <span>{formatNumberByLang(vendor.product_count || 0)}</span>
        </button>
      ),
      sortable: true,
      sortKey: (v) => v.product_count || 0,
    },
    {
      id: "total_purchased",
      header: isNepali ? "खरिद रकम" : "Purchased",
      align: "right",
      accessor: (vendor) => (
        <button
          onClick={() => onViewPurchases(vendor)}
          className="inline-flex items-center gap-1.5 hover:text-emerald-400 transition-colors cursor-pointer group text-xs font-medium text-neutral-200"
          title={isNepali ? "खरिद बिलहरू हेर्नुहोस्" : "View purchase bills"}
        >
          <span>
            {formatCurrency(vendor.total_purchased || 0, currencySymbol)}
          </span>
          <Receipt className="w-3.5 h-3.5 text-neutral-500 group-hover:text-emerald-400 transition-colors" />
        </button>
      ),
      sortable: true,
      sortKey: (v) => v.total_purchased || 0,
    },
    {
      id: "total_due",
      header: isNepali ? "बाँकी भुक्तानी" : "Payable Due",
      align: "right",
      accessor: (vendor) => {
        const due = vendor.total_due || 0;
        return due > 0 && onSettleDue ? (
          <button
            type="button"
            onClick={() => onSettleDue(vendor)}
            className="inline-flex items-center gap-1 font-mono text-xs tabular-nums text-rose-400 font-bold hover:underline cursor-pointer"
            title={isNepali ? "बक्यौता भुक्तानी गर्नुहोस्" : "Click to settle payable due"}
          >
            <span>{formatCurrency(due, currencySymbol)}</span>
            <DollarSign className="w-3 h-3 text-emerald-400" />
          </button>
        ) : (
          <span
            className={`font-mono text-xs tabular-nums ${
              due > 0 ? "text-rose-400 font-medium" : "text-neutral-500"
            }`}
          >
            {formatCurrency(due, currencySymbol)}
          </span>
        );
      },
      sortable: true,
      sortKey: (v) => v.total_due || 0,
    },
    {
      id: "actions",
      header: isNepali ? "कार्य" : "Actions",
      align: "right",
      accessor: (vendor) => (
        <ActionMenu
          items={[
            onViewStatement
              ? {
                  label: isNepali
                    ? "खाता स्टेटमेन्ट (Statement)"
                    : "Statement / Ledger",
                  icon: FileText,
                  color: "sky",
                  onClick: () => onViewStatement(vendor),
                }
              : null,
            (vendor.total_due || 0) > 0 && onSettleDue
              ? {
                  label: isNepali
                    ? "हिसाब चुक्ता (Settle Due)"
                    : "Settle Payable Due",
                  icon: DollarSign,
                  color: "emerald",
                  onClick: () => onSettleDue(vendor),
                }
              : null,
            {
              label: isNepali ? "खरिद बिलहरू हेर्नुहोस्" : "Purchase Bills",
              icon: Receipt,
              color: "amber",
              onClick: () => onViewPurchases(vendor),
            },
            {
              label: isNepali ? "सामानहरू हेर्नुहोस्" : "View Products",
              icon: Eye,
              color: "default",
              onClick: () => onViewProducts(vendor),
            },

            {
              label: isNepali ? "सम्पादन गर्नुहोस्" : "Edit Vendor",
              icon: Edit2,
              color: "sky",
              onClick: () => onEdit(vendor),
            },
            vendor.phone
              ? {
                  label: isNepali
                    ? "फोन नं. कपी गर्नुहोस्"
                    : "Copy Phone Number",
                  icon: Copy,
                  color: "default",
                  onClick: () => {
                    if (onCopyPhone) {
                      onCopyPhone(vendor.phone!);
                    } else {
                      navigator.clipboard.writeText(vendor.phone!);
                    }
                  },
                }
              : null,
            vendor.pan_vat
              ? {
                  label: isNepali
                    ? "PAN/VAT कपी गर्नुहोस्"
                    : "Copy PAN/VAT Number",
                  icon: Copy,
                  color: "default",
                  onClick: () => onCopyPan(vendor.pan_vat!),
                }
              : null,
            {
              label: isNepali ? "हटाउनुहोस्" : "Delete Vendor",
              icon: Trash2,
              color: "rose",
              isDestructive: true,
              divider: true,
              onClick: () => onDelete(vendor),
            },
          ]}
        />
      ),
    },
  ];
}
