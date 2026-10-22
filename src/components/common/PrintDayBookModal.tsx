/**
 * PrintDayBookModal Component
 * Formatted printable daily transaction book & cash reconciliation report
 * Supports standard A4 print and 80mm thermal receipt formats.
 */
import React, { useRef, useState } from "react";
import { Printer, X, Download } from "lucide-react";
import { Modal } from "./Modal.tsx";
import { DayBookSummary } from "../../types/index.ts";
import { formatCurrency, formatDateTime } from "../../helpers/formatHelpers.ts";
import { useLanguage } from "../../context/LanguageContext.tsx";
import { useAuth } from "../../context/AuthContext.tsx";

interface PrintDayBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: DayBookSummary;
  currencySymbol: string;
}

export const PrintDayBookModal: React.FC<PrintDayBookModalProps> = ({
  isOpen,
  onClose,
  summary,
  currencySymbol,
}) => {
  const { isNepali } = useLanguage();
  const { currentShop } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);
  const [printFormat, setPrintFormat] = useState<"standard" | "thermal">("standard");

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const isSingleDay = summary.startDate === summary.endDate;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isNepali ? "दैनिक हिसाब विवरण प्रिन्ट (Day Book Print)" : "Print Day Book Report"}
      maxWidth="4xl"
    >
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex items-center justify-between gap-3 p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400 font-medium">
              {isNepali ? "प्रिन्ट ढाँचा:" : "Format:"}
            </span>
            <button
              type="button"
              onClick={() => setPrintFormat("standard")}
              className={`px-3 py-1 text-xs rounded-lg font-medium border transition-colors cursor-pointer ${
                printFormat === "standard"
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200"
              }`}
            >
              {isNepali ? "सामान्य पाना (A4 Report)" : "Standard (A4)"}
            </button>
            <button
              type="button"
              onClick={() => setPrintFormat("thermal")}
              className={`px-3 py-1 text-xs rounded-lg font-medium border transition-colors cursor-pointer ${
                printFormat === "thermal"
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200"
              }`}
            >
              {isNepali ? "थर्मल रसिद (80mm Thermal)" : "Thermal (80mm)"}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isNepali ? "प्रिन्ट गर्नुहोस्" : "Print Report"}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Content Area */}
        <div className="max-h-[70vh] overflow-y-auto p-1 bg-neutral-950/50 rounded-xl border border-neutral-800">
          <div
            ref={printRef}
            className={`mx-auto bg-white text-gray-900 rounded-lg shadow-md p-6 font-sans ${
              printFormat === "thermal" ? "max-w-[80mm] text-[11px] p-3" : "max-w-3xl text-xs"
            }`}
          >
            {/* Business Header */}
            <div className="text-center border-b border-dashed border-gray-300 pb-3 mb-3">
              <h2 className="text-base font-bold text-gray-900 uppercase tracking-tight">
                {currentShop?.name || "STOCKFORGE RETAIL"}
              </h2>
              {currentShop?.address && (
                <p className="text-[11px] text-gray-600">{currentShop.address}</p>
              )}
              {currentShop?.phone && (
                <p className="text-[11px] text-gray-600">Tel: {currentShop.phone}</p>
              )}
              <div className="inline-block mt-1 px-2 py-0.5 bg-gray-100 rounded text-[10px] font-bold text-gray-700 uppercase tracking-wider">
                {isNepali ? "दैनिक हिसाब किताब (DAY BOOK)" : "DAILY TRANSACTION & CASH BOOK"}
              </div>
              <p className="text-[11px] font-mono text-gray-600 mt-1">
                {isSingleDay
                  ? `Date: ${summary.startDate}`
                  : `Period: ${summary.startDate} to ${summary.endDate}`}
              </p>
            </div>

            {/* Opening & Closing Balance Strip */}
            <div className="grid grid-cols-2 gap-2 p-2.5 bg-gray-50 rounded-lg border border-gray-200 mb-3 text-[11px]">
              <div>
                <span className="text-gray-500 font-medium">
                  {isNepali ? "प्रारम्भिक नगद (Opening Cash):" : "Opening Cash Balance:"}
                </span>
                <p className="font-mono font-bold text-gray-900 text-sm">
                  {formatCurrency(summary.openingBalance, currencySymbol)}
                </p>
              </div>
              <div className="text-right">
                <span className="text-gray-500 font-medium">
                  {isNepali ? "अन्तिम नगद (Closing Cash):" : "Closing Cash Balance:"}
                </span>
                <p className="font-mono font-bold text-gray-900 text-sm">
                  {formatCurrency(summary.closingBalance, currencySymbol)}
                </p>
              </div>
            </div>

            {/* Inflow vs Outflow Cash Summary */}
            <div className="grid grid-cols-3 gap-2 border-b border-gray-200 pb-3 mb-3 text-center">
              <div className="p-2 bg-emerald-50 rounded border border-emerald-100">
                <p className="text-[10px] font-semibold text-emerald-800 uppercase">
                  {isNepali ? "कुल आम्दानी (Inflow)" : "Total Inflow"}
                </p>
                <p className="font-mono font-bold text-emerald-700 text-sm mt-0.5">
                  {formatCurrency(summary.totalInflow, currencySymbol)}
                </p>
                <p className="text-[9px] text-emerald-600">
                  Cash: {formatCurrency(summary.cashInflow, currencySymbol)}
                </p>
              </div>

              <div className="p-2 bg-rose-50 rounded border border-rose-100">
                <p className="text-[10px] font-semibold text-rose-800 uppercase">
                  {isNepali ? "कुल खर्च/भुक्तानी (Outflow)" : "Total Outflow"}
                </p>
                <p className="font-mono font-bold text-rose-700 text-sm mt-0.5">
                  {formatCurrency(summary.totalOutflow, currencySymbol)}
                </p>
                <p className="text-[9px] text-rose-600">
                  Cash: {formatCurrency(summary.cashOutflow, currencySymbol)}
                </p>
              </div>

              <div className="p-2 bg-sky-50 rounded border border-sky-100">
                <p className="text-[10px] font-semibold text-sky-800 uppercase">
                  {isNepali ? "खुद नगद प्रवाह (Net Cash)" : "Net Cash Flow"}
                </p>
                <p
                  className={`font-mono font-bold text-sm mt-0.5 ${
                    summary.netCash >= 0 ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {formatCurrency(summary.netCash, currencySymbol)}
                </p>
                <p className="text-[9px] text-sky-600">
                  Total Net: {formatCurrency(summary.netCashFlow, currencySymbol)}
                </p>
              </div>
            </div>

            {/* Payment Modes Breakdown */}
            <div className="mb-3">
              <h4 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                {isNepali ? "भुक्तानी माध्यमगत विवरण (Payment Modes)" : "Payment Mode Breakdown"}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
                {summary.modeSummaries.map((m) => (
                  <div key={m.mode} className="p-1.5 rounded border border-gray-200 bg-gray-50/60">
                    <span className="font-bold text-gray-800">{m.mode}</span>
                    <div className="flex justify-between text-gray-600 mt-0.5 font-mono">
                      <span>In:</span>
                      <span className="text-emerald-700 font-medium">
                        {formatCurrency(m.inflow, currencySymbol)}
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-600 font-mono">
                      <span>Out:</span>
                      <span className="text-rose-700 font-medium">
                        {formatCurrency(m.outflow, currencySymbol)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dues & Credit Summary */}
            <div className="p-2.5 rounded-lg border border-gray-200 bg-amber-50/40 mb-3 text-[10px]">
              <h4 className="font-bold text-amber-900 uppercase tracking-wider mb-1">
                {isNepali ? "बाँकी बक्यौता विवरण (Dues & Credit)" : "Dues & Credit Activity"}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
                <div>
                  <span className="text-gray-500">New Cust Due:</span>
                  <p className="font-bold text-rose-700">
                    {formatCurrency(summary.newCustomerDue, currencySymbol)}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Cust Due Collected:</span>
                  <p className="font-bold text-emerald-700">
                    {formatCurrency(summary.customerDueCollected, currencySymbol)}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">New Vendor Due:</span>
                  <p className="font-bold text-amber-800">
                    {formatCurrency(summary.newVendorDue, currencySymbol)}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Vendor Due Paid:</span>
                  <p className="font-bold text-indigo-700">
                    {formatCurrency(summary.vendorDuePaid, currencySymbol)}
                  </p>
                </div>
              </div>
            </div>

            {/* Transactions Table */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <h4 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                  {isNepali
                    ? `कारोबार सूची (${summary.entries.length})`
                    : `Transaction Log (${summary.entries.length})`}
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead>
                    <tr className="border-b border-gray-300 text-gray-600 font-semibold uppercase bg-gray-100">
                      <th className="py-1 px-1.5">Time</th>
                      <th className="py-1 px-1.5">Type</th>
                      <th className="py-1 px-1.5">Ref #</th>
                      <th className="py-1 px-1.5">Party / Particulars</th>
                      <th className="py-1 px-1.5">Mode</th>
                      <th className="py-1 px-1.5 text-right">Inflow (+)</th>
                      <th className="py-1 px-1.5 text-right">Outflow (-)</th>
                      <th className="py-1 px-1.5 text-right">Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {summary.entries.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-4 text-center text-gray-400">
                          {isNepali ? "कुनै कारोबार भेटिएन" : "No transactions recorded for this period."}
                        </td>
                      </tr>
                    ) : (
                      summary.entries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-gray-50">
                          <td className="py-1 px-1.5 font-mono whitespace-nowrap text-gray-500">
                            {formatDateTime(entry.time).split(" ")[1] || entry.time.slice(11, 16)}
                          </td>
                          <td className="py-1 px-1.5 font-semibold text-gray-800 whitespace-nowrap">
                            {entry.type}
                          </td>
                          <td className="py-1 px-1.5 font-mono text-gray-700 whitespace-nowrap">
                            {entry.refNumber}
                          </td>
                          <td className="py-1 px-1.5 text-gray-900 truncate max-w-[140px]">
                            {entry.partyName}
                          </td>
                          <td className="py-1 px-1.5 text-gray-600 whitespace-nowrap">
                            {entry.paymentMethod}
                          </td>
                          <td className="py-1 px-1.5 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                            {entry.inflow > 0 ? formatCurrency(entry.inflow, currencySymbol) : "—"}
                          </td>
                          <td className="py-1 px-1.5 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                            {entry.outflow > 0 ? formatCurrency(entry.outflow, currencySymbol) : "—"}
                          </td>
                          <td className="py-1 px-1.5 text-right font-mono text-amber-700 whitespace-nowrap">
                            {entry.dueAmount > 0 ? formatCurrency(entry.dueAmount, currencySymbol) : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-4 pt-2 border-t border-dashed border-gray-300 text-center text-[10px] text-gray-500 font-mono">
              Report Generated: {new Date().toLocaleString()} · StockForge Retail Engine
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
