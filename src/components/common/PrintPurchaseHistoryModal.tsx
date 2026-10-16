/**
 * Professional Purchase History Printable Report Modal
 * Provides a clean, print-optimized document preview and print trigger for purchase history
 */
import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Printer, X, ShoppingBag } from 'lucide-react';
import { Purchase, AppSettings } from '../../types/index.ts';
import { getSettings } from '../../lib/services/settingsService.ts';
import {
  formatCurrency,
  formatDateTime,
  capitalizeWords,
  formatNumberByLang,
} from '../../lib/utils/format.ts';
import { useLanguage } from '../../context/LanguageContext.tsx';

interface PrintPurchaseHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchases: Purchase[];
  currencySymbol: string;
  filters?: {
    startDate?: string;
    endDate?: string;
    search?: string;
  };
}

export const PrintPurchaseHistoryModal: React.FC<PrintPurchaseHistoryModalProps> = ({
  isOpen,
  onClose,
  purchases,
  currencySymbol,
  filters,
}) => {
  const { isNepali } = useLanguage();
  const settings: AppSettings = getSettings();
  const reportRef = useRef<HTMLDivElement>(null);

  const storeName = settings.store_name || 'StockForge Retail';
  const storeAddress = settings.store_address;
  const storePhone = settings.store_phone;

  const activePurchases = purchases.filter((p) => p.status !== 'RETURNED');
  const returnedPurchases = purchases.filter((p) => p.status === 'RETURNED');

  const totalUnits = activePurchases.reduce((acc, p) => acc + (p.total_units || 0), 0);
  const totalTaxable = activePurchases.reduce(
    (acc, p) => acc + (p.taxable_amount || p.subtotal || 0),
    0
  );
  const totalVat = activePurchases.reduce((acc, p) => acc + (p.vat_amount || 0), 0);
  const totalSpend = activePurchases.reduce(
    (acc, p) => acc + (p.grand_total || p.total || 0),
    0
  );
  const totalPaid = activePurchases.reduce((acc, p) => {
    const paid =
      p.paid_amount !== undefined && p.paid_amount !== null
        ? p.paid_amount
        : (p.grand_total || p.total);
    return acc + (paid || 0);
  }, 0);
  const totalDue = activePurchases.reduce((acc, p) => acc + (p.due_amount || 0), 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="print-purchase-history-backdrop"
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
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-neutral-100">
                    {isNepali ? 'खरिद इतिहास प्रिन्ट रिपोर्ट' : 'Purchase History Report Preview'}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    {isNepali
                      ? `कुल बिल: ${formatNumberByLang(purchases.length)} (सम्पन्न: ${formatNumberByLang(activePurchases.length)}, फिर्ता: ${formatNumberByLang(returnedPurchases.length)})`
                      : `Total Records: ${purchases.length} (${activePurchases.length} Completed, ${returnedPurchases.length} Returned)`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isNepali ? 'प्रिन्ट गर्नुहोस्' : 'Print Report'}</span>
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

            {/* Scrollable Printable Document Preview Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-neutral-950/70 flex justify-center items-start">
              <div
                id="printable-report"
                ref={reportRef}
                className="w-full max-w-4xl bg-white text-gray-900 shadow-xl p-8 rounded-xl font-sans text-xs"
                style={{ color: '#111827' }}
              >
                {/* Store Header */}
                <div className="border-b-2 border-gray-900 pb-4 mb-4 flex justify-between items-start">
                  <div>
                    <h1 className="text-xl font-bold uppercase tracking-tight text-gray-900">
                      {storeName}
                    </h1>
                    {storeAddress && (
                      <p className="text-gray-600 text-xs mt-0.5 whitespace-pre-line">
                        {storeAddress}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-4 text-xs text-gray-600 mt-1">
                      {storePhone && <span>Tel: {storePhone}</span>}
                      {settings.store_pan_vat && (
                        <span className="font-semibold text-gray-800 font-mono">
                          PAN/VAT: {settings.store_pan_vat}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="inline-block px-3 py-1 bg-gray-900 text-white font-bold uppercase tracking-wider text-[11px] rounded">
                      {isNepali ? 'खरिद दाखिला विवरण' : 'Purchase Inflow Statement'}
                    </div>
                    <p className="text-gray-500 text-[10px] mt-1.5 font-mono">
                      Generated: {formatDateTime(new Date().toISOString())}
                    </p>
                    {filters?.startDate && (
                      <p className="text-gray-600 text-[11px] mt-0.5">
                        Filter: {filters.startDate} to {filters.endDate || 'Now'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Summary KPI Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg mb-5 text-gray-800">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase font-semibold">
                      {isNepali ? 'कुल खरिद खर्च' : 'Total Spend'}
                    </span>
                    <p className="text-base font-bold font-mono text-gray-900 mt-0.5">
                      {formatCurrency(totalSpend, currencySymbol)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase font-semibold">
                      {isNepali ? 'दाखिला एकाइ' : 'Received Units'}
                    </span>
                    <p className="text-base font-bold font-mono text-sky-800 mt-0.5">
                      {formatNumberByLang(totalUnits)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase font-semibold">
                      {isNepali ? 'खरिद भ्याट (VAT)' : 'Total VAT'}
                    </span>
                    <p className="text-base font-bold font-mono text-amber-700 mt-0.5">
                      {formatCurrency(totalVat, currencySymbol)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase font-semibold">
                      {isNepali ? 'सप्लायर बाँकी (Due)' : 'Outstanding Due'}
                    </span>
                    <p className="text-base font-bold font-mono text-rose-700 mt-0.5">
                      {formatCurrency(totalDue, currencySymbol)}
                    </p>
                  </div>
                </div>

                {/* Purchases Table */}
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b-2 border-gray-300 bg-gray-100/80 text-gray-700 font-bold uppercase text-[9px] tracking-wider">
                      <th className="py-2 px-2 font-mono">Bill #</th>
                      <th className="py-2 px-2">Date & Time</th>
                      <th className="py-2 px-2">Supplier / Vendor</th>
                      <th className="py-2 px-1 text-center">Units</th>
                      <th className="py-2 px-2 text-right">Taxable</th>
                      <th className="py-2 px-2 text-right">13% VAT</th>
                      <th className="py-2 px-2 text-right">Grand Total</th>
                      <th className="py-2 px-2 text-right">Paid</th>
                      <th className="py-2 px-2 text-right">Due</th>
                      <th className="py-2 px-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {purchases.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-gray-400 italic">
                          No purchase records found.
                        </td>
                      </tr>
                    ) : (
                      purchases.map((p) => {
                        const isReturned = p.status === 'RETURNED';
                        const paid =
                          p.paid_amount !== undefined && p.paid_amount !== null
                            ? p.paid_amount
                            : (p.grand_total || p.total);
                        const due = p.due_amount ?? 0;

                        return (
                          <tr
                            key={p.id}
                            className={`align-middle ${
                              isReturned ? 'bg-rose-50/50 text-gray-500' : 'hover:bg-gray-50'
                            }`}
                          >
                            <td className="py-1.5 px-2 font-mono font-bold text-gray-900">
                              {p.bill_number || `PO-${p.id}`}
                              {p.invoice_number && (
                                <span className="block text-[9px] font-normal text-gray-500 font-mono">
                                  Inv: {p.invoice_number}
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 px-2 font-mono text-gray-600 whitespace-nowrap">
                              {formatDateTime(p.created_at)}
                            </td>
                            <td className="py-1.5 px-2 capitalize font-medium text-gray-900 truncate max-w-[140px]">
                              {p.vendor_name ? capitalizeWords(p.vendor_name) : 'Self-Supplied'}
                              {p.vendor_pan_vat && (
                                <span className="block text-[10px] text-gray-500 font-mono">
                                  PAN: {p.vendor_pan_vat}
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 px-1 text-center font-mono">
                              {p.total_units || 0}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono text-gray-600">
                              {formatCurrency(p.taxable_amount || p.subtotal, currencySymbol)}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono text-amber-700">
                              {p.vat_amount && p.vat_amount > 0
                                ? formatCurrency(p.vat_amount, currencySymbol)
                                : '—'}
                            </td>
                            <td
                              className={`py-1.5 px-2 text-right font-mono font-bold ${
                                isReturned ? 'text-gray-400 line-through' : 'text-gray-900'
                              }`}
                            >
                              {formatCurrency(p.grand_total || p.total, currencySymbol)}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono text-emerald-700">
                              {formatCurrency(paid, currencySymbol)}
                            </td>
                            <td
                              className={`py-1.5 px-2 text-right font-mono ${
                                due > 0 && !isReturned ? 'text-rose-700 font-bold' : 'text-gray-400'
                              }`}
                            >
                              {due > 0 ? formatCurrency(due, currencySymbol) : '0'}
                            </td>
                            <td className="py-1.5 px-2 text-center whitespace-nowrap">
                              {isReturned ? (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                  {isNepali ? 'फिर्ता' : 'Returned'}
                                </span>
                              ) : (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  {isNepali ? 'सम्पन्न' : 'Completed'}
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
                      <td colSpan={3} className="py-2.5 px-2 text-right uppercase text-[10px]">
                        Active Total:
                      </td>
                      <td className="py-2.5 px-1 text-center font-mono">
                        {formatNumberByLang(totalUnits)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono">
                        {formatCurrency(totalTaxable, currencySymbol)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-amber-700">
                        {totalVat > 0 ? formatCurrency(totalVat, currencySymbol) : '—'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono">
                        {formatCurrency(totalSpend, currencySymbol)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-emerald-700">
                        {formatCurrency(totalPaid, currencySymbol)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-rose-700">
                        {formatCurrency(totalDue, currencySymbol)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>

                {/* Report Footer / Signature */}
                <div className="pt-8 mt-6 border-t border-gray-200 flex justify-between items-end text-[10px] text-gray-500">
                  <div>
                    <p>Printed by StockForge Offline Management System</p>
                    <p>Page 1 of 1</p>
                  </div>
                  <div className="text-right">
                    <div className="w-40 border-b border-gray-400 pb-1 mb-1"></div>
                    <p className="font-semibold text-gray-700">Authorized Signature</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-between px-6 py-3 bg-neutral-900 border-t border-neutral-800 shrink-0">
              <span className="text-xs text-neutral-400">
                {isNepali
                  ? 'कागजातलाई A4 वा लेटर आकारमा सिधै प्रिन्ट गर्न सकिन्छ।'
                  : 'Ready to print in A4 or Letter format.'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 text-xs text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer"
                >
                  {isNepali ? 'बन्द गर्नुहोस्' : 'Close'}
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isNepali ? 'प्रिन्ट गर्नुहोस्' : 'Print'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

