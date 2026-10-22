/**
 * Batch & Expiry Management Modal
 * Allows store owners to inspect, filter, and track product batches,
 * monitoring near-expiry and expired stock with FEFO priority.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Boxes,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Search,
  RefreshCw,
} from 'lucide-react';
import { ProductBatch } from '../../types/index.ts';
import { getAllBatches } from '../../lib/services/batchService.ts';
import { formatCurrency, formatNumberByLang } from '../../lib/utils/format.ts';
import { useLanguage } from '../../context/LanguageContext.tsx';

export interface BatchManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currencySymbol: string;
}

export const BatchManagementModal: React.FC<BatchManagementModalProps> = ({
  isOpen,
  onClose,
  currencySymbol,
}) => {
  const { isNepali } = useLanguage();
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'HEALTHY' | 'EXPIRING_SOON' | 'EXPIRED'>('ALL');
  const [loading, setLoading] = useState(false);

  const loadData = () => {
    setLoading(true);
    try {
      const data = getAllBatches({ includeEmpty: false });
      setBatches(data);
    } catch (e) {
      console.error('Failed to load batches:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const in30DaysStr = useMemo(() => {
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }, []);

  // Summary counts
  const stats = useMemo(() => {
    let expired = 0;
    let expiringSoon = 0;
    let healthy = 0;

    for (const b of batches) {
      if (b.expiry_date < todayStr) {
        expired++;
      } else if (b.expiry_date <= in30DaysStr) {
        expiringSoon++;
      } else {
        healthy++;
      }
    }

    return { total: batches.length, expired, expiringSoon, healthy };
  }, [batches, todayStr, in30DaysStr]);

  // Filtered list
  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      // Status filter
      if (statusFilter === 'EXPIRED' && b.expiry_date >= todayStr) return false;
      if (statusFilter === 'EXPIRING_SOON' && (b.expiry_date < todayStr || b.expiry_date > in30DaysStr)) return false;
      if (statusFilter === 'HEALTHY' && b.expiry_date <= in30DaysStr) return false;

      // Search filter
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchBatch = b.batch_number.toLowerCase().includes(q);
        const matchProd = (b.product_name || '').toLowerCase().includes(q);
        const matchSku = (b.product_sku || '').toLowerCase().includes(q);
        if (!matchBatch && !matchProd && !matchSku) return false;
      }

      return true;
    });
  }, [batches, statusFilter, search, todayStr, in30DaysStr]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-4xl bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/60">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
                  {isNepali ? 'ब्याच तथा म्याद व्यवस्थापन' : 'Batch & Expiry Management'}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-mono">
                    FEFO
                  </span>
                </h2>
                <p className="text-xs text-neutral-400">
                  {isNepali
                    ? 'ब्याच अनुसार स्टक, म्याद सकिने मिति र स्वचालित चेतावनी'
                    : 'Batch-wise stock levels, expiry tracking, and automated alerts'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-4 gap-3 px-6 py-3 bg-neutral-950/40 border-b border-neutral-800/80">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`p-2.5 rounded-lg border text-left transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-neutral-800 border-neutral-600'
                  : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className="text-[11px] text-neutral-400 font-medium">
                {isNepali ? 'कुल ब्याचहरू' : 'Total Batches'}
              </div>
              <div className="text-base font-bold text-neutral-100 font-mono mt-0.5">
                {formatNumberByLang(stats.total, isNepali ? 'np' : 'en')}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('HEALTHY')}
              className={`p-2.5 rounded-lg border text-left transition-all ${
                statusFilter === 'HEALTHY'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                  : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className="text-[11px] text-emerald-400/80 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {isNepali ? 'सक्रिय / सुरक्षित' : 'Healthy (> 30d)'}
              </div>
              <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                {formatNumberByLang(stats.healthy, isNepali ? 'np' : 'en')}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('EXPIRING_SOON')}
              className={`p-2.5 rounded-lg border text-left transition-all ${
                statusFilter === 'EXPIRING_SOON'
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                  : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className="text-[11px] text-amber-400/80 font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {isNepali ? 'चाँडै म्याद सकिने' : 'Expiring (≤ 30d)'}
              </div>
              <div className="text-base font-bold text-amber-400 font-mono mt-0.5">
                {formatNumberByLang(stats.expiringSoon, isNepali ? 'np' : 'en')}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('EXPIRED')}
              className={`p-2.5 rounded-lg border text-left transition-all ${
                statusFilter === 'EXPIRED'
                  ? 'bg-rose-500/10 border-rose-500/40 text-rose-400'
                  : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className="text-[11px] text-rose-400/80 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {isNepali ? 'म्याद सकिएको' : 'Expired'}
              </div>
              <div className="text-base font-bold text-rose-400 font-mono mt-0.5">
                {formatNumberByLang(stats.expired, isNepali ? 'np' : 'en')}
              </div>
            </button>
          </div>

          {/* Search Toolbar */}
          <div className="p-4 border-b border-neutral-800 bg-neutral-900/50 flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder={isNepali ? 'सामानको नाम, SKU वा ब्याच नं. खोज्नुहोस्...' : 'Search product name, SKU, or batch #...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-9 pr-4 py-2 text-xs text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-amber-500/60"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <span className="text-xs text-neutral-400 font-mono">
              {formatNumberByLang(filteredBatches.length, isNepali ? 'np' : 'en')} {isNepali ? 'ब्याच' : 'batches'}
            </span>
          </div>

          {/* Batches Table */}
          <div className="flex-1 overflow-y-auto">
            {filteredBatches.length === 0 ? (
              <div className="py-16 text-center text-neutral-500">
                <Boxes className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">
                  {isNepali ? 'कुनै ब्याच फेला परेन' : 'No batches found matching filter'}
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-neutral-950/80 text-neutral-400 border-b border-neutral-800 sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                    <th className="py-2.5 px-4">{isNepali ? 'सामान' : 'Product'}</th>
                    <th className="py-2.5 px-3 font-mono">{isNepali ? 'ब्याच नं.' : 'Batch #'}</th>
                    <th className="py-2.5 px-3 font-mono">{isNepali ? 'म्याद मिति' : 'Expiry Date'}</th>
                    <th className="py-2.5 px-3 text-right font-mono">{isNepali ? 'मौज्दात' : 'Stock'}</th>
                    <th className="py-2.5 px-3 text-right font-mono">{isNepali ? 'खरिद दर' : 'Rate'}</th>
                    <th className="py-2.5 px-4 text-center">{isNepali ? 'अवस्था' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {filteredBatches.map((b) => {
                    const isExpired = b.expiry_date < todayStr;
                    const isExpiringSoon = !isExpired && b.expiry_date <= in30DaysStr;

                    // Days calculation
                    const diffMs = new Date(b.expiry_date).getTime() - new Date(todayStr).getTime();
                    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

                    return (
                      <tr key={b.id} className="hover:bg-neutral-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-neutral-200 capitalize">
                            {b.product_name}
                          </div>
                          {b.product_sku && (
                            <div className="text-[10px] text-neutral-500 font-mono">
                              SKU: {b.product_sku}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-3 font-mono font-medium text-neutral-200">
                          <span className="px-1.5 py-0.5 rounded bg-neutral-800/80 border border-neutral-700/60 text-[11px] text-amber-300">
                            {b.batch_number}
                          </span>
                        </td>

                        <td className="py-3 px-3 font-mono">
                          <div className="text-neutral-200 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                            <span>{b.expiry_date}</span>
                          </div>
                          <div className="text-[10px] text-neutral-500">
                            {isExpired
                              ? `${Math.abs(diffDays)} days ago`
                              : `${diffDays} days remaining`}
                          </div>
                        </td>

                        <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-neutral-100">
                          {formatNumberByLang(b.quantity, isNepali ? 'np' : 'en')}{' '}
                          <span className="text-[10px] font-normal text-neutral-400">
                            {b.product_unit || 'pcs'}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right font-mono tabular-nums text-neutral-300">
                          {formatCurrency(b.cost_price, currencySymbol)}
                        </td>

                        <td className="py-3 px-4 text-center">
                          {isExpired ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <AlertTriangle className="w-3 h-3" />
                              {isNepali ? 'म्याद सकियो' : 'Expired'}
                            </span>
                          ) : isExpiringSoon ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <Clock className="w-3 h-3" />
                              {isNepali ? 'चाँडै म्याद' : 'Expiring Soon'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" />
                              {isNepali ? 'सुरक्षित' : 'Active'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-neutral-800 bg-neutral-950/60 text-xs text-neutral-400">
            <div>
              {isNepali
                ? 'नोट: बिलिङ गर्दा स्वतः पहिलो म्याद सकिने ब्याच (FEFO) बाट कटौति हुन्छ।'
                : 'Note: Sales automatically deplete the earliest expiring batch (FEFO priority).'}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors font-medium"
            >
              {isNepali ? 'बन्द गर्नुहोस्' : 'Close'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
