/**
 * Comprehensive Statement & Ledger View Modal
 * Displays customer or vendor account statement with all bills, paid & due amounts,
 * payment receipts, settlement actions, and print statement options.
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Printer,
  Receipt,
  DollarSign,
  Search,
  Phone,
  MapPin,
} from "lucide-react";
import { Modal } from "./Modal.tsx";
import { SettleBalanceModal } from "./SettleBalanceModal.tsx";
import { PrintStatementModal } from "./PrintStatementModal.tsx";
import { PrintBillModal } from "./PrintBillModal.tsx";
import { PrintPurchaseBillModal } from "./PrintPurchaseBillModal.tsx";
import { getCustomerStatement } from "../../lib/services/customerService.ts";
import { getVendorStatement } from "../../lib/services/vendorService.ts";
import {
  formatCurrency,
  formatDateTime,
  formatNumberByLang,
} from "../../lib/utils/format.ts";
import { subscribeToDbChanges } from "../../lib/db/sqliteEngine.ts";
import { useLanguage } from "../../context/LanguageContext.tsx";
import {
  StatementRow,
  Sale,
  Purchase,
  CustomerPayment,
  VendorPayment,
} from "../../types/index.ts";

interface StatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  partyType: "customer" | "vendor";
  partyId: number | null;
  currencySymbol: string;
}

export const StatementModal: React.FC<StatementModalProps> = ({
  isOpen,
  onClose,
  partyType,
  partyId,
  currencySymbol,
}) => {
  const { isNepali } = useLanguage();

  const [statementData, setStatementData] = useState<{
    party: any;
    bills: (Sale | Purchase)[];
    payments: (CustomerPayment | VendorPayment)[];
    totalInvoiced: number;
    totalPaid: number;
    totalDue: number;
    rows: StatementRow[];
  } | null>(null);

  const [activeTab, setActiveTab] = useState<"all" | "bills" | "payments">(
    "all",
  );
  const [search, setSearch] = useState("");

  // Settle Due Modal State
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleSpecificBill, setSettleSpecificBill] = useState<{
    id: number;
    billNumber: string;
    due: number;
  } | null>(null);

  // Print Statement Modal State
  const [isPrintStatementOpen, setIsPrintStatementOpen] = useState(false);

  // Single Bill Print Modal State
  const [printBillId, setPrintBillId] = useState<number | null>(null);

  const loadData = useCallback(() => {
    if (!partyId) {
      setStatementData(null);
      return;
    }
    try {
      if (partyType === "customer") {
        const data = getCustomerStatement(partyId);
        setStatementData({
          party: data.customer,
          bills: data.sales,
          payments: data.payments,
          totalInvoiced: data.totalInvoiced,
          totalPaid: data.totalPaid,
          totalDue: data.totalDue,
          rows: data.rows,
        });
      } else {
        const data = getVendorStatement(partyId);
        setStatementData({
          party: data.vendor,
          bills: data.purchases,
          payments: data.payments,
          totalInvoiced: data.totalInvoiced,
          totalPaid: data.totalPaid,
          totalDue: data.totalDue,
          rows: data.rows,
        });
      }
    } catch (e) {
      console.error("Error fetching statement data:", e);
    }
  }, [partyId, partyType]);

  useEffect(() => {
    if (isOpen) {
      loadData();
      const unsub = subscribeToDbChanges(loadData);
      return unsub;
    }
  }, [isOpen, loadData]);

  if (!isOpen || !partyId || !statementData) return null;

  const { party, bills, payments, totalInvoiced, totalPaid, totalDue, rows } =
    statementData;

  // Filtered rows
  const filteredRows = rows.filter((r) => {
    if (activeTab === "bills" && r.type === "PAYMENT") return false;
    if (activeTab === "payments" && r.type !== "PAYMENT") return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        r.refNumber.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        (r.paymentMethod && r.paymentMethod.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={
          partyType === "customer"
            ? isNepali
              ? "ग्राहक हिसाब खाता एवं स्टेटमेन्ट"
              : "Customer Account Statement & Ledger"
            : isNepali
              ? "आपूर्तिकर्ता हिसाब खाता एवं स्टेटमेन्ट"
              : "Vendor Account Statement & Ledger"
        }
        maxWidth="4xl"
      >
        <div className="space-y-4">
          {/* Top Party Details & Action Buttons Header */}
          <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-neutral-100">
                  {party.name}
                </span>
                {party.pan_vat && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-neutral-950 border border-neutral-700 text-neutral-300">
                    PAN: {party.pan_vat}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-400">
                {party.phone && (
                  <span className="flex items-center gap-1 font-mono text-neutral-300">
                    <Phone className="w-3.5 h-3.5 text-neutral-500" />
                    {party.phone}
                  </span>
                )}
                {party.address && (
                  <span className="flex items-center gap-1 text-neutral-400">
                    <MapPin className="w-3.5 h-3.5 text-neutral-500" />
                    {party.address}
                  </span>
                )}
              </div>
            </div>

            {/* Actions: Settle Balance & Print Statement */}
            <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
              {totalDue > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSettleSpecificBill(null);
                    setIsSettleModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer shadow-sm"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>
                    {partyType === "customer"
                      ? isNepali
                        ? "हिसाब चुक्ता / भुक्तानी लिनुहोस्"
                        : "Settle Due / Receive"
                      : isNepali
                        ? "हिसाब चुक्ता / भुक्तानी दिनुहोस्"
                        : "Settle Due / Pay"}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsPrintStatementOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer border border-neutral-700"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {isNepali ? "स्टेटमेन्ट प्रिन्ट" : "Print Statement"}
                </span>
              </button>
            </div>
          </div>

          {/* Metric KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800">
              <p className="text-[11px] font-medium text-neutral-400">
                {partyType === "customer"
                  ? isNepali
                    ? "कुल कारोबार (Total Invoiced)"
                    : "Total Invoiced"
                  : isNepali
                    ? "कुल खरिद (Total Purchases)"
                    : "Total Purchases"}
              </p>
              <p className="text-xl font-bold font-mono text-neutral-100 mt-1">
                {formatCurrency(totalInvoiced, currencySymbol)}
              </p>
              <p className="text-[10px] text-neutral-500 mt-0.5">
                {formatNumberByLang(bills.length)}{" "}
                {isNepali ? "बिल अभिलेख" : "bills total"}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800">
              <p className="text-[11px] font-medium text-neutral-400">
                {isNepali ? "कुल भुक्तानी (Total Paid)" : "Total Paid Amount"}
              </p>
              <p className="text-xl font-bold font-mono text-emerald-400 mt-1">
                {formatCurrency(totalPaid, currencySymbol)}
              </p>
              <p className="text-[10px] text-neutral-500 mt-0.5">
                {formatNumberByLang(payments.length)}{" "}
                {isNepali ? "भुक्तानी रसिद" : "payment receipts"}
              </p>
            </div>

            <div
              className={`p-3.5 rounded-xl border ${totalDue > 0 ? "bg-rose-500/10 border-rose-500/20" : "bg-neutral-900 border-neutral-800"}`}
            >
              <p className="text-[11px] font-medium text-neutral-400">
                {isNepali
                  ? "बाँकी बक्यौता (Outstanding Due)"
                  : "Current Due Balance"}
              </p>
              <p
                className={`text-xl font-bold font-mono mt-1 ${totalDue > 0 ? "text-rose-400" : "text-neutral-300"}`}
              >
                {formatCurrency(totalDue, currencySymbol)}
              </p>
              <p className="text-[10px] text-neutral-500 mt-0.5">
                {totalDue === 0
                  ? isNepali
                    ? "पूर्ण चुक्ता भएको"
                    : "Fully settled"
                  : isNepali
                    ? "चुक्ता गर्न बाँकी"
                    : "Pending payment"}
              </p>
            </div>
          </div>

          {/* Filter Bar & Tabs */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1.5 p-1 bg-neutral-900 border border-neutral-800 rounded-lg w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                  activeTab === "all"
                    ? "bg-neutral-800 text-neutral-100 shadow-sm"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {isNepali ? "सम्पूर्ण कारोबार (All)" : "All Ledger"} (
                {rows.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("bills")}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                  activeTab === "bills"
                    ? "bg-neutral-800 text-neutral-100 shadow-sm"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {isNepali ? "बिलहरू (Bills)" : "Bills / Invoices"} (
                {bills.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("payments")}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                  activeTab === "payments"
                    ? "bg-neutral-800 text-neutral-100 shadow-sm"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {isNepali ? "भुक्तानी रसिद (Payments)" : "Payment Receipts"} (
                {payments.length})
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder={
                  isNepali
                    ? "बिल वा रसिद नं. खोज्नुहोस्..."
                    : "Search bill or receipt #..."
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Statement Table */}
          <div className="max-h-96 overflow-y-auto border border-neutral-800 rounded-xl overflow-hidden bg-neutral-900/50">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-neutral-900 border-b border-neutral-800 text-neutral-400 text-[11px] font-semibold sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3">{isNepali ? "मिति" : "Date"}</th>
                  <th className="py-2.5 px-3">
                    {isNepali ? "बिल / रसिद नं." : "Ref / Bill #"}
                  </th>
                  <th className="py-2.5 px-3">
                    {isNepali ? "विवरण" : "Description"}
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    {isNepali ? "बिल रकम" : "Amount"}
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    {isNepali ? "तिरेको" : "Paid"}
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    {isNepali ? "बाँकी" : "Due"}
                  </th>
                  <th className="py-2.5 px-3 text-center">
                    {isNepali ? "स्थिति" : "Status"}
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    {isNepali ? "कार्य" : "Actions"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/80">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-10 text-center text-neutral-500 text-xs"
                    >
                      {isNepali
                        ? "कुनै कारोबार भेटिएन।"
                        : "No transaction records found."}
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r) => {
                    const isReturned = r.type === "RETURN";
                    const isPayment = r.type === "PAYMENT";
                    const billId = parseInt(r.id.split("-")[1], 10);

                    return (
                      <tr
                        key={r.id}
                        className={`hover:bg-neutral-800/40 transition-colors ${
                          isPayment
                            ? "bg-sky-500/5"
                            : isReturned
                              ? "bg-rose-500/5"
                              : ""
                        }`}
                      >
                        <td className="py-2 px-3 font-mono text-[11px] text-neutral-400 whitespace-nowrap">
                          {formatDateTime(r.date)}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-neutral-200">
                          {r.refNumber}
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-medium text-neutral-300">
                            {r.description}
                          </div>
                          {r.paymentMethod && (
                            <span className="text-[10px] text-neutral-500">
                              Via: {r.paymentMethod}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-neutral-300">
                          {isPayment
                            ? "—"
                            : formatCurrency(r.amount, currencySymbol)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-400 font-medium">
                          {formatCurrency(r.paidAmount, currencySymbol)}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-mono font-bold ${
                            r.dueAmount > 0
                              ? "text-rose-400"
                              : "text-neutral-500"
                          }`}
                        >
                          {r.dueAmount > 0
                            ? formatCurrency(r.dueAmount, currencySymbol)
                            : "—"}
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          {isReturned ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              {isNepali ? "फिर्ता" : "Returned"}
                            </span>
                          ) : isPayment ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                              {isNepali ? "भुक्तानी" : "Payment"}
                            </span>
                          ) : r.dueAmount === 0 ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {isNepali ? "चुक्ता" : "Paid"}
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              {isNepali ? "बाँकी" : "Due"}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {r.type === "BILL" &&
                              !isReturned &&
                              r.dueAmount > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSettleSpecificBill({
                                      id: billId,
                                      billNumber: r.refNumber,
                                      due: r.dueAmount,
                                    });
                                    setIsSettleModalOpen(true);
                                  }}
                                  className="px-2 py-1 text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 rounded border border-emerald-500/20 transition-colors cursor-pointer"
                                  title={
                                    isNepali
                                      ? "यो बिल चुक्ता गर्नुहोस्"
                                      : "Settle this bill"
                                  }
                                >
                                  {isNepali ? "चुक्ता" : "Settle"}
                                </button>
                              )}
                            {r.type === "BILL" && (
                              <button
                                type="button"
                                onClick={() => setPrintBillId(billId)}
                                className="p-1 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors cursor-pointer"
                                title={
                                  isNepali ? "बिल छाप्नुहोस्" : "Print Bill"
                                }
                              >
                                <Receipt className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Statement Bottom Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-neutral-800 text-xs text-neutral-400">
            <div className="flex items-center gap-4">
              <span>
                {isNepali ? "कुल कारोबार" : "Total Billed"}:{" "}
                <strong className="text-neutral-200 font-mono">
                  {formatCurrency(totalInvoiced, currencySymbol)}
                </strong>
              </span>
              <span>
                {isNepali ? "कुल भुक्तानी" : "Total Paid"}:{" "}
                <strong className="text-emerald-400 font-mono">
                  {formatCurrency(totalPaid, currencySymbol)}
                </strong>
              </span>
              <span>
                {isNepali ? "कुल बाँकी" : "Total Due"}:{" "}
                <strong className="text-rose-400 font-mono font-bold">
                  {formatCurrency(totalDue, currencySymbol)}
                </strong>
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium cursor-pointer transition-colors"
            >
              {isNepali ? "बन्द गर्नुहोस्" : "Close"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Settle Balance Modal */}
      <SettleBalanceModal
        isOpen={isSettleModalOpen}
        onClose={() => {
          setIsSettleModalOpen(false);
          setSettleSpecificBill(null);
        }}
        partyType={partyType}
        partyId={partyId}
        partyName={party.name}
        partyPhone={party.phone}
        currentDue={settleSpecificBill ? settleSpecificBill.due : totalDue}
        currencySymbol={currencySymbol}
        specificBillId={settleSpecificBill?.id}
        specificBillNumber={settleSpecificBill?.billNumber}
        onSuccess={loadData}
      />

      {/* Printable Statement Modal */}
      <PrintStatementModal
        isOpen={isPrintStatementOpen}
        onClose={() => setIsPrintStatementOpen(false)}
        partyType={partyType}
        partyName={party.name}
        partyPhone={party.phone}
        partyPanVat={party.pan_vat}
        partyAddress={party.address}
        totalInvoiced={totalInvoiced}
        totalPaid={totalPaid}
        totalDue={totalDue}
        rows={rows}
        currencySymbol={currencySymbol}
      />

      {/* Print Single Sale Bill Modal */}
      {partyType === "customer" && (
        <PrintBillModal
          isOpen={printBillId !== null}
          onClose={() => setPrintBillId(null)}
          saleId={printBillId}
          currencySymbol={currencySymbol}
        />
      )}

      {/* Print Single Purchase Bill Modal */}
      {partyType === "vendor" && (
        <PrintPurchaseBillModal
          isOpen={printBillId !== null}
          onClose={() => setPrintBillId(null)}
          purchaseId={printBillId}
          currencySymbol={currencySymbol}
        />
      )}
    </>
  );
};
