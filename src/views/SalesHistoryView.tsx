/**
 * Sales History & Transaction Audit Log View
 * Implements Section 11:
 * - Shows Sale ID, Date/time, Items count, Subtotal, Discount, Total, Gross profit
 * - Date filtering and search
 * - Modal to inspect all line items with snapshot cost, actual selling, discounts, and item profit
 */
import React, { useState, useEffect, useMemo } from "react";
import { Receipt, User, Phone, Printer, Edit3, Trash2 } from "lucide-react";
import { Sale, SaleItem } from "../types/index.ts";
import { getSales, getSaleWithItems, deleteSale } from "../lib/services/salesService.ts";
import { formatCurrency, formatDateTime, capitalizeWords } from "../lib/utils/format.ts";
import { Modal } from "../components/common/Modal.tsx";
import { ConfirmDialog } from "../components/common/ConfirmDialog.tsx";
import { PrintBillModal } from "../components/common/PrintBillModal.tsx";
import { EditSaleModal } from "../components/common/EditSaleModal.tsx";
import { DataTable, Column } from "../components/common/DataTable.tsx";
import { getSalesHistoryColumns } from "../columns/index.ts";
import { DatePreset } from "../lib/utils/dateFilters.ts";
import { useToast } from "../context/ToastContext.tsx";
import { subscribeToDbChanges } from "../lib/db/sqliteEngine.ts";
import { useLanguage } from "../context/LanguageContext.tsx";

interface SalesHistoryViewProps {
  currencySymbol: string;
}

export const SalesHistoryView: React.FC<SalesHistoryViewProps> = ({
  currencySymbol,
}) => {
  const { showToast } = useToast();
  const { t, isNepali } = useLanguage();
  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Selected sale inspection modal
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<{
    sale: Sale;
    items: SaleItem[];
  } | null>(null);

  // Edit sale modal state
  const [editSaleId, setEditSaleId] = useState<number | null>(null);

  // Delete sale confirm state
  const [deletingSaleId, setDeletingSaleId] = useState<number | null>(null);

  // Bill print modal state
  const [printBillSaleId, setPrintBillSaleId] = useState<number | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const loadSales = () => {
    try {
      const options: { startDate?: string; endDate?: string; search?: string } =
        {};
      if (startDate) {
        options.startDate = `${startDate}T00:00:00.000Z`;
      }
      if (endDate) {
        options.endDate = `${endDate}T23:59:59.999Z`;
      }
      if (search) {
        options.search = search;
      }
      setSales(getSales(options));
    } catch (e) {
      console.error("Error loading sales history:", e);
    }
  };

  useEffect(() => {
    loadSales();
    const unsubscribe = subscribeToDbChanges(loadSales);
    return unsubscribe;
  }, [startDate, endDate, search]);

  const handleOpenSale = (saleId: number) => {
    const details = getSaleWithItems(saleId);
    if (details) {
      setSelectedSaleDetail(details);
    }
  };

  const columns: Column<Sale>[] = useMemo(
    () =>
      getSalesHistoryColumns({
        currencySymbol,
        t,
        onInspectSale: handleOpenSale,
        onPrintThermalBill: (saleId) => {
          setPrintBillSaleId(saleId);
          setIsPrintModalOpen(true);
        },
        onEditSale: (saleId) => {
          setEditSaleId(saleId);
        },
        onDeleteSale: (saleId) => {
          setDeletingSaleId(saleId);
        },
        onCopySaleId: (saleId) => {
          navigator.clipboard.writeText(`#${saleId}`);
          showToast(`Sale #${saleId} copied to clipboard`, "info");
        },
      }),
    [currencySymbol, t],
  );

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-150">
      {/* Shared DataTable with Search, Date Filter, and Pagination */}
      <DataTable<Sale>
        data={sales}
        columns={columns}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder={t(
          "hist_search_placeholder",
          "Search by Sale #ID, customer name, phone, or product...",
        )}
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
          hasActiveFilters: Boolean(
            startDate || endDate || search || datePreset !== "all",
          ),
          onClear: () => {
            setDatePreset("all");
            setStartDate("");
            setEndDate("");
            setSearch("");
          },
        }}
        emptyIcon={Receipt}
        emptyTitle={t(
          "hist_no_sales",
          "No sales transactions found for the specified criteria.",
        )}
        enablePagination={true}
        pageSize={15}
        pageSizeOptions={[10, 15, 25, 50, 100]}
      />

      {/* Modal: Detailed Sale Inspection */}
      <Modal
        isOpen={!!selectedSaleDetail}
        onClose={() => setSelectedSaleDetail(null)}
        title={`Transaction Details: Sale #${selectedSaleDetail?.sale.id}`}
        subtitle={`Recorded on ${
          selectedSaleDetail?.sale.created_at
            ? formatDateTime(selectedSaleDetail.sale.created_at)
            : ""
        }`}
        maxWidth="3xl"
      >
        {selectedSaleDetail && (
          <div className="space-y-6">
            {/* Top Summary Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800">
                <div className="text-[11px] text-neutral-400">
                  Gross Subtotal
                </div>
                <div className="text-sm font-bold font-mono text-neutral-200 mt-0.5">
                  {formatCurrency(
                    selectedSaleDetail.sale.subtotal,
                    currencySymbol,
                  )}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800">
                <div className="text-[11px] text-neutral-400">
                  Total Discount
                </div>
                <div className="text-sm font-bold font-mono text-amber-400 mt-0.5">
                  {formatCurrency(
                    selectedSaleDetail.sale.discount,
                    currencySymbol,
                  )}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800">
                <div className="text-[11px] text-neutral-400">Grand Total</div>
                <div className="text-sm font-bold font-mono text-neutral-100 mt-0.5">
                  {formatCurrency(
                    selectedSaleDetail.sale.grand_total ||
                      selectedSaleDetail.sale.total,
                    currencySymbol,
                  )}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800">
                <div className="text-[11px] text-neutral-400">Paid Amount</div>
                <div className="text-sm font-bold font-mono text-emerald-400 mt-0.5">
                  {formatCurrency(
                    selectedSaleDetail.sale.paid_amount !== undefined &&
                      selectedSaleDetail.sale.paid_amount !== null
                      ? selectedSaleDetail.sale.paid_amount
                      : selectedSaleDetail.sale.grand_total ||
                          selectedSaleDetail.sale.total,
                    currencySymbol,
                  )}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800">
                <div className="text-[11px] text-neutral-400">Due Amount</div>
                <div
                  className={`text-sm font-bold font-mono mt-0.5 ${
                    (selectedSaleDetail.sale.due_amount ?? 0) > 0
                      ? "text-rose-400"
                      : "text-neutral-400"
                  }`}
                >
                  {formatCurrency(
                    selectedSaleDetail.sale.due_amount ?? 0,
                    currencySymbol,
                  )}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800">
                <div className="text-[11px] text-neutral-400">Gross Profit</div>
                <div className="text-sm font-bold font-mono text-teal-400 mt-0.5">
                  {formatCurrency(
                    selectedSaleDetail.sale.gross_profit ?? 0,
                    currencySymbol,
                  )}
                </div>
              </div>
            </div>

            {/* Customer Details in Modal */}
            <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-neutral-200 capitalize">
                    {selectedSaleDetail.sale.customer_name
                      ? capitalizeWords(selectedSaleDetail.sale.customer_name)
                      : "Walk-in Customer (Not Specified)"}
                  </div>
                  <div className="text-[11px] text-neutral-400 font-mono flex items-center flex-wrap gap-2 mt-0.5">
                    {selectedSaleDetail.sale.customer_phone ? (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-neutral-500" />
                        <span>{selectedSaleDetail.sale.customer_phone}</span>
                      </span>
                    ) : (
                      <span>No phone recorded</span>
                    )}
                    {selectedSaleDetail.sale.customer_pan_vat && (
                      <span className="text-emerald-400">
                        [PAN: {selectedSaleDetail.sale.customer_pan_vat}]
                      </span>
                    )}
                    {selectedSaleDetail.sale.customer_address && (
                      <span className="text-neutral-400 font-sans">
                        · {selectedSaleDetail.sale.customer_address}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-mono text-neutral-400 px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800">
                Customer Record
              </span>
            </div>

            {/* Line Items Table with Exact Historical Snapshots */}
            <div className="border border-neutral-800 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950 text-neutral-400 font-medium border-b border-neutral-800">
                  <tr>
                    <th className="py-2.5 px-4">Product</th>
                    <th className="py-2.5 px-2 text-center font-mono">Qty</th>
                    <th className="py-2.5 px-3 text-right font-mono">
                      Snapshot Cost
                    </th>
                    <th className="py-2.5 px-3 text-right font-mono">
                      Sale Price
                    </th>
                    <th className="py-2.5 px-3 text-right font-mono">Total</th>
                    <th className="py-2.5 px-4 text-right font-mono">
                      Item Profit
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {selectedSaleDetail.items.map((item) => (
                    <tr key={item.id} className="hover:bg-neutral-800/30">
                      <td className="py-3 px-4 font-semibold text-neutral-200 capitalize">
                        {capitalizeWords(item.product_name)}
                      </td>

                      <td className="py-3 px-2 text-center font-mono text-neutral-300">
                        {item.quantity}{" "}
                        {item.product_unit ? (
                          <span className="text-[10px] text-neutral-400">
                            {item.product_unit}
                          </span>
                        ) : (
                          ""
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-neutral-400">
                        {formatCurrency(item.cost_price, currencySymbol)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-neutral-300 font-medium">
                        {formatCurrency(item.selling_price, currencySymbol)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-neutral-100">
                        {formatCurrency(item.total, currencySymbol)}
                        {item.discount > 0 && (
                          <div className="text-[10px] font-normal text-amber-400 font-mono">
                            -{formatCurrency(item.discount, currencySymbol)}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-400">
                        {formatCurrency(item.gross_profit ?? 0, currencySymbol)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sale Totals & VAT Breakdown */}
            <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-neutral-400">
                <span>Subtotal:</span>
                <span className="font-mono text-neutral-200">
                  {formatCurrency(
                    selectedSaleDetail.sale.subtotal,
                    currencySymbol,
                  )}
                </span>
              </div>
              {selectedSaleDetail.sale.discount > 0 && (
                <div className="flex justify-between text-amber-400 font-medium">
                  <span>Discount:</span>
                  <span className="font-mono">
                    -{" "}
                    {formatCurrency(
                      selectedSaleDetail.sale.discount,
                      currencySymbol,
                    )}
                  </span>
                </div>
              )}
              {selectedSaleDetail.sale.vat_amount !== undefined &&
                selectedSaleDetail.sale.vat_amount !== null &&
                selectedSaleDetail.sale.vat_amount > 0 && (
                  <div className="flex justify-between text-sky-400 font-medium">
                    <span>
                      VAT ({selectedSaleDetail.sale.vat_rate ?? 13}%):
                    </span>
                    <span className="font-mono">
                      +{" "}
                      {formatCurrency(
                        selectedSaleDetail.sale.vat_amount,
                        currencySymbol,
                      )}
                    </span>
                  </div>
                )}
              <div className="flex justify-between text-sm font-bold text-neutral-100 pt-1.5 border-t border-neutral-800">
                <span>Grand Total:</span>
                <span className="font-mono text-emerald-400">
                  {formatCurrency(
                    selectedSaleDetail.sale.grand_total ||
                      selectedSaleDetail.sale.total,
                    currencySymbol,
                  )}
                </span>
              </div>

              <div className="flex justify-between text-emerald-400 font-medium pt-1.5 border-t border-neutral-900">
                <span>{isNepali ? "भुक्तानी रकम (Paid):" : "Paid Amount:"}</span>
                <span className="font-mono">
                  {formatCurrency(
                    selectedSaleDetail.sale.paid_amount !== undefined &&
                      selectedSaleDetail.sale.paid_amount !== null
                      ? selectedSaleDetail.sale.paid_amount
                      : selectedSaleDetail.sale.grand_total ||
                          selectedSaleDetail.sale.total,
                    currencySymbol,
                  )}
                </span>
              </div>

              <div className="flex justify-between font-medium">
                <span className={(selectedSaleDetail.sale.due_amount ?? 0) > 0 ? "text-rose-400" : "text-neutral-400"}>
                  {isNepali ? "बाँकी बक्यौता (Current Due):" : "Current Due:"}
                </span>
                <span className="font-mono">
                  {(selectedSaleDetail.sale.due_amount ?? 0) > 0 ? (
                    <span className="text-rose-400 font-bold">
                      {formatCurrency(
                        selectedSaleDetail.sale.due_amount ?? 0,
                        currencySymbol,
                      )}
                    </span>
                  ) : (
                    <span className="text-neutral-500">
                      {formatCurrency(0, currencySymbol)}
                    </span>
                  )}
                </span>
              </div>

              {(selectedSaleDetail.sale.previous_due ?? 0) > 0 && (
                <div className="flex justify-between text-amber-400/90 font-medium">
                  <span>{isNepali ? "साविक बाँकी (Previous Due):" : "Previous Balance / Due:"}</span>
                  <span className="font-mono">
                    {formatCurrency(
                      selectedSaleDetail.sale.previous_due ?? 0,
                      currencySymbol,
                    )}
                  </span>
                </div>
              )}

              {((selectedSaleDetail.sale.total_due ?? 0) > 0 ||
                (selectedSaleDetail.sale.due_amount ?? 0) > 0) && (
                <div className="flex justify-between text-xs font-bold text-rose-300 pt-1 border-t border-neutral-800">
                  <span>{isNepali ? "कुल ग्राहक बाँकी (Total Customer Due):" : "Total Customer Due:"}</span>
                  <span className="font-mono">
                    {formatCurrency(
                      selectedSaleDetail.sale.total_due ??
                        selectedSaleDetail.sale.due_amount ??
                        0,
                      currencySymbol,
                    )}
                  </span>
                </div>
              )}
            </div>

            <div className="text-[11px] text-neutral-500 font-mono">
              Note: Cost price snapshot was recorded at the exact moment of sale
              #{selectedSaleDetail.sale.id} and remains immutable regardless of
              future catalog price changes.
            </div>

            <div className="pt-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPrintBillSaleId(selectedSaleDetail.sale.id);
                    setIsPrintModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Bill</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const id = selectedSaleDetail.sale.id;
                    setSelectedSaleDetail(null);
                    setEditSaleId(id);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-neutral-200 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded-lg transition-colors cursor-pointer"
                >
                  <Edit3 className="w-4 h-4 text-amber-400" />
                  <span>{isNepali ? "कारोबार सच्याउनुहोस्" : "Edit Sale"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const id = selectedSaleDetail.sale.id;
                    setDeletingSaleId(id);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isNepali ? "बिक्री मेटाउनुहोस्" : "Delete Sale"}</span>
                </button>
              </div>

              <button
                onClick={() => setSelectedSaleDetail(null)}
                className="px-4 py-2 text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Sale Modal */}
      <EditSaleModal
        isOpen={!!editSaleId}
        saleId={editSaleId}
        currencySymbol={currencySymbol}
        onClose={() => setEditSaleId(null)}
        onSuccess={() => loadSales()}
      />

      {/* Bill Printing Modal */}
      <PrintBillModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        saleId={printBillSaleId}
        currencySymbol={currencySymbol}
      />

      {/* Confirm Delete Sale Dialog */}
      <ConfirmDialog
        isOpen={deletingSaleId !== null}
        onClose={() => setDeletingSaleId(null)}
        onConfirm={() => {
          if (!deletingSaleId) return;
          try {
            const res = deleteSale(deletingSaleId);
            showToast(
              isNepali
                ? `बिक्री #${res.billNumber || deletingSaleId} मेटाइयो र चलान खातामा बिक्री फिर्ता अभिलेख गरियो!`
                : `Sale #${res.billNumber || deletingSaleId} deleted and restored via sales return in movement log!`,
              "success"
            );
            if (selectedSaleDetail?.sale.id === deletingSaleId) {
              setSelectedSaleDetail(null);
            }
            setDeletingSaleId(null);
            loadSales();
          } catch (err: unknown) {
            showToast((err as Error).message, "error");
          }
        }}
        title={t("hist_delete_sale_confirm_title", "Confirm Delete Sale")}
        message={
          isNepali
            ? "के तपाईं यो बिक्री मेटाउन निश्चित हुनुहुन्छ? सामानहरूको मौज्दात गोदाममा फिर्ता गरिनेछ र चलान खातामा बिक्री फिर्ता अभिलेख हुनेछ।"
            : "Are you sure you want to permanently delete this sale? Deducted quantities will be restored back to inventory and logged as a sales return in stock movements."
        }
        confirmText={t("hist_delete_sale", "Delete Sale")}
        cancelText={isNepali ? "रद्द" : "Cancel"}
        isDestructive={true}
      />
    </div>
  );
};
