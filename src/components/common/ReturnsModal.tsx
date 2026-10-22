/**
 * Returns & Credit/Debit Notes Modal
 * Facilitates:
 * 1. Customer Returns -> Issues Credit Note (CN-XXXXX) with Restock or Damaged Write-off.
 * 2. Vendor Returns -> Issues Debit Note (DN-XXXXX) with inventory outflow.
 * 3. Audit History of all issued Credit & Debit Notes.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  RotateCcw,
  Receipt,
  Truck,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Search,
  DollarSign,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import {
  Product,
  SaleReturn,
  SaleReturnItem,
  PurchaseReturn,
  PurchaseReturnItem,
  ReturnReason,
  ReturnAction,
  ReturnRefundMethod,
} from '../../types/index.ts';
import { getAllProducts } from '../../lib/services/productService.ts';
import {
  processSaleReturn,
  processPurchaseReturn,
  getAllSaleReturns,
  getSaleReturnItems,
  getAllPurchaseReturns,
  getPurchaseReturnItems,
  ProcessSaleReturnItemInput,
  ProcessPurchaseReturnItemInput,
} from '../../lib/services/returnsService.ts';
import { formatCurrency, toMinorUnits, fromMinorUnits } from '../../lib/utils/format.ts';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';

export interface ReturnsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currencySymbol: string;
  initialMode?: 'SALE' | 'PURCHASE';
}

export const ReturnsModal: React.FC<ReturnsModalProps> = ({
  isOpen,
  onClose,
  currencySymbol,
  initialMode = 'SALE',
}) => {
  const { isNepali } = useLanguage();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'NEW_SALE_RETURN' | 'NEW_PURCHASE_RETURN' | 'HISTORY'>(
    initialMode === 'PURCHASE' ? 'NEW_PURCHASE_RETURN' : 'NEW_SALE_RETURN'
  );

  const [products, setProducts] = useState<Product[]>([]);
  const [saleReturns, setSaleReturns] = useState<SaleReturn[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<PurchaseReturn[]>([]);
  const [historySearch, setHistorySearch] = useState('');

  // Sale Return Form State
  const [saleBillNumber, setSaleBillNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [saleReason, setSaleReason] = useState<ReturnReason>('CUSTOMER_CANCELLED');
  const [saleRefundMethod, setSaleRefundMethod] = useState<ReturnRefundMethod>('CASH');
  const [saleNotes, setSaleNotes] = useState('');
  const [saleItems, setSaleItems] = useState<ProcessSaleReturnItemInput[]>([]);

  // Purchase Return Form State
  const [purchaseBillNumber, setPurchaseBillNumber] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [purchaseReason, setPurchaseReason] = useState<ReturnReason>('DEFECTIVE');
  const [purchaseRefundMethod, setPurchaseRefundMethod] = useState<'CASH' | 'VENDOR_CREDIT' | 'BANK'>('VENDOR_CREDIT');
  const [purchaseNotes, setPurchaseNotes] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<ProcessPurchaseReturnItemInput[]>([]);

  // Product Selector helper state
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');

  const loadData = () => {
    try {
      const prods = getAllProducts();
      setProducts(prods);
      setSaleReturns(getAllSaleReturns());
      setPurchaseReturns(getAllPurchaseReturns());
      if (prods.length > 0 && selectedProductId === '') {
        setSelectedProductId(prods[0].id);
      }
    } catch (e) {
      console.error('Failed to load return records:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const productMap = useMemo(() => {
    const map = new Map<number, Product>();
    for (const p of products) {
      map.set(p.id, p);
    }
    return map;
  }, [products]);

  // Sale Return Items Handlers
  const handleAddSaleItem = () => {
    if (!selectedProductId) return;
    const prod = productMap.get(Number(selectedProductId));
    if (!prod) return;

    setSaleItems((prev) => [
      ...prev,
      {
        productId: prod.id,
        quantity: 1,
        unitPrice: prod.selling_price,
        action: 'RESTOCK',
      },
    ]);
  };

  const handleUpdateSaleItem = (index: number, field: keyof ProcessSaleReturnItemInput, value: any) => {
    setSaleItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveSaleItem = (index: number) => {
    setSaleItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Purchase Return Items Handlers
  const handleAddPurchaseItem = () => {
    if (!selectedProductId) return;
    const prod = productMap.get(Number(selectedProductId));
    if (!prod) return;

    setPurchaseItems((prev) => [
      ...prev,
      {
        productId: prod.id,
        quantity: 1,
        costPrice: prod.cost_price,
      },
    ]);
  };

  const handleUpdatePurchaseItem = (index: number, field: keyof ProcessPurchaseReturnItemInput, value: any) => {
    setPurchaseItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemovePurchaseItem = (index: number) => {
    setPurchaseItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Sale Return (Credit Note)
  const handleSubmitSaleReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (saleItems.length === 0) {
      showToast(isNepali ? 'कम्तीमा एक सामान छान्नुहोस्।' : 'Add at least one item to return.', 'warning');
      return;
    }

    try {
      const result = processSaleReturn({
        billNumber: saleBillNumber.trim() || null,
        customerName: customerName.trim() || null,
        refundMethod: saleRefundMethod,
        reason: saleReason,
        notes: saleNotes.trim() || undefined,
        items: saleItems,
      });

      showToast(
        isNepali
          ? `क्रेडिट नोट #${result.returnRecord.return_number} सफलतापूर्वक जारी भयो!`
          : `Credit Note #${result.returnRecord.return_number} created successfully!`,
        'success'
      );

      // Reset
      setSaleBillNumber('');
      setCustomerName('');
      setSaleNotes('');
      setSaleItems([]);
      loadData();
      setActiveTab('HISTORY');
    } catch (err: unknown) {
      showToast((err as Error).message, 'error');
    }
  };

  // Submit Purchase Return (Debit Note)
  const handleSubmitPurchaseReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (purchaseItems.length === 0) {
      showToast(isNepali ? 'कम्तीमा एक सामान छान्नुहोस्।' : 'Add at least one item to return.', 'warning');
      return;
    }

    try {
      const result = processPurchaseReturn({
        billNumber: purchaseBillNumber.trim() || null,
        vendorName: vendorName.trim() || null,
        refundMethod: purchaseRefundMethod,
        reason: purchaseReason,
        notes: purchaseNotes.trim() || undefined,
        items: purchaseItems,
      });

      showToast(
        isNepali
          ? `डेबिट नोट #${result.returnRecord.return_number} सफलतापूर्वक जारी भयो!`
          : `Debit Note #${result.returnRecord.return_number} created successfully!`,
        'success'
      );

      // Reset
      setPurchaseBillNumber('');
      setVendorName('');
      setPurchaseNotes('');
      setPurchaseItems([]);
      loadData();
      setActiveTab('HISTORY');
    } catch (err: unknown) {
      showToast((err as Error).message, 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-950/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-neutral-100 flex items-center gap-2">
                  <span>{isNepali ? 'फिर्ता तथा क्रेडिट/डेबिट नोट' : 'Returns & Credit/Debit Notes'}</span>
                </h2>
                <p className="text-xs text-neutral-400">
                  {isNepali
                    ? 'बिक्री फिर्ता (क्रेडिट नोट) र खरिद फिर्ता (डेबिट नोट) व्यवस्थापन।'
                    : 'Manage customer sale returns (Credit Notes) & vendor returns (Debit Notes).'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav Tabs */}
          <div className="px-5 py-2.5 bg-neutral-950/40 border-b border-neutral-800/80 flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveTab('NEW_SALE_RETURN')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                activeTab === 'NEW_SALE_RETURN'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>{isNepali ? 'बिक्री फिर्ता (Credit Note)' : 'Sale Return (Credit Note)'}</span>
            </button>

            <button
              onClick={() => setActiveTab('NEW_PURCHASE_RETURN')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                activeTab === 'NEW_PURCHASE_RETURN'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>{isNepali ? 'खरिद फिर्ता (Debit Note)' : 'Purchase Return (Debit Note)'}</span>
            </button>

            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                activeTab === 'HISTORY'
                  ? 'bg-neutral-800 text-neutral-100 border border-neutral-700'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{isNepali ? 'फिर्ता इतिहास (Notes History)' : 'Return Notes History'}</span>
            </button>
          </div>

          {/* Tab Body */}
          <div className="flex-1 overflow-y-auto p-5">
            {activeTab === 'NEW_SALE_RETURN' && (
              <form onSubmit={handleSubmitSaleReturn} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                      {isNepali ? 'मूल बिल नम्बर (ऐच्छिक)' : 'Original Bill Number'}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. BILL-00012"
                      value={saleBillNumber}
                      onChange={(e) => setSaleBillNumber(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 font-mono focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                      {isNepali ? 'ग्राहकको नाम (ऐच्छिक)' : 'Customer Name'}
                    </label>
                    <input
                      type="text"
                      placeholder="Walk-in Customer"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                      {isNepali ? 'फिर्ता कारण' : 'Return Reason'}
                    </label>
                    <select
                      value={saleReason}
                      onChange={(e) => setSaleReason(e.target.value as ReturnReason)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-rose-500"
                    >
                      <option value="CUSTOMER_CANCELLED">{isNepali ? 'ग्राहक रद्द / फिर्ता' : 'Customer Cancelled'}</option>
                      <option value="DEFECTIVE">{isNepali ? 'खराब / बिग्रेको (Defective)' : 'Defective / Damaged'}</option>
                      <option value="WRONG_ITEM">{isNepali ? 'गलत सामान (Wrong Item)' : 'Wrong Item'}</option>
                      <option value="EXPIRED">{isNepali ? 'म्याद नाघेको (Expired)' : 'Expired Goods'}</option>
                      <option value="OTHER">{isNepali ? 'अन्य' : 'Other'}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                      {isNepali ? 'फिर्ता भुक्तानी विधि' : 'Refund Method'}
                    </label>
                    <select
                      value={saleRefundMethod}
                      onChange={(e) => setSaleRefundMethod(e.target.value as ReturnRefundMethod)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-rose-500"
                    >
                      <option value="CASH">{isNepali ? 'नगद फिर्ता (Cash Refund)' : 'Cash Refund'}</option>
                      <option value="CREDIT_NOTE">{isNepali ? 'क्रेडिट नोट / खाता समायोजन' : 'Credit Note (Store Credit)'}</option>
                      <option value="BANK">{isNepali ? 'बैंक / eSewa फिर्ता' : 'Bank / Online Refund'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                      {isNepali ? 'कैफियत (Notes)' : 'Notes / Remarks'}
                    </label>
                    <input
                      type="text"
                      placeholder="Optional remarks"
                      value={saleNotes}
                      onChange={(e) => setSaleNotes(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                {/* Items selection bar */}
                <div className="pt-2 border-t border-neutral-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-neutral-200">
                      {isNepali ? 'फिर्ता हुने सामानहरू' : 'Return Items'}
                    </span>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value ? Number(e.target.value) : '')}
                        className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1 text-xs text-neutral-200 focus:outline-none"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.unit || 'pcs'})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleAddSaleItem}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isNepali ? 'सामान थप्नुहोस्' : 'Add Item'}</span>
                      </button>
                    </div>
                  </div>

                  {saleItems.length === 0 ? (
                    <div className="p-6 text-center text-xs text-neutral-500 bg-neutral-950/40 rounded-xl border border-dashed border-neutral-800">
                      {isNepali ? 'कुनै सामान थपिएको छैन। माथिबाट छान्नुहोस्।' : 'No items added yet. Select a product above.'}
                    </div>
                  ) : (
                    <div className="overflow-x-auto bg-neutral-950/60 rounded-xl border border-neutral-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-neutral-900 text-neutral-400 font-medium border-b border-neutral-800">
                          <tr>
                            <th className="py-2 px-3">Product</th>
                            <th className="py-2 px-2 text-center w-20">Qty</th>
                            <th className="py-2 px-2 text-right w-24">Unit Rate</th>
                            <th className="py-2 px-2 text-center w-36">Inventory Action</th>
                            <th className="py-2 px-3 text-right w-24">Total</th>
                            <th className="py-2 px-2 text-center w-8"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800/60">
                          {saleItems.map((item, idx) => {
                            const prod = productMap.get(item.productId);
                            const total = item.quantity * item.unitPrice;

                            return (
                              <tr key={idx} className="hover:bg-neutral-800/30">
                                <td className="py-2 px-3 font-semibold text-neutral-200 capitalize">
                                  {prod?.name || `Product #${item.productId}`}
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <input
                                    type="number"
                                    min="1"
                                    value={item.quantity}
                                    onChange={(e) =>
                                      handleUpdateSaleItem(idx, 'quantity', parseInt(e.target.value, 10) || 1)
                                    }
                                    className="w-16 bg-neutral-900 border border-neutral-700 rounded px-1.5 py-0.5 text-center text-xs font-mono text-neutral-100"
                                  />
                                </td>
                                <td className="py-2 px-2 text-right">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={fromMinorUnits(item.unitPrice)}
                                    onChange={(e) =>
                                      handleUpdateSaleItem(idx, 'unitPrice', toMinorUnits(e.target.value))
                                    }
                                    className="w-20 bg-neutral-900 border border-neutral-700 rounded px-1.5 py-0.5 text-right text-xs font-mono text-neutral-100"
                                  />
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <select
                                    value={item.action}
                                    onChange={(e) =>
                                      handleUpdateSaleItem(idx, 'action', e.target.value as ReturnAction)
                                    }
                                    className={`text-[11px] rounded px-1.5 py-0.5 font-semibold border ${
                                      item.action === 'RESTOCK'
                                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                                        : 'bg-rose-950/80 text-rose-300 border-rose-800/60'
                                    }`}
                                  >
                                    <option value="RESTOCK">{isNepali ? 'पुन: स्टक (Restock)' : 'Restock to Inventory'}</option>
                                    <option value="DAMAGED">{isNepali ? 'खराब / नष्ट (Damaged Write-off)' : 'Damaged (Do not restock)'}</option>
                                  </select>
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-neutral-100">
                                  {formatCurrency(total, currencySymbol)}
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSaleItem(idx)}
                                    className="text-neutral-500 hover:text-rose-400 p-1"
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
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
                  <div className="text-xs text-neutral-400 font-mono">
                    Total Refund:{' '}
                    <span className="text-sm font-bold text-rose-400">
                      {formatCurrency(
                        saleItems.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0),
                        currencySymbol
                      )}
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="flex items-center gap-2 py-2 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors shadow-lg shadow-rose-600/20"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isNepali ? 'क्रेडिट नोट जारी गर्नुहोस्' : 'Issue Credit Note'}</span>
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'NEW_PURCHASE_RETURN' && (
              <form onSubmit={handleSubmitPurchaseReturn} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                      {isNepali ? 'खरिद बिल नम्बर (ऐच्छिक)' : 'Purchase Bill Number'}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. PUR-00005"
                      value={purchaseBillNumber}
                      onChange={(e) => setPurchaseBillNumber(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                      {isNepali ? 'आपूर्तिकर्ताको नाम (ऐच्छिक)' : 'Vendor Name'}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ABC Wholesalers"
                      value={vendorName}
                      onChange={(e) => setVendorName(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                      {isNepali ? 'फिर्ता कारण' : 'Return Reason'}
                    </label>
                    <select
                      value={purchaseReason}
                      onChange={(e) => setPurchaseReason(e.target.value as ReturnReason)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                    >
                      <option value="DEFECTIVE">{isNepali ? 'खराब / बिग्रेको (Defective)' : 'Defective / Damaged'}</option>
                      <option value="EXPIRED">{isNepali ? 'म्याद नाघेको (Expired)' : 'Expired Goods'}</option>
                      <option value="WRONG_ITEM">{isNepali ? 'गलत सामान (Wrong Item)' : 'Wrong Item'}</option>
                      <option value="OTHER">{isNepali ? 'अन्य' : 'Other'}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                      {isNepali ? 'भुक्तानी समायोजन विधि' : 'Adjustment Method'}
                    </label>
                    <select
                      value={purchaseRefundMethod}
                      onChange={(e) => setPurchaseRefundMethod(e.target.value as any)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                    >
                      <option value="VENDOR_CREDIT">{isNepali ? 'भेन्डर खाता क्रेडिट (Vendor Credit)' : 'Vendor Credit Note'}</option>
                      <option value="CASH">{isNepali ? 'नगद फिर्ता (Cash Refund)' : 'Cash Refund'}</option>
                      <option value="BANK">{isNepali ? 'बैंक फिर्ता (Bank Refund)' : 'Bank Refund'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                      {isNepali ? 'कैफियत (Notes)' : 'Notes / Remarks'}
                    </label>
                    <input
                      type="text"
                      placeholder="Optional remarks"
                      value={purchaseNotes}
                      onChange={(e) => setPurchaseNotes(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Items selection bar */}
                <div className="pt-2 border-t border-neutral-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-neutral-200">
                      {isNepali ? 'आपूर्तिकर्तालाई फिर्ता हुने सामानहरू' : 'Vendor Return Items'}
                    </span>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value ? Number(e.target.value) : '')}
                        className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1 text-xs text-neutral-200 focus:outline-none"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (Stk: {p.current_stock} {p.unit || 'pcs'})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleAddPurchaseItem}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isNepali ? 'सामान थप्नुहोस्' : 'Add Item'}</span>
                      </button>
                    </div>
                  </div>

                  {purchaseItems.length === 0 ? (
                    <div className="p-6 text-center text-xs text-neutral-500 bg-neutral-950/40 rounded-xl border border-dashed border-neutral-800">
                      {isNepali ? 'कुनै सामान थपिएको छैन। माथिबाट छान्नुहोस्।' : 'No items added yet. Select a product above.'}
                    </div>
                  ) : (
                    <div className="overflow-x-auto bg-neutral-950/60 rounded-xl border border-neutral-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-neutral-900 text-neutral-400 font-medium border-b border-neutral-800">
                          <tr>
                            <th className="py-2 px-3">Product</th>
                            <th className="py-2 px-2 text-center w-20">Qty</th>
                            <th className="py-2 px-2 text-right w-24">Cost Rate</th>
                            <th className="py-2 px-3 text-right w-24">Total</th>
                            <th className="py-2 px-2 text-center w-8"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800/60">
                          {purchaseItems.map((item, idx) => {
                            const prod = productMap.get(item.productId);
                            const total = item.quantity * item.costPrice;

                            return (
                              <tr key={idx} className="hover:bg-neutral-800/30">
                                <td className="py-2 px-3 font-semibold text-neutral-200 capitalize">
                                  {prod?.name || `Product #${item.productId}`}
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <input
                                    type="number"
                                    min="1"
                                    value={item.quantity}
                                    onChange={(e) =>
                                      handleUpdatePurchaseItem(idx, 'quantity', parseInt(e.target.value, 10) || 1)
                                    }
                                    className="w-16 bg-neutral-900 border border-neutral-700 rounded px-1.5 py-0.5 text-center text-xs font-mono text-neutral-100"
                                  />
                                </td>
                                <td className="py-2 px-2 text-right">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={fromMinorUnits(item.costPrice)}
                                    onChange={(e) =>
                                      handleUpdatePurchaseItem(idx, 'costPrice', toMinorUnits(e.target.value))
                                    }
                                    className="w-20 bg-neutral-900 border border-neutral-700 rounded px-1.5 py-0.5 text-right text-xs font-mono text-neutral-100"
                                  />
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-neutral-100">
                                  {formatCurrency(total, currencySymbol)}
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePurchaseItem(idx)}
                                    className="text-neutral-500 hover:text-rose-400 p-1"
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
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
                  <div className="text-xs text-neutral-400 font-mono">
                    Total Debit:{' '}
                    <span className="text-sm font-bold text-amber-400">
                      {formatCurrency(
                        purchaseItems.reduce((acc, it) => acc + it.quantity * it.costPrice, 0),
                        currencySymbol
                      )}
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="flex items-center gap-2 py-2 px-5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-colors shadow-lg shadow-amber-600/20"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isNepali ? 'डेबिट नोट जारी गर्नुहोस्' : 'Issue Debit Note'}</span>
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'HISTORY' && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder={isNepali ? 'नोट नम्बर वा ग्राहक/भेन्डर खोज्नुहोस्...' : 'Search note number, bill, party...'}
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Credit Notes Column */}
                  <div className="bg-neutral-950/60 rounded-xl border border-neutral-800 p-3 flex flex-col">
                    <h3 className="text-xs font-bold text-rose-400 flex items-center justify-between pb-2 border-b border-neutral-800 mb-2">
                      <span className="flex items-center gap-1.5">
                        <Receipt className="w-3.5 h-3.5" />
                        <span>{isNepali ? 'क्रेडिट नोटहरू (Credit Notes)' : 'Credit Notes (Sale Returns)'}</span>
                      </span>
                      <span className="text-[10px] font-mono px-1.5 rounded bg-rose-500/15 text-rose-300">
                        {saleReturns.length}
                      </span>
                    </h3>

                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                      {saleReturns.length === 0 ? (
                        <div className="p-4 text-center text-xs text-neutral-500">
                          {isNepali ? 'कुनै क्रेडिट नोट छैन।' : 'No credit notes issued.'}
                        </div>
                      ) : (
                        saleReturns.map((cn) => (
                          <div
                            key={cn.id}
                            className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800/80 hover:border-neutral-700 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-xs text-rose-300">{cn.return_number}</span>
                              <span className="font-mono font-bold text-xs text-neutral-100">
                                {formatCurrency(cn.total_refund, currencySymbol)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-neutral-400 mt-1">
                              <span>Ref: {cn.bill_number || 'Direct'}</span>
                              <span>{cn.customer_name || 'Walk-in'}</span>
                            </div>
                            <div className="flex items-center justify-between text-[9px] text-neutral-500 mt-1 pt-1 border-t border-neutral-800/50">
                              <span>Method: {cn.refund_method}</span>
                              <span>{new Date(cn.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Debit Notes Column */}
                  <div className="bg-neutral-950/60 rounded-xl border border-neutral-800 p-3 flex flex-col">
                    <h3 className="text-xs font-bold text-amber-400 flex items-center justify-between pb-2 border-b border-neutral-800 mb-2">
                      <span className="flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5" />
                        <span>{isNepali ? 'डेबिट नोटहरू (Debit Notes)' : 'Debit Notes (Purchase Returns)'}</span>
                      </span>
                      <span className="text-[10px] font-mono px-1.5 rounded bg-amber-500/15 text-amber-300">
                        {purchaseReturns.length}
                      </span>
                    </h3>

                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                      {purchaseReturns.length === 0 ? (
                        <div className="p-4 text-center text-xs text-neutral-500">
                          {isNepali ? 'कुनै डेबिट नोट छैन।' : 'No debit notes issued.'}
                        </div>
                      ) : (
                        purchaseReturns.map((dn) => (
                          <div
                            key={dn.id}
                            className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800/80 hover:border-neutral-700 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-xs text-amber-300">{dn.return_number}</span>
                              <span className="font-mono font-bold text-xs text-neutral-100">
                                {formatCurrency(dn.total_refund, currencySymbol)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-neutral-400 mt-1">
                              <span>Ref: {dn.bill_number || 'Direct'}</span>
                              <span>{dn.vendor_name || 'Vendor'}</span>
                            </div>
                            <div className="flex items-center justify-between text-[9px] text-neutral-500 mt-1 pt-1 border-t border-neutral-800/50">
                              <span>Method: {dn.refund_method}</span>
                              <span>{new Date(dn.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

