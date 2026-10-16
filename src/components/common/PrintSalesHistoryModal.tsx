/**
 * Professional Sales History Printable Report Modal
 * Provides a clean, print-optimized document preview and print trigger for sales history
 */
import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Printer, X, Receipt } from 'lucide-react';
import { Sale, AppSettings } from '../../types/index.ts';
import { getSettings } from '../../lib/services/settingsService.ts';
import {
  formatCurrency,
  formatDateTime,
  capitalizeWords,
  formatNumberByLang,
} from '../../lib/utils/format.ts';
import { useLanguage } from '../../context/LanguageContext.tsx';

interface PrintSalesHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sales: Sale[];
  currencySymbol: string;
  filters?: {
    startDate?: string;
    endDate?: string;
    search?: string;
    datePreset?: string;
  };
}

export const PrintSalesHistoryModal: React.FC<PrintSalesHistoryModalProps> = ({
  isOpen,
  onClose,
  sales,
  currencySymbol,
  filters,
}) => {
  const { isNepali } = useLanguage();
  const settings: AppSettings = getSettings();
  const reportRef = useRef<HTMLDivElement>(null);

  const storeName = settings.store_name || 'StockForge Retail';
  const storeAddress = settings.store_address;
  const storePhone = settings.store_phone;

  // Filter out or count returned vs completed
  const activeSales = sales.filter((s) => s.status !== 'RETURNED');
  const returnedSales = sales.filter((s) => s.status === 'RETURNED');

  const totalGrossSubtotal = activeSales.reduce((acc, s) => acc + (s.subtotal || 0), 0);
  const totalDiscount = activeSales.reduce((acc, s) => acc + (s.discount || 0), 0);
  const totalNetRevenue = activeSales.reduce(
    (acc, s) => acc + (s.grand_total ?? s.total ?? 0),
    0
  );
  const totalPaid = activeSales.reduce((acc, s) => {
    const paid =
      s.paid_amount !== undefined && s.paid_amount !== null
        ? s.paid_amount
        : (s.grand_total ?? s.total);
    return acc + (paid || 0);
  }, 0);
  const totalDue = activeSales.reduce((acc, s) => acc + (s.due_amount || 0), 0);
  const totalProfit = activeSales.reduce((acc, s) => acc + (s.gross_profit || 0), 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="print-sales-history-backdrop"
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
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-neutral-100">
                    {isNepali ? 'बिक्री इतिहास प्रिन्ट रिपोर्ट' : 'Sales History Report Preview'}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    {isNepali
                      ? `कुल कारोबार: ${formatNumberByLang(sales.length)} (सम्पन्न: ${formatNumberByLang(activeSales.length)}, फिर्ता: ${formatNumberByLang(returnedSales.length)})`
                      : `Total Records: ${sales.length} (${activeSales.length} Completed, ${returnedSales.length} Returned)`}
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
                      {isNepali ? 'बिक्री कारोबार विवरण' : 'Sales History Statement'}
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
                      {isNepali ? 'कुल बिक्री (Net Revenue)' : 'Net Revenue'}
                    </span>
                    <p className="text-base font-bold font-mono text-gray-900 mt-0.5">
                      {formatCurrency(totalNetRevenue, currencySymbol)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase font-semibold">
                      {isNepali ? 'कुल भुक्तानी प्राप्त (Paid)' : 'Total Received'}
                    </span>
                    <p className="text-base font-bold font-mono text-emerald-700 mt-0.5">
                      {formatCurrency(totalPaid, currencySymbol)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase font-semibold">
                      {isNepali ? 'कुल बाँकी बक्यौता (Due)' : 'Outstanding Due'}
                    </span>
                    <p className="text-base font-bold font-mono text-rose-700 mt-0.5">
                      {formatCurrency(totalDue, currencySymbol)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase font-semibold">
                      {isNepali ? 'कुल खुद नाफा (Gross Profit)' : 'Gross Profit'}
                    </span>
                    <p className="text-base font-bold font-mono text-teal-700 mt-0.5">
                      {formatCurrency(totalProfit, currencySymbol)}
                    </p>
                  </div>
                </div>

                {/* Sales Table */}
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b-2 border-gray-300 bg-gray-100/80 text-gray-700 font-bold uppercase text-[9px] tracking-wider">
                      <th className="py-2 px-2 font-mono">Sale #</th>
                      <th className="py-2 px-2">Date & Time</th>
                      <th className="py-2 px-2">Customer</th>
                      <th className="py-2 px-1 text-center">Items</th>
                      <th className="py-2 px-2 text-right">Subtotal</th>
                      <th className="py-2 px-2 text-right">Discount</th>
                      <th className="py-2 px-2 text-right">Net Total</th>
                      <th className="py-2 px-2 text-right">Paid</th>
                      <th className="py-2 px-2 text-right">Due</th>
                      <th className="py-2 px-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {sales.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-gray-400 italic">
                          No sales transactions found.
                        </td>
                      </tr>
                    ) : (
                      sales.map((s) => {
                        const isReturned = s.status === 'RETURNED';
                        const paid =
                          s.paid_amount !== undefined && s.paid_amount !== null
                            ? s.paid_amount
                            : (s.grand_total ?? s.total);
                        const due = s.due_amount ?? 0;

                        return (
                          <tr
                            key={s.id}
                            className={`align-middle ${
                              isReturned ? 'bg-rose-50/50 text-gray-500' : 'hover:bg-gray-50'
                            }`}
                          >
                            <td className="py-1.5 px-2 font-mono font-bold text-gray-900">
                              {s.bill_number || `#${s.id}`}
                            </td>
                            <td className="py-1.5 px-2 font-mono text-gray-600 whitespace-nowrap">
                              {formatDateTime(s.created_at)}
                            </td>
                            <td className="py-1.5 px-2 capitalize font-medium text-gray-900 truncate max-w-[140px]">
                              {s.customer_name ? capitalizeWords(s.customer_name) : 'Walk-in'}
                              {s.customer_phone && (
                                <span className="block text-[10px] text-gray-500 font-mono">
                                  {s.customer_phone}
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 px-1 text-center font-mono">
                              {s.item_count || 1}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono text-gray-600">
                              {formatCurrency(s.subtotal, currencySymbol)}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono text-amber-700">
                              {s.discount > 0 ? formatCurrency(s.discount, currencySymbol) : '—'}
                            </td>
                            <td
                              className={`py-1.5 px-2 text-right font-mono font-bold ${
                                isReturned ? 'text-gray-400 line-through' : 'text-gray-900'
                              }`}
                            >
                              {formatCurrency(s.grand_total ?? s.total, currencySymbol)}
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
                      <td colSpan={4} className="py-2.5 px-2 text-right uppercase text-[10px]">
                        Active Total:
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono">
                        {formatCurrency(totalGrossSubtotal, currencySymbol)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-amber-700">
                        {totalDiscount > 0 ? formatCurrency(totalDiscount, currencySymbol) : '—'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono">
                        {formatCurrency(totalNetRevenue, currencySymbol)}
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

