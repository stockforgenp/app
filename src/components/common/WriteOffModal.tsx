/**
 * Expired, Damaged & Spoilage Write-Off Modal (Standard ERP Quarantine & Disposal)
 * Allows store managers to:
 * 1. Inspect expired batches in quarantine.
 * 2. Write off damaged/spoiled/lost stock with scrap vouchers (WO-XXXXX).
 * 3. Choose whether to book the financial loss as an expense.
 * 4. Audit past write-offs and scrap vouchers.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  AlertOctagon,
  Trash2,
  Calendar,
  AlertTriangle,
  FileText,
  DollarSign,
  CheckCircle2,
  Search,
  Printer,
  ShieldAlert,
  ArrowRight,
  Package,
} from 'lucide-react';
import {
  Product,
  StockWriteOff,
  WriteOffReason,
  WriteOffAction,
} from '../../types/index.ts';
import { getAllProducts } from '../../lib/services/productService.ts';
import { getAllBatches } from '../../lib/services/batchService.ts';
import {
  createStockWriteOff,
  getAllStockWriteOffs,
  getWriteOffSummary,
  getExpiredBatchCandidates,
  WriteOffSummary,
  ExpiredCandidateItem,
} from '../../lib/services/writeOffService.ts';
import { formatCurrency, fromMinorUnits, toMinorUnits } from '../../lib/utils/format.ts';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';

export interface WriteOffModalProps {
  isOpen: boolean;
  onClose: () => void;
  currencySymbol: string;
}

export const WriteOffModal: React.FC<WriteOffModalProps> = ({
  isOpen,
  onClose,
  currencySymbol,
}) => {
  const { isNepali } = useLanguage();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'QUARANTINE' | 'NEW_WRITE_OFF' | 'HISTORY'>('QUARANTINE');

  const [products, setProducts] = useState<Product[]>([]);
  const [writeOffs, setWriteOffs] = useState<StockWriteOff[]>([]);
  const [summary, setSummary] = useState<WriteOffSummary | null>(null);
  const [expiredCandidates, setExpiredCandidates] = useState<ExpiredCandidateItem[]>([]);

  // Form states
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [selectedBatchId, setSelectedBatchId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState<WriteOffReason>('EXPIRED');
  const [action, setAction] = useState<WriteOffAction>('DISPOSAL');
  const [approvedBy, setApprovedBy] = useState('Owner / Manager');
  const [recordAsExpense, setRecordAsExpense] = useState(true);
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');

  const loadData = () => {
    try {
      const prods = getAllProducts();
      setProducts(prods);
      setWriteOffs(getAllStockWriteOffs());
      setSummary(getWriteOffSummary());
      const expired = getExpiredBatchCandidates();
      setExpiredCandidates(expired);

      if (prods.length > 0 && selectedProductId === '') {
        setSelectedProductId(prods[0].id);
      }
    } catch (e) {
      console.error('Failed to load write-off data:', e);
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

  const currentProduct = selectedProductId ? productMap.get(Number(selectedProductId)) : null;

  // Available batches for selected product
  const availableBatches = useMemo(() => {
    if (!selectedProductId) return [];
    try {
      return getAllBatches({ includeEmpty: false }).filter((b) => b.product_id === Number(selectedProductId));
    } catch {
      return [];
    }
  }, [selectedProductId]);

  // Quick action from Quarantine list
  const handleQuickWriteOffExpired = (candidate: ExpiredCandidateItem) => {
    setSelectedProductId(candidate.productId);
    setSelectedBatchId(candidate.batchId);
    setQuantity(candidate.quantity.toString());
    setReason('EXPIRED');
    setAction('DISPOSAL');
    setNotes(`Automated quarantine disposal for expired batch ${candidate.batchNumber} (Exp: ${candidate.expiryDate})`);
    setActiveTab('NEW_WRITE_OFF');
  };

  const handleCreateWriteOff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      showToast(isNepali ? 'कृपया सामान छान्नुहोस्।' : 'Please select a product.', 'warning');
      return;
    }
    const q = parseFloat(quantity);
    if (isNaN(q) || q <= 0) {
      showToast(isNepali ? 'परिमाण शून्यभन्दा बढी हुनुपर्छ।' : 'Quantity must be greater than zero.', 'warning');
      return;
    }

    try {
      const b = selectedBatchId ? availableBatches.find((x) => x.id === Number(selectedBatchId)) : null;
      const result = createStockWriteOff({
        productId: Number(selectedProductId),
        quantity: q,
        batchId: b ? b.id : undefined,
        batchNumber: b ? b.batch_number : undefined,
        reason,
        action,
        approvedBy: approvedBy.trim() || undefined,
        notes: notes.trim() || undefined,
        recordAsExpense,
      });

      showToast(
        isNepali
          ? `वाउचर #${result.voucher_number} सिर्जना भयो। मौज्दातबाट ${q} एकाइ हटाइयो!`
          : `Voucher #${result.voucher_number} created. ${q} units removed from stock!`,
        'success'
      );

      // Reset
      setQuantity('1');
      setNotes('');
      loadData();
      setActiveTab('HISTORY');
    } catch (err: unknown) {
      showToast((err as Error).message, 'error');
    }
  };

  const filteredWriteOffs = useMemo(() => {
    return writeOffs.filter((wo) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        wo.voucher_number.toLowerCase().includes(q) ||
        wo.product_name.toLowerCase().includes(q) ||
        wo.reason.toLowerCase().includes(q) ||
        (wo.batch_number && wo.batch_number.toLowerCase().includes(q))
      );
    });
  }, [writeOffs, search]);

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
                <AlertOctagon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-neutral-100 flex items-center gap-2">
                  <span>{isNepali ? 'ड्यामेज, म्याद नाघेका तथा नोक्सानी सामान व्यवस्थापन' : 'Expired & Damaged Goods Management'}</span>
                </h2>
                <p className="text-xs text-neutral-400">
                  {isNepali
                    ? 'क्वारेन्टाइन, नष्ट वाउचर (Scrap Voucher) र नोक्सानी हिसाब समायोजन।'
                    : 'Quarantine expired goods, issue scrap vouchers, and track financial spoilage.'}
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

          {/* Navigation Bar */}
          <div className="px-5 py-2.5 bg-neutral-950/40 border-b border-neutral-800/80 flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveTab('QUARANTINE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                activeTab === 'QUARANTINE'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{isNepali ? 'म्याद नाघेका क्वारेन्टाइन' : 'Expired Quarantine'}</span>
              {expiredCandidates.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-mono text-[10px]">
                  {expiredCandidates.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('NEW_WRITE_OFF')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                activeTab === 'NEW_WRITE_OFF'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isNepali ? 'नयाँ नोक्सानी / नष्ट दर्ता' : 'Record Write-Off / Scrap'}</span>
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
              <span>{isNepali ? 'वाउचर इतिहास (Vouchers)' : 'Scrap Vouchers'} ({writeOffs.length})</span>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5">
            {activeTab === 'QUARANTINE' && (
              <div className="space-y-4">
                {/* Quarantine Banner */}
                <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/40 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="text-xs font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      <span>{isNepali ? 'म्याद समाप्त भएका मौज्दात (Quarantine)' : 'Expired Stock Segregation'}</span>
                    </h3>
                    <p className="text-xs text-neutral-400 mt-1">
                      {isNepali
                        ? 'यी सामानहरूको म्याद सकिएको छ। काउन्टरबाट बिक्री हुनबाट रोक्न तत्काल नष्ट (Dispose) वा भेन्डर फिर्ता गर्नुहोस्।'
                        : 'These lots have passed their expiry date and should be quarantined from saleable stock.'}
                    </p>
                  </div>

                  <div className="text-right font-mono">
                    <div className="text-[10px] text-neutral-400 uppercase">Total Expired Value</div>
                    <div className="text-sm font-bold text-rose-400">
                      {formatCurrency(
                        expiredCandidates.reduce((acc, c) => acc + c.totalLossValue, 0),
                        currencySymbol
                      )}
                    </div>
                  </div>
                </div>

                {/* Candidates Table */}
                {expiredCandidates.length === 0 ? (
                  <div className="p-12 text-center text-xs text-neutral-400 bg-neutral-950/40 rounded-xl border border-neutral-800">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <p className="font-semibold text-neutral-200">
                      {isNepali ? 'कुनै पनि सामानको म्याद नाघेको छैन!' : 'No expired stock found in inventory!'}
                    </p>
                    <p className="text-[11px] text-neutral-500 mt-1">
                      {isNepali ? 'तपाईंको इन्भेन्टरी स्वस्थ र बिक्री योग्य छ।' : 'All active lots are within their validity dates.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto bg-neutral-950/60 rounded-xl border border-neutral-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-900 text-neutral-400 font-medium border-b border-neutral-800">
                        <tr>
                          <th className="py-2.5 px-3">Product</th>
                          <th className="py-2.5 px-3">Batch Number</th>
                          <th className="py-2.5 px-3">Expired On</th>
                          <th className="py-2.5 px-3 text-center">Unsold Qty</th>
                          <th className="py-2.5 px-3 text-right">Cost Loss</th>
                          <th className="py-2.5 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800/60">
                        {expiredCandidates.map((c) => (
                          <tr key={c.batchId} className="hover:bg-neutral-800/30">
                            <td className="py-2.5 px-3 font-semibold text-neutral-200 capitalize">
                              {c.productName}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-amber-300">
                              {c.batchNumber}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-rose-400 font-bold">
                              {c.expiryDate}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-neutral-100">
                              {c.quantity}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-300">
                              {formatCurrency(c.totalLossValue, currencySymbol)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleQuickWriteOffExpired(c)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-xs transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>{isNepali ? 'नष्ट गर्नुहोस्' : 'Dispose'}</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'NEW_WRITE_OFF' && (
              <form onSubmit={handleCreateWriteOff} className="space-y-4 max-w-2xl mx-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">
                      {isNepali ? 'सामान (Product)' : 'Select Product'} *
                    </label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => {
                        setSelectedProductId(e.target.value ? Number(e.target.value) : '');
                        setSelectedBatchId('');
                      }}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-rose-500"
                    >
                      <option value="">-- {isNepali ? 'सामान रोज्नुहोस्' : 'Select Product'} --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Stock: {p.current_stock} {p.unit || 'pcs'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {availableBatches.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1">
                        {isNepali ? 'ब्याच नं. (ऐच्छिक)' : 'Batch Number (Optional)'}
                      </label>
                      <select
                        value={selectedBatchId}
                        onChange={(e) => setSelectedBatchId(e.target.value ? Number(e.target.value) : '')}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-amber-300 font-mono focus:outline-none focus:border-rose-500"
                      >
                        <option value="">-- Non-Batch / All Lots --</option>
                        {availableBatches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.batch_number} (Exp: {b.expiry_date}, Stk: {b.quantity})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">
                      {isNepali ? 'नष्ट हुने परिमाण (Qty)' : 'Write-Off Quantity'} *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 font-mono font-bold focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">
                      {isNepali ? 'कारण (Reason)' : 'Loss Reason'} *
                    </label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value as WriteOffReason)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-rose-500"
                    >
                      <option value="EXPIRED">{isNepali ? 'म्याद समाप्त (Expired)' : 'Expired Goods'}</option>
                      <option value="DAMAGED">{isNepali ? 'फुटफुट / ड्यामेज (Damaged)' : 'Physical Damage'}</option>
                      <option value="SPOILED_LEAKED">{isNepali ? 'कुहिएको / चुहिएको (Spoiled/Leaked)' : 'Spoiled / Leaked'}</option>
                      <option value="LOST_STOLEN">{isNepali ? 'हराएको वा चोरी (Lost/Stolen)' : 'Lost or Stolen'}</option>
                      <option value="DEFECTIVE">{isNepali ? 'निर्माण त्रुटि (Defective)' : 'Manufacturing Defect'}</option>
                      <option value="DEAD_STOCK">{isNepali ? 'नबिकेको डम्प (Dead Stock)' : 'Dead / Obsolete Stock'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">
                      {isNepali ? 'कारबाही (Action)' : 'Disposal Action'} *
                    </label>
                    <select
                      value={action}
                      onChange={(e) => setAction(e.target.value as WriteOffAction)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-rose-500"
                    >
                      <option value="DISPOSAL">{isNepali ? 'नष्ट / फालिने (Complete Disposal)' : 'Destroy / Dispose'}</option>
                      <option value="VENDOR_RETURN_PENDING">{isNepali ? 'सप्लायर फिर्ता बाँकी (Vendor Return)' : 'Pending Return to Vendor'}</option>
                      <option value="SALVAGE_CLEARANCE">{isNepali ? 'सस्तोमा बेच्ने (Salvage Clearance)' : 'Salvage at Deep Discount'}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">
                      {isNepali ? 'स्वीकृत कर्ता (Approved By)' : 'Authorized By'}
                    </label>
                    <input
                      type="text"
                      value={approvedBy}
                      onChange={(e) => setApprovedBy(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">
                      {isNepali ? 'कैफियत (Notes)' : 'Notes / Scrap Audit Remarks'}
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Broken packaging during transport"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                {/* Financial Ledger checkbox */}
                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-amber-400" />
                    <div>
                      <div className="text-xs font-semibold text-neutral-200">
                        {isNepali ? 'खर्च लेजरमा नोक्सानी दर्ता (Record as Expense)' : 'Post Loss to Expense Ledger'}
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        {isNepali
                          ? 'नाफा-नोक्सान हिसाबमा यो सामानको खरिद मूल्यलाई नोक्सानी खर्च देखाउँछ।'
                          : 'Deducts total cost value as an Inventory Spoilage expense in profit analytics.'}
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={recordAsExpense}
                    onChange={(e) => setRecordAsExpense(e.target.checked)}
                    className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-rose-500 focus:ring-0 cursor-pointer"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/20 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isNepali ? 'नष्ट वाउचर जारी गर्नुहोस् (Confirm Write-Off)' : 'Confirm Write-Off & Scrap Stock'}</span>
                </button>
              </form>
            )}

            {activeTab === 'HISTORY' && (
              <div className="space-y-4">
                {/* KPI Summary Cards */}
                {summary && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/40">
                      <div className="text-[10px] font-bold text-rose-400 uppercase">
                        {isNepali ? 'कुल नोक्सानी रकम' : 'Total Loss Value'}
                      </div>
                      <div className="text-base font-bold text-rose-300 font-mono mt-0.5">
                        {formatCurrency(summary.totalLossAmount, currencySymbol)}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800">
                      <div className="text-[10px] font-bold text-neutral-400 uppercase">
                        {isNepali ? 'नष्ट गरिएको परिमाण' : 'Total Units Scrapped'}
                      </div>
                      <div className="text-base font-bold text-neutral-200 font-mono mt-0.5">
                        {summary.totalUnitsWrittenOff} units
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800">
                      <div className="text-[10px] font-bold text-neutral-400 uppercase">
                        {isNepali ? 'कुल वाउचर संख्या' : 'Scrap Certificates'}
                      </div>
                      <div className="text-base font-bold text-neutral-200 font-mono mt-0.5">
                        {summary.totalVouchersCount} vouchers
                      </div>
                    </div>
                  </div>
                )}

                {/* Search */}
                <div className="relative">
                  <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={isNepali ? 'वाउचर नं., सामान वा कारण खोज्नुहोस्...' : 'Search voucher number, product, or reason...'}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-rose-500"
                  />
                </div>

                {/* Vouchers Table */}
                {filteredWriteOffs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-neutral-500">
                    {isNepali ? 'कुनै नष्ट वाउचर रेकर्ड छैन।' : 'No scrap vouchers recorded yet.'}
                  </div>
                ) : (
                  <div className="overflow-x-auto bg-neutral-950/60 rounded-xl border border-neutral-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-900 text-neutral-400 font-medium border-b border-neutral-800">
                        <tr>
                          <th className="py-2.5 px-3">Voucher #</th>
                          <th className="py-2.5 px-3">Product</th>
                          <th className="py-2.5 px-2 text-center">Qty</th>
                          <th className="py-2.5 px-3 text-right">Total Loss</th>
                          <th className="py-2.5 px-3 text-center">Reason</th>
                          <th className="py-2.5 px-3 text-center">Action</th>
                          <th className="py-2.5 px-3">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800/60 font-mono">
                        {filteredWriteOffs.map((wo) => (
                          <tr key={wo.id} className="hover:bg-neutral-800/30">
                            <td className="py-2.5 px-3 font-bold text-rose-400">{wo.voucher_number}</td>
                            <td className="py-2.5 px-3 font-sans font-semibold text-neutral-200 capitalize">
                              <div>{wo.product_name}</div>
                              {wo.batch_number && (
                                <div className="text-[10px] text-amber-400 font-mono font-normal">
                                  Batch: {wo.batch_number}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-center font-bold text-neutral-100">
                              {wo.quantity}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-rose-300">
                              {formatCurrency(wo.total_loss, currencySymbol)}
                            </td>
                            <td className="py-2.5 px-3 text-center font-sans">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-neutral-800 text-neutral-300">
                                {wo.reason}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-sans">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
                                {wo.action}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-neutral-400 text-[11px] font-sans">
                              {new Date(wo.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

