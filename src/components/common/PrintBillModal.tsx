/**
 * Professional Bill & Receipt Printing Modal
 * Supports:
 * - 80mm POS Thermal Slip format (for receipt printers)
 * - Standard A4 / Letter Tax Invoice format
 * - Direct window.print() with high-contrast print stylesheet
 * - Plaintext WhatsApp / SMS receipt copy to clipboard
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Printer,
  X,
  Copy,
  Check,
  Receipt,
  FileText,
  Edit3,
  RotateCcw,
  Sparkles,
  Info,
} from 'lucide-react';
import { Sale, SaleItem, AppSettings } from '../../types/index.ts';
import { getSaleWithItems } from '../../lib/services/salesService.ts';
import { getSettings } from '../../lib/services/settingsService.ts';
import {
  formatCurrency,
  formatDateTime,
  fromMinorUnits,
  toMinorUnits,
} from '../../lib/utils/format.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';

interface PrintBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleId: number | null;
  saleData?: { sale: Sale; items: SaleItem[] } | null;
  currencySymbol?: string;
}

export const PrintBillModal: React.FC<PrintBillModalProps> = ({
  isOpen,
  onClose,
  saleId,
  saleData,
  currencySymbol: propCurrency,
}) => {
  const { showToast } = useToast();
  const { t, isNepali } = useLanguage();
  const [details, setDetails] = useState<{ sale: Sale; items: SaleItem[] } | null>(null);
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [receiptFormat, setReceiptFormat] = useState<'thermal' | 'invoice'>('thermal');
  const [copied, setCopied] = useState(false);
  const [isEditingPrices, setIsEditingPrices] = useState(false);
  // Temporary price overrides: key can be item.id or index, stores unit selling price in major units (string or number)
  const [customUnitPrices, setCustomUnitPrices] = useState<Record<string | number, number>>({});
  const billRef = useRef<HTMLDivElement>(null);

  const rawCurrency = propCurrency || settings.currency_symbol || (isNepali ? 'रु.' : 'Rs.');
  const currencySymbol = useMemo(() => {
    const raw = (rawCurrency || '').trim();
    if (isNepali) {
      if (
        !raw ||
        raw === 'Rs.' ||
        raw === 'Rs' ||
        raw.toLowerCase() === 'rs' ||
        raw.toLowerCase() === 'rs.' ||
        raw.toUpperCase() === 'NRS' ||
        raw.toUpperCase() === 'NRS.'
      ) {
        return 'रु.';
      }
    } else {
      if (
        !raw ||
        raw === 'रु.' ||
        raw === 'रु' ||
        raw === 'रू.' ||
        raw === 'रू'
      ) {
        return 'Rs.';
      }
    }
    return raw || (isNepali ? 'रु.' : 'Rs.');
  }, [rawCurrency, isNepali]);

  useEffect(() => {
    if (isOpen) {
      const currentSettings = getSettings();
      setSettings(currentSettings);
      setIsEditingPrices(false);
      setCustomUnitPrices({});

      if (saleData) {
        setDetails(saleData);
      } else if (saleId !== null) {
        const loaded = getSaleWithItems(saleId);
        setDetails(loaded);
      }
    } else {
      setDetails(null);
      setCopied(false);
      setIsEditingPrices(false);
      setCustomUnitPrices({});
    }
  }, [isOpen, saleId, saleData]);

  if (!isOpen || !details) return null;

  const { sale, items } = details;
  const storeName = settings.store_name || 'StockForge Retail';
  const storeAddress = settings.store_address;
  const storePhone = settings.store_phone;
  const receiptFooter = settings.receipt_footer || 'Thank you for your business! Please visit again.';

  // Calculate items with temporary print overrides without touching DB
  const displayItems = items.map((it, idx) => {
    const itemKey = it.id || idx;
    const isOverridden = customUnitPrices[itemKey] !== undefined;
    const effectiveSellingPrice = isOverridden
      ? customUnitPrices[itemKey]
      : it.selling_price;
    const itemGross = it.quantity * effectiveSellingPrice;
    const itemNetTotal = Math.max(0, itemGross - it.discount);

    return {
      ...it,
      _originalPrice: it.selling_price,
      _isOverridden: isOverridden,
      selling_price: effectiveSellingPrice,
      total: itemNetTotal,
    };
  });

  const hasAnyPriceOverride = Object.keys(customUnitPrices).length > 0;

  const totalUnits = displayItems.reduce((acc, it) => acc + it.quantity, 0);

  // Recalculated financial totals for printing
  const displaySubtotal = displayItems.reduce((sum, it) => sum + (it.quantity * it.selling_price), 0);
  const displayDiscount = sale.discount;
  const displayTaxableAmount = Math.max(0, displaySubtotal - displayDiscount);
  const vatRate = sale.vat_rate ?? 13;
  const hasVat = (sale.vat_amount !== undefined && sale.vat_amount > 0) || ((sale.vat_rate ?? 0) > 0);
  const displayVatAmount = hasVat ? Math.round(displayTaxableAmount * (vatRate / 100)) : 0;
  const displayGrandTotal = displayTaxableAmount + displayVatAmount;

  // Trigger high-precision print
  const handlePrint = () => {
    window.print();
  };

  // Plaintext receipt generator for WhatsApp / SMS copying
  const handleCopyTextReceipt = () => {
    try {
      const lineSeparator = '------------------------------------------';
      const doubleSeparator = '==========================================';

      let text = `*${storeName.toUpperCase()}*\n`;
      if (storeAddress) text += `${storeAddress}\n`;
      if (storePhone) text += `Tel: ${storePhone}\n`;
      if (settings.store_pan_vat) text += `PAN/VAT: ${settings.store_pan_vat}\n`;
      text += `${lineSeparator}\n`;
      text += `Bill #: ${sale.bill_number || `BILL-${sale.id.toString().padStart(5, '0')}`}\n`;
      text += `Date: ${formatDateTime(sale.created_at)}\n`;
      if (sale.customer_name) text += `Customer: ${sale.customer_name}\n`;
      if (sale.customer_phone) text += `Phone: ${sale.customer_phone}\n`;
      if (sale.customer_pan_vat) text += `PAN/VAT: ${sale.customer_pan_vat}\n`;
      if (sale.customer_address) text += `Address: ${sale.customer_address}\n`;
      text += `${lineSeparator}\n`;
      text += `ITEMS               QTY    PRICE    TOTAL\n`;
      text += `${lineSeparator}\n`;

      displayItems.forEach((it) => {
        const name = (it.product_name || 'Item').padEnd(18).slice(0, 18);
        const qty = it.quantity.toString().padStart(4);
        const price = formatCurrency(it.selling_price, '', false).padStart(8);
        const lineTotal = formatCurrency(it.total, '', false).padStart(9);
        text += `${name} ${qty} ${price} ${lineTotal}\n`;
        if (it.discount > 0) {
          text += `  (Discount: -${formatCurrency(it.discount, currencySymbol)})\n`;
        }
      });

      text += `${lineSeparator}\n`;
      text += `Subtotal:       ${formatCurrency(displaySubtotal, currencySymbol)}\n`;
      if (displayDiscount > 0) {
        text += `Discount:      -${formatCurrency(displayDiscount, currencySymbol)}\n`;
      }
      text += `Taxable Amount: ${formatCurrency(displayTaxableAmount, currencySymbol)}\n`;
      if (hasVat) {
        text += `${vatRate}% VAT:       +${formatCurrency(displayVatAmount, currencySymbol)}\n`;
      }
      const paidAmount =
        sale.paid_amount !== undefined && sale.paid_amount !== null
          ? sale.paid_amount
          : (sale.grand_total ?? sale.total);
      const currentDue =
        sale.due_amount !== undefined
          ? sale.due_amount
          : Math.max(0, displayGrandTotal - paidAmount);
      const previousDue = sale.previous_due ?? 0;
      const totalDue =
        sale.total_due !== undefined ? sale.total_due : previousDue + currentDue;

      text += `Total Items:    ${displayItems.length} (${totalUnits} units)\n`;
      text += `${doubleSeparator}\n`;
      text += `*GRAND TOTAL:   ${formatCurrency(displayGrandTotal, currencySymbol)}*\n`;
      text += `Paid Amount:    ${formatCurrency(paidAmount, currencySymbol)}\n`;
      if (currentDue > 0) {
        text += `Current Due:    ${formatCurrency(currentDue, currencySymbol)}\n`;
      }
      if (previousDue > 0) {
        text += `Previous Due:   ${formatCurrency(previousDue, currencySymbol)}\n`;
      }
      if (previousDue > 0 || currentDue > 0) {
        text += `*TOTAL DUE:     ${formatCurrency(totalDue, currencySymbol)}*\n`;
      }
      text += `${doubleSeparator}\n`;
      text += `${receiptFooter}\n`;

      navigator.clipboard.writeText(text);
      setCopied(true);
      showToast('Bill text copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('Failed to copy text', 'error');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="print-bill-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs"
          onClick={onClose}
        >
          <motion.div
            key="print-bill-panel"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 380, mass: 0.6 }}
            className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col max-h-[94vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
        {/* Top Dialog Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-neutral-800 shrink-0 bg-neutral-900">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                <span>{t('bill_print_title', 'Print Bill')}</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                  {sale.bill_number || `#INV-${sale.id.toString().padStart(6, '0')}`}
                </span>
              </h3>
              <p className="text-[11px] text-neutral-400">
                {t('bill_print_subtitle', 'Preview and print receipt for customer or POS records')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Price Override Toggle Button */}
            <button
              type="button"
              onClick={() => setIsEditingPrices((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border transition-colors cursor-pointer ${
                isEditingPrices
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold'
                  : hasAnyPriceOverride
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold'
                  : 'bg-neutral-800 text-neutral-300 hover:text-white border-neutral-700'
              }`}
              title={
                isNepali
                  ? 'बिलमा मात्र मूल्य बदल्नुहोस् (डाटाबेसमा परिवर्तन हुँदैन)'
                  : 'Modify prices for this print slip only (does not change database)'
              }
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>
                {isNepali
                  ? (isEditingPrices ? 'मूल्य सम्पादन बन्द' : 'प्रिन्ट दर बदल्नुहोस्')
                  : (isEditingPrices ? 'Done Editing' : 'Edit Print Prices')}
              </span>
              {hasAnyPriceOverride && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 ml-0.5 animate-pulse" />
              )}
            </button>

            {hasAnyPriceOverride && (
              <button
                type="button"
                onClick={() => setCustomUnitPrices({})}
                className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-400 hover:text-rose-400 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg transition-colors cursor-pointer"
                title={isNepali ? 'मूल दरहरू रिसेट गर्नुहोस्' : 'Reset back to original prices'}
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">{isNepali ? 'रिसेट' : 'Reset'}</span>
              </button>
            )}

            {/* Format toggle: Thermal Slip vs Standard A4 */}
            <div className="flex items-center bg-neutral-950 p-0.5 rounded-lg border border-neutral-800 text-xs">
              <button
                type="button"
                onClick={() => setReceiptFormat('thermal')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  receiptFormat === 'thermal'
                    ? 'bg-neutral-800 text-neutral-100 font-semibold'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>{t('bill_thermal_format', 'Thermal 80mm')}</span>
              </button>
              <button
                type="button"
                onClick={() => setReceiptFormat('invoice')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  receiptFormat === 'invoice'
                    ? 'bg-neutral-800 text-neutral-100 font-semibold'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{t('bill_invoice_format', 'Invoice A4')}</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Informational Banner if price editing is active or overrides exist */}
        {(isEditingPrices || hasAnyPriceOverride) && (
          <div className="px-6 py-2 bg-amber-950/40 border-b border-amber-900/50 flex items-center justify-between text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                {isNepali
                  ? '⚠️ प्रिन्ट दर सम्पादन सक्रिय: यो परिवर्तन प्रिन्ट हुने बिलमा मात्र लागु हुन्छ। तपाईंको मौज्दात र वास्तविक डाटाबेस परिवर्तन हुँदैन।'
                  : '⚠️ Print-only price mode: These prices only appear on this printed receipt. Your inventory, accounts, and SQLite database remain 100% unchanged.'}
              </span>
            </div>
            {hasAnyPriceOverride && (
              <button
                type="button"
                onClick={() => setCustomUnitPrices({})}
                className="text-[11px] underline text-amber-300 hover:text-white shrink-0 ml-3"
              >
                {isNepali ? 'मूल दरमा फर्काउनुहोस्' : 'Restore Originals'}
              </button>
            )}
          </div>
        )}

        {/* Scrollable Bill Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-neutral-950/70 flex justify-center items-start">
          {/* THE PRINTABLE BILL CONTAINER */}
          <div
            id="printable-bill"
            ref={billRef}
            className={`bg-white text-black shadow-lg transition-all ${
              receiptFormat === 'thermal'
                ? 'w-full max-w-[340px] p-5 font-mono text-xs rounded-lg'
                : 'w-full max-w-xl p-8 font-sans text-xs rounded-xl'
            }`}
            style={{ color: '#111827' }}
          >
            {/* Header */}
            <div className="text-center pb-3 border-b border-dashed border-gray-300">
              <h2 className="text-base font-bold tracking-tight text-gray-900 uppercase">
                {storeName}
              </h2>
              {storeAddress && (
                <p className="text-[11px] text-gray-600 mt-0.5 whitespace-pre-line leading-tight">
                  {storeAddress}
                </p>
              )}
              {storePhone && (
                <p className="text-[11px] text-gray-600 mt-0.5">
                  Tel: {storePhone}
                </p>
              )}
              {settings.store_pan_vat && (
                <p className="text-[11px] font-mono font-medium text-gray-700 mt-0.5">
                  PAN/VAT: {settings.store_pan_vat}
                </p>
              )}
              <div className="mt-2 inline-block px-2 py-0.5 bg-gray-100 text-gray-800 rounded text-[10px] font-semibold tracking-wider uppercase">
                {isNepali ? 'कर बीजक / नगद रसिद' : 'Tax Invoice / Cash Receipt'}
              </div>
            </div>

            {/* Metadata (Bill #, Date, Customer) */}
            <div className="py-2.5 border-b border-dashed border-gray-300 text-[11px] space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">{isNepali ? 'बीजक नं:' : 'Invoice No:'}</span>
                <span className="font-bold text-gray-900">
                  {sale.bill_number || `BILL-${sale.id.toString().padStart(5, '0')}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">{isNepali ? 'मिति:' : 'Date & Time:'}</span>
                <span className="text-gray-800">{formatDateTime(sale.created_at)}</span>
              </div>
              {sale.customer_name && (
                <div className="flex justify-between">
                  <span className="text-gray-500 font-medium">{isNepali ? 'ग्राहक:' : 'Customer:'}</span>
                  <span className="font-semibold text-gray-900">{sale.customer_name}</span>
                </div>
              )}
              {sale.customer_phone && (
                <div className="flex justify-between">
                  <span className="text-gray-500 font-medium">{isNepali ? 'सम्पर्क:' : 'Contact:'}</span>
                  <span className="text-gray-800">{sale.customer_phone}</span>
                </div>
              )}
              {sale.customer_pan_vat && (
                <div className="flex justify-between">
                  <span className="text-gray-500 font-medium">{isNepali ? 'PAN / VAT नं:' : 'PAN / VAT No:'}</span>
                  <span className="font-mono font-semibold text-gray-900">{sale.customer_pan_vat}</span>
                </div>
              )}
              {sale.customer_address && (
                <div className="flex justify-between">
                  <span className="text-gray-500 font-medium">{isNepali ? 'ठेगाना:' : 'Address:'}</span>
                  <span className="text-gray-800 text-right max-w-[200px] truncate">{sale.customer_address}</span>
                </div>
              )}
            </div>

            {/* Line Items Table */}
            <div className="py-3 border-b border-dashed border-gray-300">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-600 uppercase text-[9px] tracking-wider">
                    <th className="pb-1.5 font-bold">{isNepali ? 'सामान' : 'Item'}</th>
                    <th className="pb-1.5 text-center font-bold">{isNepali ? 'परिमाण' : 'Qty'}</th>
                    <th className="pb-1.5 text-right font-bold">{isNepali ? 'दर' : 'Price'}</th>
                    <th className="pb-1.5 text-right font-bold">{isNepali ? 'जम्मा' : 'Total'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayItems.map((it, idx) => {
                    const itemKey = it.id || idx;
                    const isCustom = it._isOverridden;

                    return (
                      <tr key={itemKey} className="align-top">
                        <td className="py-1.5 pr-2">
                          <div className="font-semibold text-gray-900 leading-tight flex items-center gap-1">
                            <span>{it.product_name}</span>
                            {isCustom && (
                              <span
                                className="print:hidden text-[9px] font-normal px-1 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300"
                                title="Custom price for print only"
                              >
                                {isNepali ? 'परिवर्तित' : 'Custom'}
                              </span>
                            )}
                          </div>
                          {it.discount > 0 && (
                            <div className="text-[9px] text-emerald-700">
                              {isNepali ? 'छुट:' : 'Disc:'} -{formatCurrency(it.discount, currencySymbol)}
                            </div>
                          )}
                        </td>
                        <td className="py-1.5 px-1 text-center font-bold text-gray-800 whitespace-nowrap">
                          {it.quantity} {it.product_unit ? <span className="font-normal text-[10px] text-gray-500">{it.product_unit}</span> : ''}
                        </td>
                        <td className="py-1.5 px-1 text-right text-gray-600 whitespace-nowrap">
                          {isEditingPrices ? (
                            <div className="print:hidden inline-flex items-center gap-1 justify-end">
                              <span className="text-[10px] text-gray-400 font-sans">{currencySymbol}</span>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={fromMinorUnits(it.selling_price)}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  const minor = isNaN(val) ? 0 : toMinorUnits(val);
                                  setCustomUnitPrices((prev) => ({
                                    ...prev,
                                    [itemKey]: minor,
                                  }));
                                }}
                                className="w-20 px-1.5 py-0.5 text-right font-mono text-[11px] font-bold text-gray-900 bg-amber-50 border border-amber-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
                              />
                            </div>
                          ) : null}
                          <div className={isEditingPrices ? 'hidden print:block' : ''}>
                            {formatCurrency(it.selling_price, currencySymbol, false)}
                          </div>
                        </td>
                        <td className="py-1.5 pl-1 text-right font-bold text-gray-900 whitespace-nowrap">
                          {formatCurrency(it.total, currencySymbol, false)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals & Calculations */}
            <div className="py-2.5 border-b border-dashed border-gray-300 space-y-1.5 text-[11px]">
              <div className="flex justify-between text-gray-600">
                <span>{isNepali ? 'उप-जम्मा' : 'Subtotal'} ({displayItems.length} {isNepali ? 'सामान' : 'items'}, {totalUnits} {isNepali ? 'एकाइ' : 'units'}):</span>
                <span>{formatCurrency(displaySubtotal, currencySymbol)}</span>
              </div>

              {displayDiscount > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>{isNepali ? 'कुल छुट:' : 'Total Discount:'}</span>
                  <span>-{formatCurrency(displayDiscount, currencySymbol)}</span>
                </div>
              )}

              {/* Taxable amount & VAT (if applicable) */}
              <div className="flex justify-between text-gray-600">
                <span>{isNepali ? 'करयोग्य रकम:' : 'Taxable Amount:'}</span>
                <span>{formatCurrency(displayTaxableAmount, currencySymbol)}</span>
              </div>
              {hasVat && (
                <div className="flex justify-between text-sky-700 font-medium">
                  <span>{isNepali ? `${vatRate}% भ्याट:` : `${vatRate}% VAT:`}</span>
                  <span>+{formatCurrency(displayVatAmount, currencySymbol)}</span>
                </div>
              )}

              <div className="flex justify-between items-baseline pt-1.5 border-t border-gray-300">
                <span className="text-sm font-black text-gray-900 uppercase tracking-tight">
                  {hasVat
                    ? (isNepali ? 'कुल भुक्तानी रकम (भ्याट सहित):' : 'Grand Total Due (Inc. VAT):')
                    : (isNepali ? 'कुल भुक्तानी रकम (०% भ्याट):' : 'Grand Total Due (0% VAT):')}
                </span>
                <span className="text-base font-black text-gray-900 font-mono">
                  {formatCurrency(displayGrandTotal, currencySymbol)}
                </span>
              </div>

              {/* Payment & Dues Breakdown */}
              {(() => {
                const paidAmount =
                  sale.paid_amount !== undefined && sale.paid_amount !== null
                    ? sale.paid_amount
                    : (sale.grand_total ?? sale.total);
                const currentDue =
                  sale.due_amount !== undefined
                    ? sale.due_amount
                    : Math.max(0, displayGrandTotal - paidAmount);
                const previousDue = sale.previous_due ?? 0;
                const totalDue =
                  sale.total_due !== undefined ? sale.total_due : previousDue + currentDue;

                return (
                  <div className="pt-2 border-t border-dashed border-gray-300 space-y-1">
                    <div className="flex justify-between text-gray-700">
                      <span className="font-semibold">{isNepali ? 'प्राप्त रकम (Paid Amount):' : 'Paid Amount:'}</span>
                      <span className="font-mono font-bold text-gray-900">{formatCurrency(paidAmount, currencySymbol)}</span>
                    </div>
                    {currentDue > 0 && (
                      <div className="flex justify-between text-rose-700 font-semibold">
                        <span>{isNepali ? 'यस बिलको बाँकी (Current Bill Due):' : 'Current Bill Due:'}</span>
                        <span className="font-mono font-bold">{formatCurrency(currentDue, currencySymbol)}</span>
                      </div>
                    )}
                    {previousDue > 0 && (
                      <div className="flex justify-between text-amber-800">
                        <span>{isNepali ? 'साविकको बाँकी (Previous Due):' : 'Previous Due / Balance:'}</span>
                        <span className="font-mono font-bold">{formatCurrency(previousDue, currencySymbol)}</span>
                      </div>
                    )}
                    {(previousDue > 0 || currentDue > 0) && (
                      <div className="flex justify-between items-baseline pt-1 border-t border-gray-300 font-bold text-gray-900">
                        <span className="uppercase text-[11px]">{isNepali ? 'कुल बाँकी बक्यौता:' : 'Total Outstanding Due:'}</span>
                        <span className="text-sm font-black font-mono text-rose-700">{formatCurrency(totalDue, currencySymbol)}</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Simulated Barcode for POS Slip */}
            <div className="pt-3 pb-1 text-center">
              <div className="inline-flex items-center justify-center gap-[2px] h-9 px-4 bg-gray-50 border border-gray-200 rounded">
                {[4, 2, 6, 2, 8, 3, 2, 5, 2, 7, 3, 4, 6, 2, 8, 3, 2, 6, 4, 2].map((w, i) => (
                  <span
                    key={i}
                    className="bg-black inline-block h-6"
                    style={{ width: `${w}px` }}
                  />
                ))}
              </div>
              <p className="text-[10px] font-mono text-gray-500 mt-1">
                *INV-{sale.id.toString().padStart(6, '0')}*
              </p>
            </div>

            {/* Receipt Footer Message */}
            <div className="pt-2 text-center text-[10px] text-gray-600 leading-tight">
              <p className="font-medium text-gray-800">{receiptFooter}</p>
              <p className="text-gray-600 text-[9px] mt-1">
                Generated via StockForge Offline POS
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-neutral-900 border-t border-neutral-800 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyTextReceipt}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-300 hover:text-neutral-100 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer"
              title={isNepali ? 'व्हाट्सएप वा SMS को लागि रसिद प्रतिलिपि' : 'Copy bill text for WhatsApp / SMS'}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">{t('bill_copied', 'Copied!')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{t('bill_copy_whatsapp', 'Copy for WhatsApp')}</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
            >
              {t('action_close', 'Close')}
            </button>

            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{t('bill_print_button', 'Print Bill Now')}</span>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
  );
};
