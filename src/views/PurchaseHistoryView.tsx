/**
 * Purchase History & Inflow Audit View
 * Dedicated page for viewing historical supplier purchase bills, VAT breakdown,
 * itemized order details, and bill printing.
 */
import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Receipt,
  FileText,
  DollarSign,
  Package,
  Printer,
  Truck,
  Edit3,
} from "lucide-react";
import { Purchase, PurchaseItem } from "../types/index.ts";
import {
  getPurchases,
  getPurchaseWithItems,
} from "../lib/services/purchaseService.ts";
import { PrintPurchaseBillModal } from "../components/common/PrintPurchaseBillModal.tsx";
import { EditPurchaseModal } from "../components/common/EditPurchaseModal.tsx";
import { Modal } from "../components/common/Modal.tsx";
import { DataTable, Column } from "../components/common/DataTable.tsx";
import { getPurchaseHistoryColumns } from "../columns/index.ts";
import { DatePreset } from "../lib/utils/dateFilters.ts";
import { formatCurrency, formatDateTime } from "../lib/utils/format.ts";
import { useToast } from "../context/ToastContext.tsx";
import { subscribeToDbChanges } from "../lib/db/sqliteEngine.ts";
import { useLanguage } from "../context/LanguageContext.tsx";

interface PurchaseHistoryViewProps {
  currencySymbol: string;
}

export const PurchaseHistoryView: React.FC<PurchaseHistoryViewProps> = ({
  currencySymbol,
}) => {
  const { showToast } = useToast();
  const { isNepali, formatNumberByLang } = useLanguage();

  // Purchases List & Filtering State
  const [historyList, setHistoryList] = useState<Purchase[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [historyDatePreset, setHistoryDatePreset] = useState<DatePreset>("all");
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");

  // Inspect Detail & Print Modals
  const [inspectPurchaseDetail, setInspectPurchaseDetail] = useState<{
    purchase: Purchase;
    items: PurchaseItem[];
  } | null>(null);
  const [editPurchaseId, setEditPurchaseId] = useState<number | null>(null);
  const [printPurchaseId, setPrintPurchaseId] = useState<number | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const loadHistory = () => {
    try {
      const opts: { startDate?: string; endDate?: string; search?: string } =
        {};
      if (historyStartDate)
        opts.startDate = `${historyStartDate}T00:00:00.000Z`;
      if (historyEndDate) opts.endDate = `${historyEndDate}T23:59:59.999Z`;
      if (historySearch) opts.search = historySearch;
      setHistoryList(getPurchases(opts));
    } catch (e) {
      console.error("Error loading purchase history:", e);
    }
  };

  useEffect(() => {
    loadHistory();
    const unsubscribe = subscribeToDbChanges(() => {
      loadHistory();
    });
    return unsubscribe;
  }, [historyStartDate, historyEndDate, historySearch]);

  // Aggregate KPI stats
  const historyStats = useMemo(() => {
    let totalSpend = 0;
    let vatTotal = 0;
    let totalUnitsInflow = 0;

    for (const p of historyList) {
      totalSpend += p.grand_total || p.total;
      vatTotal += p.vat_amount || 0;
      totalUnitsInflow += p.total_units || 0;
    }

    return {
      totalCount: historyList.length,
      totalSpend,
      vatTotal,
      totalUnitsInflow,
    };
  }, [historyList]);

  // Handle inspecting a purchase's full item breakdown
  const handleInspectPurchase = (p: Purchase) => {
    try {
      const detailed = getPurchaseWithItems(p.id);
      if (detailed) {
        setInspectPurchaseDetail(detailed);
      }
    } catch (e) {
      showToast("Failed to fetch purchase details", "error");
    }
  };

  // Columns for DataTable
  const historyColumns: Column<Purchase>[] = useMemo(
    () =>
      getPurchaseHistoryColumns({
        isNepali,
        currencySymbol,
        formatNumberByLang,
        onInspectPurchase: handleInspectPurchase,
        onPrintPurchase: (row) => {
          setPrintPurchaseId(row.id);
          setIsPrintModalOpen(true);
        },
        onEditPurchase: (row) => {
          setEditPurchaseId(row.id);
        },
        onCopyBillNumber: (billNumber) => {
          navigator.clipboard.writeText(billNumber);
          showToast(
            isNepali ? "बिल नं कपी गरियो" : "Bill number copied",
            "info",
          );
        },
      }),
    [currencySymbol, isNepali, formatNumberByLang],
  );

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-150">
      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-400 font-medium">
              {isNepali ? "कुल खरिद अर्डरहरू" : "Total Purchase Orders"}
            </p>
            <p className="text-2xl font-bold text-neutral-100 mt-1">
              {formatNumberByLang(historyStats.totalCount)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <Receipt className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-400 font-medium">
              {isNepali ? "दाखिला भएको सामान (एकाइ)" : "Total Received Units"}
            </p>
            <p className="text-2xl font-bold text-sky-400 mt-1">
              {formatNumberByLang(historyStats.totalUnitsInflow)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-400 font-medium">
              {isNepali ? "खरिद भ्याट (१३% VAT)" : "Purchase Input VAT"}
            </p>
            <p className="text-xl font-bold font-mono text-amber-400 mt-1">
              {formatCurrency(historyStats.vatTotal, currencySymbol)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-400 font-medium">
              {isNepali ? "कुल खरिद खर्च" : "Total Purchase Spend"}
            </p>
            <p className="text-xl font-bold font-mono text-emerald-400 mt-1">
              {formatCurrency(historyStats.totalSpend, currencySymbol)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Unified Shared DataTable with Search, Date Filter, Sorting, and Pagination */}
      <DataTable<Purchase>
        data={historyList}
        columns={historyColumns}
        searchQuery={historySearch}
        onSearchChange={setHistorySearch}
        searchPlaceholder={
          isNepali
            ? "खरिद बिल नं, आपूर्तिकर्ताको नाम, PAN वा सप्लायर इनभ्वाइस खोज्नुहोस्..."
            : "Search by purchase bill #, vendor name, PAN/VAT, or supplier invoice..."
        }
        extraActionsSlot={
          <Link
            to="/purchases"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Truck className="w-4 h-4" />
            <span>
              {isNepali
                ? "नयाँ खरिद दाखिला (New Purchase)"
                : "New Purchase Order"}
            </span>
          </Link>
        }
        dateFilterConfig={{
          preset: historyDatePreset,
          onPresetChange: (preset, start, end) => {
            setHistoryDatePreset(preset);
            setHistoryStartDate(start);
            setHistoryEndDate(end);
          },
          startDate: historyStartDate,
          endDate: historyEndDate,
          onStartDateChange: setHistoryStartDate,
          onEndDateChange: setHistoryEndDate,
          onClear: () => {
            setHistoryDatePreset("all");
            setHistoryStartDate("");
            setHistoryEndDate("");
            setHistorySearch("");
          },
        }}
        emptyMessage={
          isNepali
            ? "कुनै खरिद बिल फेला परेन। नयाँ खरिद अर्डर सिर्जना गर्न माथिको बटन प्रयोग गर्नुहोस्।"
            : "No purchase orders found matching your filters."
        }
      />

      {/* Purchase Details Modal */}
      {inspectPurchaseDetail && (
        <Modal
          isOpen={true}
          onClose={() => setInspectPurchaseDetail(null)}
          title={`Purchase Bill #${inspectPurchaseDetail.purchase.bill_number || inspectPurchaseDetail.purchase.id}`}
          subtitle={`Recorded on ${formatDateTime(inspectPurchaseDetail.purchase.created_at)}`}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            {/* Vendor & Invoice Meta */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-neutral-950 rounded-lg border border-neutral-800 text-xs">
              <div>
                <span className="text-neutral-500 block">
                  Supplier / Vendor:
                </span>
                <span className="font-semibold text-neutral-200">
                  {inspectPurchaseDetail.purchase.vendor_name ||
                    "Self-Supplied"}
                </span>
                {inspectPurchaseDetail.purchase.vendor_pan_vat && (
                  <span className="text-neutral-400 block font-mono text-[11px]">
                    PAN: {inspectPurchaseDetail.purchase.vendor_pan_vat}
                  </span>
                )}
                {inspectPurchaseDetail.purchase.vendor_phone && (
                  <span className="text-neutral-400 block text-[11px]">
                    Phone: {inspectPurchaseDetail.purchase.vendor_phone}
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="text-neutral-500 block">
                  Supplier Invoice Ref:
                </span>
                <span className="font-mono font-medium text-neutral-300">
                  {inspectPurchaseDetail.purchase.invoice_number || "—"}
                </span>
                {inspectPurchaseDetail.purchase.notes && (
                  <div className="mt-1 text-[11px] text-neutral-400 italic">
                    Note: {inspectPurchaseDetail.purchase.notes}
                  </div>
                )}
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-neutral-800 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950 text-neutral-400 font-medium border-b border-neutral-800">
                  <tr>
                    <th className="py-2 px-3">Product Item</th>
                    <th className="py-2 px-3 text-right">Cost Price</th>
                    <th className="py-2 px-3 text-right">Qty</th>
                    <th className="py-2 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 font-mono">
                  {inspectPurchaseDetail.items.map((it) => (
                    <tr key={it.id} className="hover:bg-neutral-900/40">
                      <td className="py-2 px-3 font-sans">
                        <div className="font-medium text-neutral-200">
                          {it.product_name}
                        </div>
                        {it.product_sku && (
                          <div className="text-[10px] text-neutral-500 font-mono">
                            SKU: {it.product_sku}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right text-neutral-300">
                        {formatCurrency(it.cost_price, currencySymbol)}
                      </td>
                      <td className="py-2 px-3 text-right text-neutral-200 font-bold">
                        {it.quantity} {it.product_unit || "pcs"}
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-400">
                        {formatCurrency(it.total, currencySymbol)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Summary */}
            <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-neutral-400">
                <span>Subtotal:</span>
                <span>
                  {formatCurrency(
                    inspectPurchaseDetail.purchase.subtotal,
                    currencySymbol,
                  )}
                </span>
              </div>
              {inspectPurchaseDetail.purchase.discount > 0 && (
                <div className="flex justify-between text-rose-400">
                  <span>Discount:</span>
                  <span>
                    -
                    {formatCurrency(
                      inspectPurchaseDetail.purchase.discount,
                      currencySymbol,
                    )}
                  </span>
                </div>
              )}
              {inspectPurchaseDetail.purchase.taxable_amount !== null &&
                inspectPurchaseDetail.purchase.taxable_amount !== undefined && (
                  <div className="flex justify-between text-neutral-400">
                    <span>Taxable Amount:</span>
                    <span>
                      {formatCurrency(
                        inspectPurchaseDetail.purchase.taxable_amount,
                        currencySymbol,
                      )}
                    </span>
                  </div>
                )}
              {inspectPurchaseDetail.purchase.vat_amount !== null &&
                inspectPurchaseDetail.purchase.vat_amount !== undefined &&
                inspectPurchaseDetail.purchase.vat_amount > 0 && (
                  <div className="flex justify-between text-amber-400 font-medium">
                    <span>
                      VAT ({inspectPurchaseDetail.purchase.vat_rate ?? 13}%):
                    </span>
                    <span>
                      +
                      {formatCurrency(
                        inspectPurchaseDetail.purchase.vat_amount,
                        currencySymbol,
                      )}
                    </span>
                  </div>
                )}
              <div className="flex justify-between text-sm font-bold text-emerald-400 pt-2 border-t border-neutral-800">
                <span>Grand Total:</span>
                <span>
                  {formatCurrency(
                    inspectPurchaseDetail.purchase.grand_total ||
                      inspectPurchaseDetail.purchase.total,
                    currencySymbol,
                  )}
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between w-full pt-3 border-t border-neutral-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPrintPurchaseId(inspectPurchaseDetail.purchase.id);
                    setIsPrintModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Bill</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const id = inspectPurchaseDetail.purchase.id;
                    setInspectPurchaseDetail(null);
                    setEditPurchaseId(id);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-200 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded-lg transition-colors cursor-pointer"
                >
                  <Edit3 className="w-4 h-4 text-amber-400" />
                  <span>
                    {isNepali ? "खरिद सच्याउनुहोस्" : "Edit Purchase"}
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setInspectPurchaseDetail(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Purchase Modal */}
      <EditPurchaseModal
        isOpen={!!editPurchaseId}
        purchaseId={editPurchaseId}
        currencySymbol={currencySymbol}
        onClose={() => setEditPurchaseId(null)}
        onSuccess={() => loadHistory()}
      />

      {/* Print Bill Modal */}
      {printPurchaseId && (
        <PrintPurchaseBillModal
          isOpen={isPrintModalOpen}
          onClose={() => {
            setIsPrintModalOpen(false);
            setPrintPurchaseId(null);
          }}
          purchaseId={printPurchaseId}
          currencySymbol={currencySymbol}
        />
      )}
    </div>
  );
};
