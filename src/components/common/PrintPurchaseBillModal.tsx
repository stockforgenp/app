/**
 * Professional Purchase Bill & Goods Received Note (GRN) Printing Modal
 * Supports:
 * - 80mm POS Thermal Slip format (for receiving dock)
 * - Standard A4 / Letter Goods Received Note (GRN) & Purchase Invoice
 * - Direct window.print() with high-contrast print stylesheet
 * - Plaintext WhatsApp / SMS copy to clipboard
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
  Truck,
  Edit3,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Purchase, PurchaseItem, AppSettings } from '../../types/index.ts';
import { getPurchaseWithItems } from '../../lib/services/purchaseService.ts';
import { getSettings } from '../../lib/services/settingsService.ts';
import {
  formatCurrency,
  formatDateTime,
  fromMinorUnits,
  toMinorUnits,
} from '../../lib/utils/format.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';

interface PrintPurchaseBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseId: number | null;
  purchaseData?: { purchase: Purchase; items: PurchaseItem[] } | null;
  currencySymbol?: string;
}

export const PrintPurchaseBillModal: React.FC<PrintPurchaseBillModalProps> = ({
  isOpen,
  onClose,
  purchaseId,
  purchaseData,
  currencySymbol: propCurrency,
}) => {
  const { showToast } = useToast();
  const { t, isNepali } = useLanguage();
  const [details, setDetails] = useState<{ purchase: Purchase; items: PurchaseItem[] } | null>(null);
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [receiptFormat, setReceiptFormat] = useState<'thermal' | 'invoice'>('thermal');
  const [copied, setCopied] = useState(false);
  const [isEditingPrices, setIsEditingPrices] = useState(false);
  // Temporary rate overrides: key can be item.id or index, stores unit cost price in minor units
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

      if (purchaseData) {
        setDetails(purchaseData);
      } else if (purchaseId !== null) {
        const loaded = getPurchaseWithItems(purchaseId);
        setDetails(loaded);
      }
    } else {
      setDetails(null);
      setCopied(false);
      setIsEditingPrices(false);
      setCustomUnitPrices({});
    }
  }, [isOpen, purchaseId, purchaseData]);

  if (!isOpen || !details) return null;

  const { purchase, items } = details;
  const storeName = settings.store_name || 'StockForge Retail';
  const storeAddress = settings.store_address;
  const storePhone = settings.store_phone;

  // Calculate items with temporary print overrides without touching DB
  const displayItems = items.map((it, idx) => {
    const itemKey = it.id || idx;
    const isOverridden = customUnitPrices[itemKey] !== undefined;
    const effectiveCostPrice = isOverridden
      ? customUnitPrices[itemKey]
      : it.cost_price;
    const itemGross = it.quantity * effectiveCostPrice;
    const itemNetTotal = Math.max(0, itemGross - it.discount);

    return {
      ...it,
      _originalPrice: it.cost_price,
      _isOverridden: isOverridden,
      cost_price: effectiveCostPrice,
      total: itemNetTotal,
    };
  });

  const hasAnyPriceOverride = Object.keys(customUnitPrices).length > 0;

  const totalUnits = displayItems.reduce((acc, it) => acc + it.quantity, 0);
  const billNo = purchase.bill_number || `PUR-${purchase.id.toString().padStart(5, '0')}`;

  // Recalculated financial totals for printing
  const displaySubtotal = displayItems.reduce((sum, it) => sum + (it.quantity * it.cost_price), 0);
  const displayDiscount = purchase.discount;
  const displayTaxableAmount = Math.max(0, displaySubtotal - displayDiscount);
  const vatRate = purchase.vat_rate ?? 13;
  const vatAmount = vatRate > 0 ? Math.round(displayTaxableAmount * (vatRate / 100)) : 0;
  const hasVat = vatAmount > 0 || ((purchase.vat_rate ?? 0) > 0);
  const grandTotal = displayTaxableAmount + (hasVat ? vatAmount : 0);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyTextReceipt = () => {
    try {
      const lineSeparator = '------------------------------------------';
      const doubleSeparator = '==========================================';

      let text = `*${storeName.toUpperCase()} - GOODS RECEIVED NOTE*\n`;
      if (storeAddress) text += `${storeAddress}\n`;
      if (storePhone) text += `Tel: ${storePhone}\n`;
      if (settings.store_pan_vat) text += `PAN/VAT: ${settings.store_pan_vat}\n`;
      text += `${lineSeparator}\n`;
      text += `Purchase Bill #: ${billNo}\n`;
      if (purchase.invoice_number) text += `Supplier Invoice #: ${purchase.invoice_number}\n`;
      text += `Date: ${formatDateTime(purchase.created_at)}\n`;
      if (purchase.vendor_name) text += `Vendor: ${purchase.vendor_name}\n`;
      if (purchase.vendor_phone) text += `Phone: ${purchase.vendor_phone}\n`;
      if (purchase.vendor_pan_vat) text += `Vendor PAN: ${purchase.vendor_pan_vat}\n`;
      text += `${lineSeparator}\n`;
      text += `ITEMS               QTY    RATE     TOTAL\n`;
      text += `${lineSeparator}\n`;

      displayItems.forEach((it) => {
        const name = (it.product_name || 'Item').padEnd(18).slice(0, 18);
        const qty = it.quantity.toString().padStart(4);
        const rate = formatCurrency(it.cost_price, '', false).padStart(8);
        const lineTotal = formatCurrency(it.total, '', false).padStart(9);
        text += `${name} ${qty} ${rate} ${lineTotal}\n`;
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
        text += `VAT (${vatRate}%):      +${formatCurrency(vatAmount, currencySymbol)}\n`;
      }
      const paidAmount =
        purchase.paid_amount !== undefined && purchase.paid_amount !== null
          ? purchase.paid_amount
          : (purchase.grand_total || purchase.total);
      const currentDue =
        purchase.due_amount !== undefined
          ? purchase.due_amount
          : Math.max(0, grandTotal - paidAmount);
      const previousDue = purchase.previous_due ?? 0;
      const totalDue =
        purchase.total_due !== undefined ? purchase.total_due : previousDue + currentDue;

      text += `Total Items:    ${displayItems.length} (${totalUnits} units)\n`;
      text += `${doubleSeparator}\n`;
      text += `*GRAND TOTAL:   ${formatCurrency(grandTotal, currencySymbol)}*\n`;
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

      navigator.clipboard.writeText(text);
      setCopied(true);
      showToast('Purchase bill text copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('Failed to copy text', 'error');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="print-purchase-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs"
          onClick={onClose}
        >
          <motion.div
            key="print-purchase-panel"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 380, mass: 0.6 }}
            className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col max-h-[94vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-neutral-800 shrink-0 bg-neutral-900">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                    <span>{isNepali ? 'खरिद बिल / दाखिला रसिद' : 'Purchase Bill / Goods Inflow'}</span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                      #{billNo}
                    </span>
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    {isNepali
                      ? 'आपूर्तिकर्ता खरिद बीजक तथा मौज्दात दाखिला विवरण'
                      : 'Purchase order invoice, vendor details and inventory restock slip'}
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
                      ? 'दाखिला बिलमा मात्र खरिद दर बदल्नुहोस् (डाटाबेसमा परिवर्तन हुँदैन)'
                      : 'Modify rates for this print slip only (does not change database)'
                  }
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>
                    {isNepali
                      ? (isEditingPrices ? 'मूल्य सम्पादन बन्द' : 'प्रिन्ट दर बदल्नुहोस्')
                      : (isEditingPrices ? 'Done Editing' : 'Edit Print Rates')}
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
                    title={isNepali ? 'मूल दरहरू रिसेट गर्नुहोस्' : 'Reset back to original rates'}
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
                      : '⚠️ Print-only rate mode: These rates only appear on this printed slip. Your inventory, costs, and SQLite database remain 100% unchanged.'}
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

            {/* Scrollable Printable Bill Preview Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-neutral-950/70 flex justify-center items-start">
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
                  <div className="mt-2 inline-block px-2.5 py-0.5 bg-gray-100 text-gray-800 rounded text-[10px] font-semibold tracking-wider uppercase">
                    {isNepali ? 'खरिद बीजक / सामान दाखिला (GRN)' : 'Goods Received Note / Purchase Bill'}
                  </div>
                </div>

                {/* Metadata */}
                <div className="py-2.5 border-b border-dashed border-gray-300 text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">
                      {isNepali ? 'खरिद बिल नं:' : 'Purchase Bill No:'}
                    </span>
                    <span className="font-bold text-gray-900 font-mono">
                      {billNo}
                    </span>
                  </div>
                  {purchase.invoice_number && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-medium">
                        {isNepali ? 'सप्लायर बीजक नं:' : 'Supplier Inv No:'}
                      </span>
                      <span className="font-mono text-gray-900 font-semibold">
                        {purchase.invoice_number}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">{isNepali ? 'मिति:' : 'Date & Time:'}</span>
                    <span className="text-gray-800">{formatDateTime(purchase.created_at)}</span>
                  </div>
                  {purchase.vendor_name && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-medium">{isNepali ? 'आपूर्तिकर्ता:' : 'Supplier / Vendor:'}</span>
                      <span className="font-semibold text-gray-900">{purchase.vendor_name}</span>
                    </div>
                  )}
                  {purchase.vendor_phone && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-medium">{isNepali ? 'सम्पर्क:' : 'Contact:'}</span>
                      <span className="text-gray-800 font-mono">{purchase.vendor_phone}</span>
                    </div>
                  )}
                  {purchase.vendor_pan_vat && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-medium">{isNepali ? 'आपूर्तिकर्ता PAN/VAT:' : 'Supplier PAN/VAT:'}</span>
                      <span className="font-bold text-gray-900 font-mono">{purchase.vendor_pan_vat}</span>
                    </div>
                  )}
                  {purchase.vendor_address && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-medium">{isNepali ? 'ठेगाना:' : 'Address:'}</span>
                      <span className="text-gray-800">{purchase.vendor_address}</span>
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
                        <th className="pb-1.5 text-right font-bold">{isNepali ? 'खरिद दर' : 'Rate'}</th>
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
                                    title="Custom rate for print only"
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
                                    value={fromMinorUnits(it.cost_price)}
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
                                {formatCurrency(it.cost_price, currencySymbol, false)}
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

                {/* Calculations */}
                <div className="py-2.5 border-b border-dashed border-gray-300 space-y-1.5 text-[11px]">
                  <div className="flex justify-between text-gray-600">
                    <span>
                      {isNepali ? 'उप-जम्मा' : 'Subtotal'} ({displayItems.length} {isNepali ? 'सामान' : 'items'}, {totalUnits} {isNepali ? 'एकाइ' : 'units'}):
                    </span>
                    <span>{formatCurrency(displaySubtotal, currencySymbol)}</span>
                  </div>

                  {displayDiscount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>{isNepali ? 'कुल छुट:' : 'Total Discount:'}</span>
                      <span>-{formatCurrency(displayDiscount, currencySymbol)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-gray-600">
                    <span>{isNepali ? 'करयोग्य रकम:' : 'Taxable Amount:'}</span>
                    <span>{formatCurrency(displayTaxableAmount, currencySymbol)}</span>
                  </div>

                  {hasVat && (
                    <div className="flex justify-between text-sky-800 font-medium">
                      <span>{isNepali ? `मूल्य अभिवृद्धि कर (${vatRate}% VAT):` : `VAT (${vatRate}%):`}</span>
                      <span>+{formatCurrency(vatAmount, currencySymbol)}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-baseline pt-1.5 border-t border-gray-300">
                    <span className="text-sm font-black text-gray-900 uppercase tracking-tight">
                      {hasVat
                        ? (isNepali ? `कुल खरिद रकम (${vatRate}% भ्याट सहित):` : `Grand Total (Inc. ${vatRate}% VAT):`)
                        : (isNepali ? 'कुल खरिद रकम (०% भ्याट):' : 'Grand Total (0% VAT):')}
                    </span>
                    <span className="text-base font-black text-gray-900 font-mono">
                      {formatCurrency(grandTotal, currencySymbol)}
                    </span>
                  </div>

                  {/* Payment & Dues Breakdown */}
                  {(() => {
                    const paidAmount =
                      purchase.paid_amount !== undefined && purchase.paid_amount !== null
                        ? purchase.paid_amount
                        : (purchase.grand_total || purchase.total);
                    const currentDue =
                      purchase.due_amount !== undefined
                        ? purchase.due_amount
                        : Math.max(0, grandTotal - paidAmount);
                    const previousDue = purchase.previous_due ?? 0;
                    const totalDue =
                      purchase.total_due !== undefined ? purchase.total_due : previousDue + currentDue;

                    return (
                      <div className="pt-2 border-t border-dashed border-gray-300 space-y-1">
                        <div className="flex justify-between text-gray-700">
                          <span className="font-semibold">{isNepali ? 'भुक्तान गरिएको रकम (Paid Amount):' : 'Paid Amount:'}</span>
                          <span className="font-mono font-bold text-gray-900">{formatCurrency(paidAmount, currencySymbol)}</span>
                        </div>
                        {currentDue > 0 && (
                          <div className="flex justify-between text-rose-700 font-semibold">
                            <span>{isNepali ? 'यस खरिदको बाँकी (Current Purchase Due):' : 'Current Purchase Due:'}</span>
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
                            <span className="uppercase text-[11px]">{isNepali ? 'कुल बाँकी भुक्तानी (Total Payable Due):' : 'Total Payable Due:'}</span>
                            <span className="text-sm font-black font-mono text-rose-700">{formatCurrency(totalDue, currencySymbol)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Barcode */}
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
                    *{billNo}*
                  </p>
                </div>

                {/* Footer */}
                <div className="pt-2 text-center text-[10px] text-gray-600 leading-tight">
                  <p className="font-medium text-gray-800">
                    {isNepali ? 'सामान मौज्दातमा सफलतापूर्वक दाखिला गरिएको छ' : 'Inventory Received & Stock Updated'}
                  </p>
                  <p className="text-gray-500 text-[9px] mt-1">
                    Generated via StockForge Offline System
                  </p>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between px-6 py-3.5 bg-neutral-900 border-t border-neutral-800 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyTextReceipt}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-300 hover:text-neutral-100 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">{t('action_copied', 'Copied!')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{isNepali ? 'रसिद प्रतिलिपि' : 'Copy Text'}</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  {t('action_close', 'Close')}
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{t('action_print', 'Print Bill')}</span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
