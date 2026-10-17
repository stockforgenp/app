/**
 * Professional Printable Statement of Account Modal
 * Generates an official, print-optimized document preview and print trigger for Customer or Vendor statements
 */
import React, { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Printer, X, FileText } from "lucide-react";
import { AppSettings, StatementRow } from "../../types/index.ts";
import { getSettings } from "../../lib/services/settingsService.ts";
import { formatCurrency, formatDateTime } from "../../lib/utils/format.ts";
import { useLanguage } from "../../context/LanguageContext.tsx";

interface PrintStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  partyType: "customer" | "vendor";
  partyName: string;
  partyPhone?: string | null;
  partyPanVat?: string | null;
  partyAddress?: string | null;
  totalInvoiced: number;
  totalPaid: number;
  totalDue: number;
  rows: StatementRow[];
  currencySymbol: string;
}

export const PrintStatementModal: React.FC<PrintStatementModalProps> = ({
  isOpen,
  onClose,
  partyType,
  partyName,
  partyPhone,
  partyPanVat,
  partyAddress,
  totalInvoiced,
  totalPaid,
  totalDue,
  rows,
  currencySymbol,
}) => {
  const { isNepali } = useLanguage();
  const settings: AppSettings = getSettings();
  const reportRef = useRef<HTMLDivElement>(null);

  const storeName = settings.store_name || "StockForge Retail";
  const storeAddress = settings.store_address;
  const storePhone = settings.store_phone;
  const storePanVat = settings.store_pan_vat;

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="print-statement-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Modal Top Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/90 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-neutral-100">
                    {partyType === "customer"
                      ? isNepali
                        ? "ग्राहक खाता विवरण (Customer Statement)"
                        : "Customer Statement of Account"
                      : isNepali
                        ? "आपूर्तिकर्ता खाता विवरण (Vendor Statement)"
                        : "Vendor Statement of Account"}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    {partyName} {partyPhone ? `(${partyPhone})` : ""} •{" "}
                    {formatCurrency(totalDue, currencySymbol)}{" "}
                    {isNepali ? "बाँकी" : "Due"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isNepali ? "प्रिन्ट गर्नुहोस्" : "Print"}</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Container */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-neutral-950 flex justify-center">
              <div
                ref={reportRef}
                id="printable-statement-report"
                className="w-full max-w-4xl bg-white text-gray-900 p-8 rounded-xl shadow-lg print:shadow-none print:p-0 print:m-0 print:w-full print:max-w-none text-xs"
              >
                {/* Print Header */}
                <div className="border-b-2 border-gray-900 pb-4 mb-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-tight">
                        {storeName}
                      </h1>
                      {storeAddress && (
                        <p className="text-gray-600 mt-0.5">{storeAddress}</p>
                      )}
                      <div className="flex items-center gap-4 text-gray-600 mt-1">
                        {storePhone && <span>Tel: {storePhone}</span>}
                        {storePanVat && (
                          <span className="font-semibold text-gray-800">
                            PAN/VAT: {storePanVat}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-3 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-bold text-gray-800 tracking-wider uppercase mb-1">
                        {partyType === "customer"
                          ? isNepali
                            ? "ग्राहक खाता स्टेटमेन्ट"
                            : "CUSTOMER STATEMENT"
                          : isNepali
                            ? "आपूर्तिकर्ता खाता स्टेटमेन्ट"
                            : "VENDOR STATEMENT"}
                      </span>
                      <p className="text-[11px] text-gray-500 font-mono mt-1">
                        Date: {formatDateTime(new Date().toISOString())}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Party Information & KPI Summary Boxes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  {/* Party Card */}
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      {partyType === "customer"
                        ? isNepali
                          ? "ग्राहक विवरण (Customer Details)"
                          : "Customer Information"
                        : isNepali
                          ? "आपूर्तिकर्ता विवरण (Vendor Details)"
                          : "Vendor Information"}
                    </p>
                    <p className="text-sm font-bold text-gray-900">
                      {partyName}
                    </p>
                    {partyPhone && (
                      <p className="text-[11px] text-gray-600 mt-0.5">
                        Phone: {partyPhone}
                      </p>
                    )}
                    {partyPanVat && (
                      <p className="text-[11px] text-gray-700 font-mono mt-0.5">
                        PAN / VAT: {partyPanVat}
                      </p>
                    )}
                    {partyAddress && (
                      <p className="text-[11px] text-gray-600 mt-0.5">
                        {partyAddress}
                      </p>
                    )}
                  </div>

                  {/* Financial KPI Summary Card */}
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex flex-col justify-between">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      {isNepali
                        ? "खाता सारांश (Account Summary)"
                        : "Financial Summary"}
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-center pt-1">
                      <div className="bg-white p-2 rounded border border-gray-200">
                        <p className="text-[10px] text-gray-500">
                          {partyType === "customer"
                            ? isNepali
                              ? "कुल कारोबार"
                              : "Total Invoiced"
                            : isNepali
                              ? "कुल खरिद"
                              : "Total Purchases"}
                        </p>
                        <p className="text-xs font-bold font-mono text-gray-900 mt-0.5">
                          {formatCurrency(totalInvoiced, currencySymbol)}
                        </p>
                      </div>
                      <div className="bg-white p-2 rounded border border-gray-200">
                        <p className="text-[10px] text-emerald-700 font-medium">
                          {isNepali ? "कुल भुक्तानी" : "Total Paid"}
                        </p>
                        <p className="text-xs font-bold font-mono text-emerald-700 mt-0.5">
                          {formatCurrency(totalPaid, currencySymbol)}
                        </p>
                      </div>
                      <div
                        className={`p-2 rounded border ${totalDue > 0 ? "bg-rose-50 border-rose-200 text-rose-800" : "bg-white border-gray-200 text-gray-900"}`}
                      >
                        <p className="text-[10px] font-medium">
                          {isNepali ? "बाँकी बक्यौता" : "Total Due"}
                        </p>
                        <p className="text-xs font-bold font-mono mt-0.5">
                          {formatCurrency(totalDue, currencySymbol)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Statement Table */}
                <div className="overflow-x-auto mb-6">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b-2 border-gray-300 bg-gray-100 text-gray-700 text-[10px] uppercase font-bold tracking-wider">
                        <th className="py-2 px-1 text-center w-8">#</th>
                        <th className="py-2 px-2">Date</th>
                        <th className="py-2 px-2">Ref / Bill #</th>
                        <th className="py-2 px-2">Type / Description</th>
                        <th className="py-2 px-2 text-right">Bill Amount</th>
                        <th className="py-2 px-2 text-right">Paid</th>
                        <th className="py-2 px-2 text-right">Due / Bal</th>
                        <th className="py-2 px-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-[11px]">
                      {rows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="py-6 text-center text-gray-400 italic"
                          >
                            {isNepali
                              ? "कुनै कारोबार भेटिएन।"
                              : "No transactions recorded for this account."}
                          </td>
                        </tr>
                      ) : (
                        rows.map((r, idx) => {
                          const isReturned = r.type === "RETURN";
                          const isPayment = r.type === "PAYMENT";

                          return (
                            <tr
                              key={r.id}
                              className={`hover:bg-gray-50 ${isPayment ? "bg-emerald-50/40" : isReturned ? "bg-rose-50/40" : ""}`}
                            >
                              <td className="py-2 px-1 text-center font-mono text-gray-500">
                                {idx + 1}
                              </td>
                              <td className="py-2 px-2 font-mono text-gray-600 whitespace-nowrap">
                                {formatDateTime(r.date)}
                              </td>
                              <td className="py-2 px-2 font-mono font-bold text-gray-900">
                                {r.refNumber}
                              </td>
                              <td className="py-2 px-2">
                                <div className="font-medium text-gray-800">
                                  {r.description}
                                </div>
                                {r.paymentMethod && (
                                  <span className="text-[10px] text-gray-500">
                                    Method: {r.paymentMethod}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-gray-900">
                                {isPayment
                                  ? "—"
                                  : formatCurrency(r.amount, currencySymbol)}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-emerald-700 font-medium">
                                {formatCurrency(r.paidAmount, currencySymbol)}
                              </td>
                              <td
                                className={`py-2 px-2 text-right font-mono font-bold ${
                                  r.dueAmount > 0
                                    ? "text-rose-700"
                                    : "text-gray-400"
                                }`}
                              >
                                {r.dueAmount > 0
                                  ? formatCurrency(r.dueAmount, currencySymbol)
                                  : "0"}
                              </td>
                              <td className="py-2 px-2 text-center whitespace-nowrap">
                                {isReturned ? (
                                  <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                    {isNepali ? "फिर्ता" : "Returned"}
                                  </span>
                                ) : isPayment ? (
                                  <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold bg-sky-100 text-sky-800 border border-sky-200">
                                    {isNepali ? "भुक्तानी" : "Payment"}
                                  </span>
                                ) : r.dueAmount === 0 ? (
                                  <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    {isNepali ? "चुक्ता" : "Paid"}
                                  </span>
                                ) : (
                                  <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                    {isNepali ? "बाँकी" : "Due"}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-400 bg-gray-100 font-bold text-gray-900">
                        <td
                          colSpan={4}
                          className="py-2.5 px-2 text-right uppercase text-[10px]"
                        >
                          Grand Total Summary:
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono">
                          {formatCurrency(totalInvoiced, currencySymbol)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-emerald-700">
                          {formatCurrency(totalPaid, currencySymbol)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-rose-700 font-bold">
                          {formatCurrency(totalDue, currencySymbol)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Report Footer / Signature */}
                <div className="pt-8 mt-6 border-t border-gray-200 flex justify-between items-end text-[10px] text-gray-500">
                  <div>
                    <p className="font-semibold text-gray-700">
                      StockForge Inventory & Accounting System
                    </p>
                    <p>
                      Computer generated statement • Does not require physical
                      seal unless stamped
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="w-48 border-b border-gray-400 pb-1 mb-1"></div>
                    <p className="font-semibold text-gray-700">
                      Authorized Signature & Seal
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-between px-6 py-3 bg-neutral-900 border-t border-neutral-800 shrink-0">
              <span className="text-xs text-neutral-400">
                {isNepali
                  ? "कागजातलाई A4 वा लेटर आकारमा सिधै प्रिन्ट गर्न सकिन्छ।"
                  : "Ready to print in A4 or Letter format."}
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
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isNepali ? "प्रिन्ट गर्नुहोस्" : "Print"}</span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
