/**
 * Edit Sale Transaction Modal
 * Allows correcting mistakes in a completed sale:
 * - Edit transaction date & time
 * - Edit customer info
 * - Modify item quantities, selling prices, and discounts
 * - Add or remove products
 * - Recomputes VAT & totals and safely updates inventory atomically
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Trash2,
  Plus,
  Minus,
  Search,
  Percent,
  CheckCircle,
  AlertTriangle,
  Receipt,
  User,
  Phone,
  FileText,
  MapPin,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { Modal } from './Modal.tsx';
import { Input } from './Input.tsx';
import { NepaliDatePicker } from './NepaliDatePicker.tsx';
import { Product, Sale, SaleItem } from '../../types/index.ts';
import { getSaleWithItems, updateSale, ProcessSaleItemInput } from '../../lib/services/salesService.ts';
import { getAllProducts } from '../../lib/services/productService.ts';
import {
  formatCurrency,
  formatDateTime,
  fromMinorUnits,
  toMinorUnits,
  formatForDateTimeLocal,
  parseDateTimeLocalToIso,
  capitalizeWords,
} from '../../lib/utils/format.ts';
import { calculateProportionalDiscounts } from '../../helpers/discountHelpers.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';

interface EditSaleModalProps {
  isOpen: boolean;
  saleId: number | null;
  currencySymbol: string;
  onClose: () => void;
  onSuccess?: () => void;
}

interface EditableSaleLine {
  productId: number;
  productName: string;
  productSku?: string | null;
  unit?: string | null;
  quantity: number;
  actualSellingPrice: number; // in minor units
  discount: number; // in minor units
  currentStock: number;
}

export const EditSaleModal: React.FC<EditSaleModalProps> = ({
  isOpen,
  saleId,
  currencySymbol,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const { isNepali } = useLanguage();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saleRecord, setSaleRecord] = useState<Sale | null>(null);

  // Form State
  const [saleDateTime, setSaleDateTime] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerPanVat, setCustomerPanVat] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [applyVat, setApplyVat] = useState(true);
  const [wholeDiscountInput, setWholeDiscountInput] = useState('');
  const [paidAmountInput, setPaidAmountInput] = useState('');

  // Items State
  const [lines, setLines] = useState<EditableSaleLine[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);

  useEffect(() => {
    if (!isOpen || !saleId) {
      setSaleRecord(null);
      setLines([]);
      setWholeDiscountInput('');
      setPaidAmountInput('');
      return;
    }

    try {
      setLoading(true);
      const details = getSaleWithItems(saleId);
      const productsList = getAllProducts();
      setAllProducts(productsList);

      if (details) {
        if (details.sale.status === 'RETURNED') {
          showToast(
            isNepali
              ? 'फिर्ता भइसकेको कारोबार सच्याउन मिल्दैन।'
              : 'Returned sales transactions cannot be edited.',
            'error'
          );
          onClose();
          return;
        }

        setSaleRecord(details.sale);
        setSaleDateTime(formatForDateTimeLocal(details.sale.created_at));
        setCustomerName(details.sale.customer_name || '');
        setCustomerPhone(details.sale.customer_phone || '');
        setCustomerPanVat(details.sale.customer_pan_vat || '');
        setCustomerAddress(details.sale.customer_address || '');
        setApplyVat(
          details.sale.vat_rate !== undefined
            ? details.sale.vat_rate > 0
            : (details.sale.vat_amount || 0) > 0
        );
        const initialDiscount = details.sale.discount || 0;
        setWholeDiscountInput(initialDiscount > 0 ? fromMinorUnits(initialDiscount).toString() : '');

        const initialPaid =
          details.sale.paid_amount !== undefined && details.sale.paid_amount !== null
            ? details.sale.paid_amount
            : (details.sale.grand_total ?? details.sale.total);
        setPaidAmountInput(fromMinorUnits(initialPaid).toString());

        setLines(
          details.items.map((it) => {
            const p = productsList.find((prod) => prod.id === it.product_id);
            return {
              productId: it.product_id,
              productName: it.product_name || `Product #${it.product_id}`,
              productSku: it.product_sku,
              unit: it.product_unit || 'pcs',
              quantity: it.quantity,
              actualSellingPrice: it.selling_price,
              discount: 0,
              currentStock: p ? p.current_stock : 0,
            };
          })
        );
      }
    } catch (e: any) {
      showToast(e.message || 'Failed to load sale details', 'error');
    } finally {
      setLoading(false);
    }
  }, [isOpen, saleId]);

  // Available products for adding to sale
  const filteredAvailableProducts = useMemo(() => {
    if (!productSearch.trim()) return allProducts.slice(0, 15);
    const term = productSearch.toLowerCase();
    return allProducts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          (p.sku && p.sku.toLowerCase().includes(term))
      )
      .slice(0, 15);
  }, [allProducts, productSearch]);

  const handleAddProduct = (product: Product) => {
    const existingIndex = lines.findIndex((l) => l.productId === product.id);
    if (existingIndex >= 0) {
      const updated = [...lines];
      updated[existingIndex].quantity += 1;
      setLines(updated);
    } else {
      setLines((prev) => [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          unit: product.unit || 'pcs',
          quantity: 1,
          actualSellingPrice: product.selling_price,
          discount: 0,
          currentStock: product.current_stock,
        },
      ]);
    }
    setProductSearch('');
    setIsAddProductOpen(false);
  };

  const handleUpdateQuantity = (index: number, qty: number) => {
    if (qty <= 0) return;
    const updated = [...lines];
    updated[index].quantity = qty;
    setLines(updated);
  };

  const handleUpdatePrice = (index: number, val: string) => {
    const minor = toMinorUnits(val);
    const updated = [...lines];
    updated[index].actualSellingPrice = minor;
    setLines(updated);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) {
      showToast(
        isNepali
          ? 'कम्तिमा एउटा सामान हुनैपर्छ'
          : 'Sale must have at least one line item',
        'warning'
      );
      return;
    }
    setLines(lines.filter((_, i) => i !== index));
  };

  // Recalculations with whole bill discount
  const calculations = useMemo(() => {
    let subtotal = 0;
    let totalUnits = 0;

    const itemsForDiscount = lines.map((it) => {
      const gross = it.quantity * it.actualSellingPrice;
      subtotal += gross;
      totalUnits += it.quantity;
      return { gross, individualDiscount: 0 };
    });

    const parsedWholeDiscount = Math.min(
      subtotal,
      toMinorUnits(parseFloat(wholeDiscountInput) || 0)
    );

    const distributed = calculateProportionalDiscounts(
      itemsForDiscount,
      parsedWholeDiscount
    );

    const distributedLines = lines.map((it, idx) => {
      const gross = it.quantity * it.actualSellingPrice;
      const allocDiscount = distributed[idx]?.allocatedWholeDiscount || 0;
      const net = Math.max(0, gross - allocDiscount);
      return {
        ...it,
        gross,
        allocatedDiscount: allocDiscount,
        net,
      };
    });

    const totalDiscount = parsedWholeDiscount;
    const taxable = Math.max(0, subtotal - totalDiscount);
    const vatRate = applyVat ? 13.0 : 0.0;
    const vatAmount = applyVat ? Math.round(taxable * 0.13) : 0;
    const grandTotal = taxable + vatAmount;

    return {
      subtotal,
      totalDiscount,
      totalUnits,
      taxable,
      vatRate,
      vatAmount,
      grandTotal,
      distributedLines,
    };
  }, [lines, applyVat, wholeDiscountInput]);

  const handleSave = () => {
    if (!saleId) return;
    if (lines.length === 0) {
      showToast('Sale must contain at least one item', 'warning');
      return;
    }

    try {
      setSaving(true);
      const itemsInput: ProcessSaleItemInput[] = calculations.distributedLines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        actualSellingPrice: l.actualSellingPrice,
        discount: l.allocatedDiscount,
      }));

      const parsedPaid =
        paidAmountInput.trim() === ''
          ? 0
          : toMinorUnits(parseFloat(paidAmountInput) || 0);

      updateSale(saleId, itemsInput, {
        customerId: saleRecord?.customer_id ?? null,
        customerName: customerName.trim() ? capitalizeWords(customerName.trim()) : null,
        customerPhone: customerPhone.trim() || null,
        customerPanVat: customerPanVat.trim() || null,
        customerAddress: customerAddress.trim() || null,
        applyVat,
        paidAmount: parsedPaid,
        createdAt: parseDateTimeLocalToIso(saleDateTime),
      });

      showToast(
        isNepali
          ? `बिक्री #${saleRecord?.bill_number || saleId} सफलतापुर्वक सच्याइयो!`
          : `Sale #${saleRecord?.bill_number || saleId} updated successfully!`,
        'success'
      );

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to update sale', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isNepali
          ? `बिक्री कारोबार #${saleRecord?.bill_number || saleId} सच्याउनुहोस्`
          : `Edit Sale Transaction #${saleRecord?.bill_number || saleId}`
      }
      subtitle={
        isNepali
          ? 'सामान, मूल्य, छुट, ग्राहक वा मितिमा भएको त्रुटि सच्याउनुहोस्'
          : 'Correct mistakes in quantities, selling prices, discounts, customer info, or date'
      }
      maxWidth="4xl"
    >
      {loading ? (
        <div className="p-8 text-center text-xs text-neutral-400">
          Loading sale data...
        </div>
      ) : (
        <div className="space-y-5">
          {/* Top Row: Date & Time + Customer Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-neutral-900/80 border border-neutral-800">
            {/* Transaction Date & Time */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isNepali ? 'कारोबार मिति र समय' : 'Sale Date & Time'}</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <NepaliDatePicker
                    value={saleDateTime}
                    showTime={true}
                    sizeVariant="sm"
                    onChange={(adDateTime) => setSaleDateTime(adDateTime)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSaleDateTime(formatForDateTimeLocal())}
                  className="px-2.5 py-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors cursor-pointer shrink-0"
                  title="Reset to current time"
                >
                  {isNepali ? 'अहिले (Now)' : 'Now'}
                </button>
              </div>
              <div className="flex items-center justify-between text-[10px] text-neutral-400">
                <span>
                  {isNepali
                    ? 'गलत मिति भएमा यहाँबाट सच्याउनुहोस्'
                    : 'Adjust if the sale was conducted on a different date/time'}
                </span>
                <span className="font-mono text-emerald-400 font-semibold">
                  {formatDateTime(parseDateTimeLocalToIso(saleDateTime))}
                </span>
              </div>
            </div>

            {/* Customer Details */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-neutral-400 block mb-0.5">
                    {isNepali ? 'ग्राहकको नाम' : 'Customer Name'}
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    onBlur={() => setCustomerName((v) => capitalizeWords(v))}
                    placeholder="Walk-in Customer"
                    className="w-full px-2.5 py-1 text-xs text-neutral-100 bg-neutral-950 border border-neutral-800 rounded-lg focus:outline-none focus:border-emerald-500 capitalize"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-neutral-400 block mb-0.5">
                    {isNepali ? 'फोन नम्बर' : 'Phone'}
                  </label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="98XXXXXXXX"
                    className="w-full px-2.5 py-1 text-xs font-mono text-neutral-100 bg-neutral-950 border border-neutral-800 rounded-lg focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-neutral-400 block mb-0.5">
                    PAN / VAT
                  </label>
                  <input
                    type="text"
                    value={customerPanVat}
                    onChange={(e) => setCustomerPanVat(e.target.value)}
                    placeholder="PAN / VAT #"
                    className="w-full px-2.5 py-1 text-xs font-mono text-neutral-100 bg-neutral-950 border border-neutral-800 rounded-lg focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-neutral-400 block mb-0.5">
                    {isNepali ? 'ठेगाना' : 'Address'}
                  </label>
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Kathmandu"
                    className="w-full px-2.5 py-1 text-xs text-neutral-100 bg-neutral-950 border border-neutral-800 rounded-lg focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-200">
                {isNepali ? 'बिक्री भएका सामानहरू' : 'Sale Line Items'} (
                {lines.length})
              </span>
              <button
                type="button"
                onClick={() => setIsAddProductOpen((prev) => !prev)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isNepali ? 'सामान थप्नुहोस्' : 'Add Product'}</span>
              </button>
            </div>

            {/* Dropdown to add a product if user forgot something */}
            {isAddProductOpen && (
              <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search product to add..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs text-neutral-100 bg-neutral-950 border border-neutral-800 rounded-lg focus:outline-none focus:border-emerald-500"
                    autoFocus
                  />
                </div>
                <div className="max-h-40 overflow-y-auto divide-y divide-neutral-800/60">
                  {filteredAvailableProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleAddProduct(p)}
                      className="w-full px-3 py-2 text-left hover:bg-neutral-800/50 flex items-center justify-between transition-colors text-xs cursor-pointer"
                    >
                      <div>
                        <div className="font-medium text-neutral-200 capitalize">
                          {capitalizeWords(p.name)}
                        </div>
                        <div className="text-[10px] text-neutral-400 font-mono">
                          {p.sku || 'No SKU'} · Stock: {p.current_stock}
                        </div>
                      </div>
                      <div className="font-mono text-emerald-400 font-semibold">
                        {formatCurrency(p.selling_price, currencySymbol)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="border border-neutral-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950 text-neutral-400 border-b border-neutral-800 font-medium">
                  <tr>
                    <th className="py-2.5 px-3">Item</th>
                    <th className="py-2.5 px-2 text-center w-28">Qty</th>
                    <th className="py-2.5 px-3 text-right w-28">Sale Price</th>
                    <th className="py-2.5 px-3 text-right w-28">Total</th>
                    <th className="py-2.5 px-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 bg-neutral-900/40">
                  {calculations.distributedLines.map((line, idx) => {
                    return (
                      <tr key={idx} className="hover:bg-neutral-800/20">
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-neutral-200 capitalize">
                            {capitalizeWords(line.productName)}
                          </div>
                          <div className="text-[10px] text-neutral-400 font-mono">
                            {line.productSku || '—'} · {line.unit}
                          </div>
                        </td>
                        <td className="py-2.5 px-2">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateQuantity(idx, line.quantity - 1)
                              }
                              disabled={line.quantity <= 1}
                              className="p-1 rounded bg-neutral-800 text-neutral-300 hover:text-white disabled:opacity-30 cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={line.quantity}
                              onChange={(e) =>
                                handleUpdateQuantity(
                                  idx,
                                  parseInt(e.target.value, 10) || 1
                                )
                              }
                              className="w-12 text-center py-1 text-xs font-mono bg-neutral-950 border border-neutral-800 rounded focus:outline-none focus:border-emerald-500"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateQuantity(idx, line.quantity + 1)
                              }
                              className="p-1 rounded bg-neutral-800 text-neutral-300 hover:text-white cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={fromMinorUnits(line.actualSellingPrice)}
                            onChange={(e) => handleUpdatePrice(idx, e.target.value)}
                            className="w-24 ml-auto text-right px-2 py-1 text-xs font-mono bg-neutral-950 border border-neutral-800 rounded focus:outline-none focus:border-emerald-500"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-100">
                          {formatCurrency(line.net, currencySymbol)}
                          {line.allocatedDiscount > 0 && (
                            <div className="text-[10px] font-normal text-amber-400">
                              -{formatCurrency(line.allocatedDiscount, currencySymbol)}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            className="p-1 text-neutral-500 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Totals & VAT Toggle */}
          <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-300">
                <input
                  type="checkbox"
                  checked={applyVat}
                  onChange={(e) => setApplyVat(e.target.checked)}
                  className="rounded border-neutral-700 text-emerald-500 focus:ring-emerald-500 bg-neutral-900 cursor-pointer"
                />
                <span>
                  {isNepali
                    ? '१३% भ्याट लागू गर्नुहोस् (Apply 13% VAT)'
                    : 'Apply 13% VAT'}
                </span>
              </label>
            </div>

            <div className="space-y-1 text-right text-xs">
              <div className="flex justify-end gap-6 text-neutral-400">
                <span>{isNepali ? 'उप-जम्मा' : 'Subtotal'}:</span>
                <span className="font-mono text-neutral-200">
                  {formatCurrency(calculations.subtotal, currencySymbol)}
                </span>
              </div>
              <div className="flex items-center justify-end gap-3 text-amber-400">
                <span className="text-xs font-medium">
                  {isNepali ? 'बिल छुट (Whole Discount)' : 'Whole Bill Discount'}:
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={wholeDiscountInput}
                  onChange={(e) => setWholeDiscountInput(e.target.value)}
                  className="w-24 text-right px-2 py-1 text-xs font-mono font-bold bg-neutral-900 border border-neutral-700 rounded text-amber-400 focus:outline-none focus:border-amber-500"
                />
              </div>
              {calculations.totalDiscount > 0 && (
                <div className="flex justify-end gap-6 text-amber-400">
                  <span>{isNepali ? 'लागू भएको छुट' : 'Applied Discount'}:</span>
                  <span className="font-mono">
                    - {formatCurrency(calculations.totalDiscount, currencySymbol)}
                  </span>
                </div>
              )}
              {applyVat && (
                <div className="flex justify-end gap-6 text-neutral-400">
                  <span>13% VAT:</span>
                  <span className="font-mono text-neutral-200">
                    +{formatCurrency(calculations.vatAmount, currencySymbol)}
                  </span>
                </div>
              )}
              <div className="flex justify-end gap-6 text-sm font-bold text-neutral-100 pt-1 border-t border-neutral-800">
                <span>{isNepali ? 'कुल रकम' : 'Grand Total'}:</span>
                <span className="font-mono text-emerald-400">
                  {formatCurrency(calculations.grandTotal, currencySymbol)}
                </span>
              </div>

              {/* Paid Amount Input & Due Amount */}
              <div className="pt-2 border-t border-neutral-800 flex items-center justify-end gap-3">
                <span className="text-xs text-neutral-300 font-semibold">
                  {isNepali ? 'भुक्तानी रकम (Paid)' : 'Paid Amount'}:
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paidAmountInput}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setPaidAmountInput(e.target.value)}
                  className="w-28 text-right px-2 py-1 text-xs font-mono font-bold bg-neutral-900 border border-neutral-700 rounded text-emerald-400 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setPaidAmountInput(fromMinorUnits(calculations.grandTotal).toString())}
                  className="text-[10px] px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 cursor-pointer"
                >
                  {isNepali ? 'पूरा चुक्ता' : 'Full Paid'}
                </button>
              </div>

              {(() => {
                const pVal = paidAmountInput.trim() === '' ? 0 : toMinorUnits(parseFloat(paidAmountInput) || 0);
                const currentDue = Math.max(0, calculations.grandTotal - pVal);
                return currentDue > 0 ? (
                  <div className="flex justify-end gap-6 text-xs font-bold text-rose-400 pt-1">
                    <span>{isNepali ? 'यस बिलको बाँकी' : 'Bill Due'}:</span>
                    <span className="font-mono">{formatCurrency(currentDue, currencySymbol)}</span>
                  </div>
                ) : null;
              })()}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
            >
              {isNepali ? 'रद्द गर्नुहोस्' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || lines.length === 0}
              className="px-5 py-2 text-xs font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 rounded-xl transition-colors cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              {saving
                ? isNepali
                  ? 'सुरक्षित गर्दै...'
                  : 'Saving Changes...'
                : isNepali
                  ? 'परिवर्तन सुरक्षित गर्नुहोस्'
                  : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
