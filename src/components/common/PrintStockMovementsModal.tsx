/**
 * Professional Stock Movements Audit Log Printable Report Modal
 * Provides a clean, print-optimized document preview and print trigger for stock movements
 */
import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Printer, X, History } from 'lucide-react';
import { StockMovement, AppSettings } from '../../types/index.ts';
import { getSettings } from '../../lib/services/settingsService.ts';
import {
  formatDateTime,
  capitalizeWords,
  formatNumberByLang,
} from '../../lib/utils/format.ts';
import { useLanguage } from '../../context/LanguageContext.tsx';

interface PrintStockMovementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  movements: StockMovement[];
  filters?: {
    startDate?: string;
    endDate?: string;
    search?: string;
    movementType?: string;
    vendorName?: string;
  };
}

export const PrintStockMovementsModal: React.FC<PrintStockMovementsModalProps> = ({
  isOpen,
  onClose,
  movements,
  filters,
}) => {
  const { isNepali } = useLanguage();
  const settings: AppSettings = getSettings();
  const reportRef = useRef<HTMLDivElement>(null);

  const storeName = settings.store_name || 'StockForge Retail';
  const storeAddress = settings.store_address;
  const storePhone = settings.store_phone;

  let restockUnits = 0;
  let saleUnits = 0;
  let adjustmentEvents = 0;

  for (const m of movements) {
    if (m.type === 'RESTOCK' || m.type === 'PURCHASE') {
      restockUnits += Math.max(0, m.quantity);
    } else if (m.type === 'SALE') {
      saleUnits += Math.abs(m.quantity);
    } else if (m.type === 'ADJUSTMENT') {
      adjustmentEvents++;
    } else if (m.type === 'RETURN') {
      if (m.quantity > 0) {
        restockUnits += m.quantity;
      } else {
        saleUnits += Math.abs(m.quantity);
      }
    }
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="print-movements-backdrop"
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
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-neutral-100">
                    {isNepali ? 'चलान अडिट लग प्रिन्ट रिपोर्ट' : 'Stock Movements Report Preview'}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    {isNepali
                      ? `कुल चलान रेकर्डहरू: ${formatNumberByLang(movements.length)}`
                      : `Total Records: ${movements.length} transactions`}
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
                      {isNepali ? 'चलान अडिट खाता' : 'Stock Movements Statement'}
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
                <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg mb-5 text-gray-800">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase font-semibold">
                      {isNepali ? 'दाखिला मौज्दात (Inflows)' : 'Total Received / Inflows'}
                    </span>
                    <p className="text-base font-bold font-mono text-emerald-800 mt-0.5">
                      +{formatNumberByLang(restockUnits)} units
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase font-semibold">
                      {isNepali ? 'निकासी / बिक्री (Outflows)' : 'Total Dispatched / Sales'}
                    </span>
                    <p className="text-base font-bold font-mono text-rose-800 mt-0.5">
                      -{formatNumberByLang(saleUnits)} units
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase font-semibold">
                      {isNepali ? 'मिलान घटनाहरू (Adjustments)' : 'Adjustment Events'}
                    </span>
                    <p className="text-base font-bold font-mono text-amber-800 mt-0.5">
                      {formatNumberByLang(adjustmentEvents)} times
                    </p>
                  </div>
                </div>

                {/* Movements Table */}
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b-2 border-gray-300 bg-gray-100/80 text-gray-700 font-bold uppercase text-[9px] tracking-wider">
                      <th className="py-2 px-2 font-mono">Date & Time</th>
                      <th className="py-2 px-2">Product Name</th>
                      <th className="py-2 px-1 text-center">Type</th>
                      <th className="py-2 px-2">Vendor / Party</th>
                      <th className="py-2 px-2 text-right font-mono">Qty Delta</th>
                      <th className="py-2 px-2">Audit Reason / Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {movements.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-400 italic">
                          No stock movements found matching criteria.
                        </td>
                      </tr>
                    ) : (
                      movements.map((m) => {
                        const isPositive = m.quantity > 0;
                        return (
                          <tr key={m.id} className="hover:bg-gray-50">
                            <td className="py-1.5 px-2 font-mono text-gray-600 whitespace-nowrap">
                              {formatDateTime(m.created_at)}
                            </td>
                            <td className="py-1.5 px-2 font-semibold text-gray-900 capitalize">
                              {capitalizeWords(m.product_name)}
                              {m.product_sku && (
                                <span className="block text-[9px] font-normal text-gray-500 font-mono">
                                  SKU: {m.product_sku}
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 px-1 text-center whitespace-nowrap">
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  m.type === 'RESTOCK'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : m.type === 'PURCHASE'
                                      ? 'bg-teal-100 text-teal-800 border border-teal-200'
                                      : m.type === 'SALE'
                                        ? 'bg-sky-100 text-sky-800 border border-sky-200'
                                        : m.type === 'RETURN'
                                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {m.type}
                              </span>
                            </td>
                            <td className="py-1.5 px-2 text-gray-700 capitalize">
                              {m.vendor_name ? capitalizeWords(m.vendor_name) : '—'}
                            </td>
                            <td
                              className={`py-1.5 px-2 text-right font-mono font-bold whitespace-nowrap ${
                                isPositive ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {isPositive ? `+${m.quantity}` : m.quantity}{' '}
                              <span className="font-normal text-gray-500 font-sans text-[10px]">
                                {m.product_unit || 'pcs'}
                              </span>
                            </td>
                            <td className="py-1.5 px-2 text-gray-600 break-words">{m.note || '—'}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>

                {/* Report Footer / Signature */}
                <div className="pt-8 mt-6 border-t border-gray-200 flex justify-between items-end text-[10px] text-gray-500">
                  <div>
                    <p>Printed by StockForge Offline Inventory System</p>
                    <p>Page 1 of 1</p>
                  </div>
                  <div className="text-right">
                    <div className="w-40 border-b border-gray-400 pb-1 mb-1"></div>
                    <p className="font-semibold text-gray-700">Audit Verified Signature</p>
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

