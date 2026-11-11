/**
 * Reusable Itemized Date-Wise Ledger Modal for a specific Customer or Vendor.
 * Shows all sales (for customer) or all purchases (for vendor) grouped by date,
 * showing bill info, line items with rates, discounts, and margins, and provides
 * instant A4 printing of the itemized statement.
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  X,
  Printer,
  Receipt,
  Truck,
  Phone,
  FileText,
  MapPin,
  Search,
  RotateCcw,
} from "lucide-react";
import {
  Customer,
  Vendor,
  ItemizedSaleRow,
  ItemizedPurchaseRow,
} from "../../types/index.ts";
import { getItemizedSales } from "../../lib/services/salesService.ts";
import { getItemizedPurchases } from "../../lib/services/purchaseService.ts";
import { subscribeToDbChanges } from "../../lib/db/sqliteEngine.ts";
import { ItemizedDateLedger } from "./ItemizedDateLedger.tsx";
import { PrintItemizedLedgerModal } from "./PrintItemizedLedgerModal.tsx";
import { formatCurrency, capitalizeWords } from "../../lib/utils/format.ts";
import { useLanguage } from "../../context/LanguageContext.tsx";

export interface ItemizedPartyLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "customer" | "vendor";
  party: Customer | Vendor | null;
  currencySymbol: string;
}

export const ItemizedPartyLedgerModal: React.FC<
  ItemizedPartyLedgerModalProps
> = ({ isOpen, onClose, type, party, currencySymbol }) => {
  const { isNepali, formatNumberByLang } = useLanguage();
  const [data, setData] = useState<(ItemizedSaleRow | ItemizedPurchaseRow)[]>(
    [],
  );
  const [search, setSearch] = useState("");
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const loadData = useCallback(() => {
    if (!party) {
      setData([]);
      return;
    }
    try {
      if (type === "customer") {
        const rows = getItemizedSales({ customerId: party.id });
        setData(rows);
      } else {
        const rows = getItemizedPurchases({ vendorId: party.id });
        setData(rows);
      }
    } catch (e) {
      console.error(`Error loading itemized ${type} ledger:`, e);
    }
  }, [party, type]);

  useEffect(() => {
    if (isOpen && party) {
      loadData();
      const unsubscribe = subscribeToDbChanges(loadData);
      return unsubscribe;
    }
  }, [isOpen, party, loadData]);

  // Filter data by search query
  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.trim().toLowerCase();
    return data.filter((row) => {
      const billNo = (row.bill_number || "").toLowerCase();
      const prodName = (row.product_name || "").toLowerCase();
      const sku = (row.product_sku || "").toLowerCase();
      const invoiceNo =
        type === "vendor"
          ? ((row as ItemizedPurchaseRow).invoice_number || "").toLowerCase()
          : "";
      return (
        billNo.includes(q) ||
        prodName.includes(q) ||
        sku.includes(q) ||
        invoiceNo.includes(q)
      );
    });
  }, [data, search, type]);

  // Summary KPIs for this party
  const partyMetrics = useMemo(() => {
    const billIds = new Set<number>();
    let totalUnits = 0;
    let totalAmount = 0;
    let totalPaid = 0;
    let totalDue = 0;
    let totalProfit = 0;

    for (const row of data) {
      const isReturned =
        type === "customer"
          ? (row as ItemizedSaleRow).sale_status === "RETURNED"
          : (row as ItemizedPurchaseRow).purchase_status === "RETURNED";

      if (isReturned) continue;

      const billId =
        type === "customer"
          ? (row as ItemizedSaleRow).sale_id
          : (row as ItemizedPurchaseRow).purchase_id;

      if (!billIds.has(billId)) {
        billIds.add(billId);
        const grandTotal =
          type === "customer"
            ? (row as ItemizedSaleRow).sale_grand_total
            : (row as ItemizedPurchaseRow).purchase_grand_total;
        const paid =
          type === "customer"
            ? (row as ItemizedSaleRow).sale_paid_amount
            : (row as ItemizedPurchaseRow).purchase_paid_amount;
        const due =
          type === "customer"
            ? (row as ItemizedSaleRow).sale_due_amount
            : (row as ItemizedPurchaseRow).purchase_due_amount;

        totalAmount += grandTotal || 0;
        totalPaid += paid || 0;
        totalDue += due || 0;
      }

      totalUnits += row.quantity || 0;
      if (type === "customer") {
        totalProfit += (row as ItemizedSaleRow).gross_profit || 0;
      }
    }

    return {
      billCount: billIds.size,
      totalUnits,
      totalAmount,
      totalPaid,
      totalDue,
      totalProfit,
    };
  }, [data, type]);

  if (!isOpen || !party) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                type === "customer"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-sky-500/10 text-sky-400 border border-sky-500/20"
              }`}
            >
              {type === "customer" ? (
                <Receipt className="w-5 h-5" />
              ) : (
                <Truck className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-neutral-100 tracking-tight">
                  {capitalizeWords(party.name)}
                </h3>
                <span
                  className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                    type === "customer"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-sky-500/20 text-sky-300"
                  }`}
                >
                  {type === "customer"
                    ? isNepali
                      ? "ग्राहक"
                      : "Customer"
                    : isNepali
                      ? "आपूर्तिकर्ता"
                      : "Vendor"}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-neutral-300">
                {party.phone && (
                  <span className="flex items-center gap-1.5 font-mono text-xs">
                    <Phone className="w-3.5 h-3.5 text-neutral-400" />
                    <span>{party.phone}</span>
                  </span>
                )}
                {party.pan_vat && (
                  <span className="flex items-center gap-1.5 font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-200 text-[11px]">
                    <FileText className="w-3 h-3 text-neutral-400" />
                    <span>PAN: {party.pan_vat}</span>
                  </span>
                )}
                {party.address && (
                  <span className="flex items-center gap-1.5 text-neutral-400 text-[11px]">
                    <MapPin className="w-3 h-3 text-neutral-500" />
                    <span>{party.address}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{isNepali ? "लेजर प्रिन्ट" : "Print Statement"}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="h-7 w-7 flex items-center justify-center text-neutral-400 hover:text-red-200 hover:bg-red-800 outline rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-neutral-400">
              {type === "customer"
                ? isNepali
                  ? "मिति अनुसार वस्तुगत बिक्री लेजर"
                  : "Itemized Date-Wise Sales Ledger"
                : isNepali
                  ? "मिति अनुसार वस्तुगत खरिद लेजर"
                  : "Itemized Date-Wise Purchase Ledger"}
            </p>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-neutral-950/40">
          {/* Quick KPI Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
              <span className="text-[10px] uppercase font-semibold text-neutral-400 block">
                {type === "customer"
                  ? isNepali
                    ? "सम्पन्न बिलहरू"
                    : "Completed Bills"
                  : isNepali
                    ? "खरिद अर्डरहरू"
                    : "Purchase Orders"}
              </span>
              <span className="text-base font-bold text-neutral-100 font-mono mt-0.5 block">
                {formatNumberByLang(partyMetrics.billCount)}
              </span>
              <span className="text-[10px] text-neutral-500">
                {formatNumberByLang(partyMetrics.totalUnits)}{" "}
                {isNepali ? "एकाइ सामान" : "total units"}
              </span>
            </div>

            <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
              <span className="text-[10px] uppercase font-semibold text-neutral-400 block">
                {type === "customer"
                  ? isNepali
                    ? "कुल बिक्री रकम"
                    : "Total Sales Invoiced"
                  : isNepali
                    ? "कुल खरिद खर्च"
                    : "Total Purchase Spend"}
              </span>
              <span className="text-base font-bold text-emerald-400 font-mono mt-0.5 block">
                {formatCurrency(partyMetrics.totalAmount, currencySymbol)}
              </span>
            </div>

            <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
              <span className="text-[10px] uppercase font-semibold text-neutral-400 block">
                {isNepali ? "कुल भुक्तान" : "Total Paid"}
              </span>
              <span className="text-base font-bold text-neutral-200 font-mono mt-0.5 block">
                {formatCurrency(partyMetrics.totalPaid, currencySymbol)}
              </span>
            </div>

            <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
              <span className="text-[10px] uppercase font-semibold text-neutral-400 block">
                {isNepali ? "बाँकी बक्यौता" : "Outstanding Due"}
              </span>
              <span
                className={`text-base font-bold font-mono mt-0.5 block ${
                  partyMetrics.totalDue > 0
                    ? "text-amber-400"
                    : "text-neutral-400"
                }`}
              >
                {formatCurrency(partyMetrics.totalDue, currencySymbol)}
              </span>
            </div>
          </div>

          {/* Search Toolbar */}
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  isNepali
                    ? "बिल नं वा सामानको नाम खोज्नुहोस्..."
                    : "Search by bill # or item name..."
                }
                className="w-full pl-9 pr-8 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-neutral-500 hover:text-neutral-300 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>

            <span className="text-xs text-neutral-400">
              {isNepali ? "कारोबार संख्या:" : "Transactions:"}{" "}
              <strong className="text-neutral-200 font-mono">
                {formatNumberByLang(partyMetrics.billCount)}
              </strong>
            </span>
          </div>

          {/* Date-Grouped Itemized Ledger */}
          <ItemizedDateLedger
            type={type === "customer" ? "sales" : "purchases"}
            data={filteredData}
            currencySymbol={currencySymbol}
          />
        </div>

        {/* Bottom Actions Bar */}
        <div className="flex items-center justify-between px-6 py-3 bg-neutral-900 border-t border-neutral-800 shrink-0">
          <span className="text-xs text-neutral-400">
            {type === "customer"
              ? isNepali
                ? "ग्राहकका सबै बिलहरू मिति अनुसार सामूहिक रूपमा सूचीबद्ध छन्।"
                : "All sales bills for this customer grouped date-wise with itemized line details."
              : isNepali
                ? "आपूर्तिकर्ताका सबै खरिद बिलहरू मिति अनुसार सामूहिक रूपमा सूचीबद्ध छन्।"
                : "All purchase bills from this vendor grouped date-wise with itemized line details."}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer"
            >
              {isNepali ? "बन्द गर्नुहोस्" : "Close"}
            </button>
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{isNepali ? "प्रिन्ट गर्नुहोस्" : "Print Statement"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Printable Report Modal */}
      <PrintItemizedLedgerModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        type={type === "customer" ? "sales" : "purchases"}
        data={filteredData}
        currencySymbol={currencySymbol}
        partyInfo={{
          name: party.name,
          phone: party.phone,
          panVat: party.pan_vat,
          address: party.address,
          email: "email" in party ? (party as Vendor).email : null,
          partyType: type === "customer" ? "Customer" : "Vendor",
        }}
        filters={{
          search: search || undefined,
        }}
      />
    </div>
  );
};
