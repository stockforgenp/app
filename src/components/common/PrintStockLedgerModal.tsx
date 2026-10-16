/**
 * Professional Stock Ledger & Product Inventory Printable Report Modal
 * Supports:
 * - Full Inventory Stock Ledger statement (all active items with SKU, stock, costs, retail valuation)
 * - Single Product Stock Ledger (showing product details & complete movement ledger timeline)
 */
import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Printer, X, Boxes } from 'lucide-react';
import { Product, StockMovement, AppSettings } from '../../types/index.ts';
import { getSettings } from '../../lib/services/settingsService.ts';
import {
  formatCurrency,
  formatDateTime,
  capitalizeWords,
  formatNumberByLang,
} from '../../lib/utils/format.ts';
import { useLanguage } from '../../context/LanguageContext.tsx';

interface PrintStockLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currencySymbol: string;
  // If product & movements provided: print product stock ledger
  product?: Product | null;
  movements?: StockMovement[];
  // If products provided: print full catalog stock ledger
  products?: Product[];
  lowStockThreshold?: number;
  filterLabel?: string;
}

export const PrintStockLedgerModal: React.FC<PrintStockLedgerModalProps> = ({
  isOpen,
  onClose,
  currencySymbol,
  product,
  movements,
  products,
  lowStockThreshold = 5,
  filterLabel,
}) => {
  const { isNepali } = useLanguage();
  const settings: AppSettings = getSettings();
  const reportRef = useRef<HTMLDivElement>(null);

  const storeName = settings.store_name || 'StockForge Retail';
  const storeAddress = settings.store_address;
  const storePhone = settings.store_phone;

  const isSingleProduct = !!product;

  // Catalog valuations
  const totalUnits = (products || []).reduce((acc, p) => acc + (p.current_stock || 0), 0);
  const totalCostValuation = (products || []).reduce(
    (acc, p) => acc + (p.current_stock > 0 ? p.current_stock * p.cost_price : 0),
    0
  );
  const totalRetailValuation = (products || []).reduce(
    (acc, p) => acc + (p.current_stock > 0 ? p.current_stock * p.selling_price : 0),
    0
  );
  const lowStockCount = (products || []).filter(
    (p) => p.current_stock <= (p.min_stock_alert ?? lowStockThreshold)
  ).length;

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="print-stock-ledger-backdrop"
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
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-neutral-100">
                    {isSingleProduct
                      ? isNepali
                        ? `चलान खाता: ${product.name}`
                        : `Stock Ledger: ${product.name}`
                      : isNepali
                        ? 'सामान मौज्दात खाता (Stock Ledger) रिपोर्ट'
                        : 'Stock Ledger & Valuation Report Preview'}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    {isSingleProduct
                      ? `SKU: ${product.sku || 'None'} · Current Stock: ${product.current_stock} ${product.unit || 'pcs'}`
                      : `Total Items: ${products?.length || 0} (${totalUnits} total units)`}
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
                  <span>{isNepali ? 'प्रिन्ट गर्नुहोस्' : 'Print Ledger'}</span>
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
                      {isSingleProduct
                        ? isNepali
                          ? 'सामान चलान खाता (Item Ledger)'
                          : 'Product Movement Ledger'
                        : isNepali
                          ? 'सामान तथा मौज्दात खाता'
                          : 'Inventory Stock Ledger'}
                    </div>
                    <p className="text-gray-500 text-[10px] mt-1.5 font-mono">
                      Generated: {formatDateTime(new Date().toISOString())}
                    </p>
                    {filterLabel && (
                      <p className="text-gray-600 text-[11px] mt-0.5 font-medium">
                        Filter: {filterLabel}
                      </p>
                    )}
                  </div>
                </div>

                {isSingleProduct && product ? (
                  /* ================= SINGLE PRODUCT LEDGER VIEW ================= */
                  <div>
                    {/* Product Summary Header Strip */}
                    <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-lg mb-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase font-semibold">
                          Item Name / SKU
                        </span>
                        <p className="font-bold text-gray-900 capitalize text-sm mt-0.5">
                          {capitalizeWords(product.name)}
                        </p>
                        <p className="text-[11px] text-gray-500 font-mono">
                          SKU: {product.sku || 'None'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase font-semibold">
                          Current Stock
                        </span>
                        <p
                          className={`text-base font-bold font-mono mt-0.5 ${
                            product.current_stock <= (product.min_stock_alert ?? 5)
                              ? 'text-rose-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          {product.current_stock} {product.unit || 'pcs'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase font-semibold">
                          Cost Price
                        </span>
                        <p className="text-sm font-bold font-mono text-gray-900 mt-0.5">
                          {formatCurrency(product.cost_price, currencySymbol)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase font-semibold">
                          Selling Price
                        </span>
                        <p className="text-sm font-bold font-mono text-emerald-700 mt-0.5">
                          {formatCurrency(product.selling_price, currencySymbol)}
                        </p>
                      </div>
                    </div>

                    {/* Product Stock Movements Table */}
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="border-b-2 border-gray-300 bg-gray-100 text-gray-700 font-bold uppercase text-[9px] tracking-wider">
                          <th className="py-2 px-2">Date & Time</th>
                          <th className="py-2 px-2 text-center">Movement Type</th>
                          <th className="py-2 px-2">Vendor / Party</th>
                          <th className="py-2 px-2 text-right">Quantity Delta</th>
                          <th className="py-2 px-2">Audit Note / Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {(!movements || movements.length === 0) ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-gray-400 italic">
                              No movement records found for this product.
                            </td>
                          </tr>
                        ) : (
                          movements.map((m) => {
                            const isPositive = m.quantity > 0;
                            return (
                              <tr key={m.id} className="hover:bg-gray-50">
                                <td className="py-2 px-2 font-mono text-gray-600 whitespace-nowrap">
                                  {formatDateTime(m.created_at)}
                                </td>
                                <td className="py-2 px-2 text-center whitespace-nowrap">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold ${
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
                                <td className="py-2 px-2 text-gray-800 capitalize">
                                  {m.vendor_name ? capitalizeWords(m.vendor_name) : '—'}
                                </td>
                                <td
                                  className={`py-2 px-2 text-right font-mono font-bold whitespace-nowrap ${
                                    isPositive ? 'text-emerald-700' : 'text-rose-700'
                                  }`}
                                >
                                  {isPositive ? `+${m.quantity}` : m.quantity}{' '}
                                  <span className="font-normal text-gray-500 font-sans text-[10px]">
                                    {product.unit || m.product_unit || 'pcs'}
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-gray-700">{m.note || '—'}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* ================= FULL INVENTORY CATALOG LEDGER VIEW ================= */
                  <div>
                    {/* Valuation KPI Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg mb-5 text-gray-800">
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase font-semibold">
                          Total Unique Items
                        </span>
                        <p className="text-base font-bold font-mono text-gray-900 mt-0.5">
                          {formatNumberByLang(products?.length || 0)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase font-semibold">
                          Total Physical Stock
                        </span>
                        <p className="text-base font-bold font-mono text-sky-800 mt-0.5">
                          {formatNumberByLang(totalUnits)} units
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase font-semibold">
                          Cost Valuation
                        </span>
                        <p className="text-base font-bold font-mono text-emerald-800 mt-0.5">
                          {formatCurrency(totalCostValuation, currencySymbol)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase font-semibold">
                          Retail Valuation
                        </span>
                        <p className="text-base font-bold font-mono text-gray-900 mt-0.5">
                          {formatCurrency(totalRetailValuation, currencySymbol)}
                        </p>
                      </div>
                    </div>

                    {/* Products Stock Table */}
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="border-b-2 border-gray-300 bg-gray-100 text-gray-700 font-bold uppercase text-[9px] tracking-wider">
                          <th className="py-2 px-2">Product Name</th>
                          <th className="py-2 px-2 font-mono">SKU</th>
                          <th className="py-2 px-2 text-right">Current Stock</th>
                          <th className="py-2 px-2 text-right">Cost Price</th>
                          <th className="py-2 px-2 text-right">Selling Price</th>
                          <th className="py-2 px-2 text-right">Valuation (Cost)</th>
                          <th className="py-2 px-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {(!products || products.length === 0) ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-gray-400 italic">
                              No inventory products found.
                            </td>
                          </tr>
                        ) : (
                          products.map((p) => {
                            const isLow =
                              p.current_stock <= (p.min_stock_alert ?? lowStockThreshold);
                            const isOutOfStock = p.current_stock <= 0;
                            const itemValuation = Math.max(0, p.current_stock * p.cost_price);

                            return (
                              <tr key={p.id} className="hover:bg-gray-50">
                                <td className="py-1.5 px-2 font-semibold text-gray-900 capitalize">
                                  {capitalizeWords(p.name)}
                                </td>
                                <td className="py-1.5 px-2 font-mono text-gray-600">
                                  {p.sku || '—'}
                                </td>
                                <td
                                  className={`py-1.5 px-2 text-right font-mono font-bold ${
                                    isOutOfStock
                                      ? 'text-rose-700'
                                      : isLow
                                        ? 'text-amber-700'
                                        : 'text-gray-900'
                                  }`}
                                >
                                  {p.current_stock}{' '}
                                  <span className="font-normal text-gray-500 text-[10px] font-sans">
                                    {p.unit || 'pcs'}
                                  </span>
                                </td>
                                <td className="py-1.5 px-2 text-right font-mono text-gray-600">
                                  {formatCurrency(p.cost_price, currencySymbol)}
                                </td>
                                <td className="py-1.5 px-2 text-right font-mono text-emerald-700">
                                  {formatCurrency(p.selling_price, currencySymbol)}
                                </td>
                                <td className="py-1.5 px-2 text-right font-mono font-bold text-gray-900">
                                  {formatCurrency(itemValuation, currencySymbol)}
                                </td>
                                <td className="py-1.5 px-2 text-center whitespace-nowrap">
                                  {isOutOfStock ? (
                                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                      Out of Stock
                                    </span>
                                  ) : isLow ? (
                                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                      Low Stock
                                    </span>
                                  ) : (
                                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      Normal
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
                          <td colSpan={2} className="py-2.5 px-2 uppercase text-[10px]">
                            Total Inventory Summary:
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono">
                            {formatNumberByLang(totalUnits)}
                          </td>
                          <td colSpan={2}></td>
                          <td className="py-2.5 px-2 text-right font-mono text-emerald-800">
                            {formatCurrency(totalCostValuation, currencySymbol)}
                          </td>
                          <td className="py-2.5 px-2 text-center text-[10px] text-gray-600">
                            {lowStockCount > 0 ? `${lowStockCount} alerts` : 'Healthy'}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {/* Report Footer / Signature */}
                <div className="pt-8 mt-6 border-t border-gray-200 flex justify-between items-end text-[10px] text-gray-500">
                  <div>
                    <p>Printed by StockForge Offline Inventory System</p>
                    <p>Page 1 of 1</p>
                  </div>
                  <div className="text-right">
                    <div className="w-40 border-b border-gray-400 pb-1 mb-1"></div>
                    <p className="font-semibold text-gray-700">Storekeeper / Authorized Sign</p>
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

