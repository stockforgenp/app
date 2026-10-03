/**
 * Sales History & Transaction Audit Log View
 * Implements Section 11:
 * - Shows Sale ID, Date/time, Items count, Subtotal, Discount, Total, Gross profit
 * - Date filtering and search
 * - Modal to inspect all line items with snapshot cost, actual selling, discounts, and item profit
 */
import React, { useState, useEffect } from 'react';
import {
  Search,
  Receipt,
  Calendar,
  Eye,
  Tag,
  DollarSign,
  TrendingUp,
  User,
  Phone,
  Printer,
  Copy,
} from 'lucide-react';
import { Input } from '../common/Input.tsx';
import { DateFilterBar } from '../common/DateFilterBar.tsx';
import { DatePreset, toIsoRange } from '../../lib/utils/dateFilters.ts';
import { Sale, SaleItem } from '../../types/index.ts';
import { getSales, getSaleWithItems } from '../../lib/services/salesService.ts';
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
} from '../../lib/utils/format.ts';
import { Modal } from '../common/Modal.tsx';
import { PrintBillModal } from '../common/PrintBillModal.tsx';
import { ActionMenu } from '../common/ActionMenu.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { subscribeToDbChanges } from '../../lib/db/sqliteEngine.ts';
import { useLanguage } from '../../context/LanguageContext.tsx';

interface SalesHistoryViewProps {
  currencySymbol: string;
}

export const SalesHistoryView: React.FC<SalesHistoryViewProps> = ({ currencySymbol }) => {
  const { showToast } = useToast();
  const { t, isNepali, formatNumberByLang } = useLanguage();
  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected sale inspection modal
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<{
    sale: Sale;
    items: SaleItem[];
  } | null>(null);

  // Bill print modal state
  const [printBillSaleId, setPrintBillSaleId] = useState<number | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const loadSales = () => {
    try {
      const options: { startDate?: string; endDate?: string; search?: string } = {};
      const { startIso, endIso } = toIsoRange(startDate, endDate);
      if (startIso) {
        options.startDate = startIso;
      }
      if (endIso) {
        options.endDate = endIso;
      }
      if (search) {
        options.search = search;
      }
      setSales(getSales(options));
    } catch (e) {
      console.error('Error loading sales history:', e);
    }
  };

  useEffect(() => {
    loadSales();
    const unsubscribe = subscribeToDbChanges(loadSales);
    return unsubscribe;
  }, [startDate, endDate, search]);

  const handleOpenSale = (saleId: number) => {
    const details = getSaleWithItems(saleId);
    if (details) {
      setSelectedSaleDetail(details);
    }
  };

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-100">
          {t('hist_title', 'Sales History')}
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          {t('hist_subtitle', 'Complete immutable transaction log with historical cost price snapshots and profit calculations')}
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 bg-neutral-900 p-3.5 rounded-xl border border-neutral-800">
        <div className="w-full">
          <Input
            type="text"
            icon={Search}
            sizeVariant="sm"
            placeholder={t('hist_search_placeholder', 'Search by Sale #ID, customer name, phone, or product...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="pt-2 border-t border-neutral-800/80">
          <DateFilterBar
            preset={datePreset}
            onPresetChange={(p, start, end) => {
              setDatePreset(p);
              setStartDate(start);
              setEndDate(end);
            }}
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            hasActiveFilters={Boolean(startDate || endDate || search || datePreset !== 'all')}
            onClear={() => {
              setDatePreset('all');
              setStartDate('');
              setEndDate('');
              setSearch('');
            }}
          />
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-950 text-neutral-400 font-medium border-b border-neutral-800 select-none">
              <tr>
                <th className="py-3 px-6 font-mono">{t('hist_col_id', 'Sale ID')}</th>
                <th className="py-3 px-4">{t('hist_col_date', 'Date & Time')}</th>
                <th className="py-3 px-4">{t('hist_col_customer', 'Customer')}</th>
                <th className="py-3 px-4 text-center font-mono">{t('hist_col_items', 'Items')}</th>
                <th className="py-3 px-4 text-right font-mono">{t('hist_col_subtotal', 'Subtotal')}</th>
                <th className="py-3 px-4 text-right font-mono">{t('hist_col_discount', 'Discount')}</th>
                <th className="py-3 px-4 text-right font-mono">{t('hist_col_total', 'Net Total')}</th>
                <th className="py-3 px-4 text-right font-mono">{t('hist_col_profit', 'Gross Profit')}</th>
                <th className="py-3 px-6 text-right">{t('hist_col_actions', 'Details')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-400 text-xs">
                    <Receipt className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                    {t('hist_no_sales', 'No sales transactions found for the specified criteria.')}
                  </td>
                </tr>
              ) : (
                sales.map((s) => (
                  <tr key={s.id} className="hover:bg-neutral-800/40 transition-colors">
                    <td className="py-3 px-6 font-mono font-bold text-neutral-200">
                      #{s.id}
                    </td>

                    <td className="py-3 px-4 font-mono text-neutral-400 whitespace-nowrap">
                      {formatDateTime(s.created_at)}
                    </td>

                    <td className="py-3 px-4">
                      {s.customer_name ? (
                        <div>
                          <div className="font-semibold text-neutral-200 truncate max-w-[150px]">
                            {s.customer_name}
                          </div>
                          {s.customer_phone && (
                            <div className="text-[10px] font-mono text-neutral-400 mt-0.5 truncate max-w-[150px]">
                              {s.customer_phone}
                            </div>
                          )}
                        </div>
                      ) : s.customer_phone ? (
                        <div className="font-mono text-[11px] text-neutral-300">
                          {s.customer_phone}
                        </div>
                      ) : (
                        <span className="text-[11px] text-neutral-500 italic">Walk-in</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center font-mono text-neutral-300">
                      {s.item_count || 1}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-neutral-400 tabular-nums">
                      {formatCurrency(s.subtotal, currencySymbol)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-amber-400 tabular-nums">
                      {s.discount > 0 ? `- ${formatCurrency(s.discount, currencySymbol)}` : '—'}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-neutral-100 tabular-nums">
                      {formatCurrency(s.total, currencySymbol)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-400 tabular-nums">
                      {formatCurrency(s.gross_profit ?? 0, currencySymbol)}
                    </td>

                    <td className="py-3 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <ActionMenu
                          align="right"
                          items={[
                            {
                              label: 'Inspect Transaction',
                              icon: Eye,
                              color: 'sky',
                              action: () => handleOpenSale(s.id),
                            },
                            {
                              label: 'Print Thermal Bill',
                              icon: Printer,
                              color: 'emerald',
                              action: () => {
                                setPrintBillSaleId(s.id);
                                setIsPrintModalOpen(true);
                              },
                            },
                            {
                              label: 'Copy Sale ID',
                              icon: Copy,
                              color: 'default',
                              divider: true,
                              action: () => {
                                navigator.clipboard.writeText(`#${s.id}`);
                                showToast(`Sale #${s.id} copied to clipboard`, 'info');
                              },
                            },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Detailed Sale Inspection */}
      <Modal
        isOpen={!!selectedSaleDetail}
        onClose={() => setSelectedSaleDetail(null)}
        title={`Transaction Details: Sale #${selectedSaleDetail?.sale.id}`}
        subtitle={`Recorded on ${
          selectedSaleDetail?.sale.created_at
            ? formatDateTime(selectedSaleDetail.sale.created_at)
            : ''
        }`}
        maxWidth="2xl"
      >
        {selectedSaleDetail && (
          <div className="space-y-6">
            {/* Top Summary Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800">
                <div className="text-[11px] text-neutral-400">Gross Subtotal</div>
                <div className="text-sm font-bold font-mono text-neutral-200 mt-0.5">
                  {formatCurrency(selectedSaleDetail.sale.subtotal, currencySymbol)}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800">
                <div className="text-[11px] text-neutral-400">Total Discount</div>
                <div className="text-sm font-bold font-mono text-amber-400 mt-0.5">
                  {formatCurrency(selectedSaleDetail.sale.discount, currencySymbol)}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800">
                <div className="text-[11px] text-neutral-400">Net Revenue Paid</div>
                <div className="text-sm font-bold font-mono text-neutral-100 mt-0.5">
                  {formatCurrency(selectedSaleDetail.sale.total, currencySymbol)}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800">
                <div className="text-[11px] text-neutral-400">Transaction Profit</div>
                <div className="text-sm font-bold font-mono text-emerald-400 mt-0.5">
                  {formatCurrency(selectedSaleDetail.sale.gross_profit ?? 0, currencySymbol)}
                </div>
              </div>
            </div>

            {/* Customer Details in Modal */}
            <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-neutral-200">
                    {selectedSaleDetail.sale.customer_name || 'Walk-in Customer (Not Specified)'}
                  </div>
                  <div className="text-[11px] text-neutral-400 font-mono flex items-center gap-1.5 mt-0.5">
                    <Phone className="w-3 h-3 text-neutral-500" />
                    <span>{selectedSaleDetail.sale.customer_phone || 'No phone recorded'}</span>
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-mono text-neutral-400 px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800">
                Customer Record
              </span>
            </div>

            {/* Line Items Table with Exact Historical Snapshots */}
            <div className="border border-neutral-800 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950 text-neutral-400 font-medium border-b border-neutral-800">
                  <tr>
                    <th className="py-2.5 px-4">Product</th>
                    <th className="py-2.5 px-2 text-center font-mono">Qty</th>
                    <th className="py-2.5 px-3 text-right font-mono">Snapshot Cost</th>
                    <th className="py-2.5 px-3 text-right font-mono">Sale Price</th>
                    <th className="py-2.5 px-3 text-right font-mono">Discount</th>
                    <th className="py-2.5 px-3 text-right font-mono">Net Total</th>
                    <th className="py-2.5 px-4 text-right font-mono">Item Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {selectedSaleDetail.items.map((item) => (
                    <tr key={item.id} className="hover:bg-neutral-800/30">
                      <td className="py-3 px-4 font-semibold text-neutral-200">
                        {item.product_name}
                      </td>

                      <td className="py-3 px-2 text-center font-mono text-neutral-300">
                        {item.quantity} {item.product_unit ? <span className="text-[10px] text-neutral-400">{item.product_unit}</span> : ''}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-neutral-400">
                        {formatCurrency(item.cost_price, currencySymbol)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-neutral-300 font-medium">
                        {formatCurrency(item.selling_price, currencySymbol)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-amber-400">
                        {item.discount > 0
                          ? `- ${formatCurrency(item.discount, currencySymbol)}`
                          : '—'}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-neutral-100">
                        {formatCurrency(item.total, currencySymbol)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-400">
                        {formatCurrency(item.gross_profit ?? 0, currencySymbol)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-[11px] text-neutral-500 font-mono">
              Note: Cost price snapshot was recorded at the exact moment of sale #{selectedSaleDetail.sale.id} and remains immutable regardless of future catalog price changes.
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setPrintBillSaleId(selectedSaleDetail.sale.id);
                  setIsPrintModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Bill</span>
              </button>

              <button
                onClick={() => setSelectedSaleDetail(null)}
                className="px-4 py-2 text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Bill Printing Modal */}
      <PrintBillModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        saleId={printBillSaleId}
        currencySymbol={currencySymbol}
      />
    </div>
  );
};
