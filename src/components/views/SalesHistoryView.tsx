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
import { DateFilterBar } from '../common/DateFilterBar.tsx';
import { DataTable, Column } from '../common/DataTable.tsx';
import { DatePreset } from '../../lib/utils/dateFilters.ts';
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
      if (startDate) {
        options.startDate = `${startDate}T00:00:00.000Z`;
      }
      if (endDate) {
        options.endDate = `${endDate}T23:59:59.999Z`;
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

  const columns: Column<Sale>[] = [
    {
      id: 'bill_number',
      header: t('hist_col_id', 'Sale ID'),
      sortable: true,
      accessor: (s) => (
        <div className="font-mono text-neutral-200">
          <div className="font-bold">
            {s.bill_number || `#${s.id}`}
          </div>
          {s.bill_number && (
            <div className="text-[10px] text-neutral-500 font-normal">
              #{s.id}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'created_at',
      header: t('hist_col_date', 'Date & Time'),
      sortable: true,
      accessor: (s) => (
        <span className="font-mono text-neutral-400 whitespace-nowrap">
          {formatDateTime(s.created_at)}
        </span>
      ),
    },
    {
      id: 'customer_name',
      header: t('hist_col_customer', 'Customer'),
      sortable: true,
      accessor: (s) => (
        s.customer_name ? (
          <div>
            <div className="font-semibold text-neutral-200 truncate max-w-[150px]">
              {s.customer_name}
            </div>
            <div className="text-[10px] font-mono text-neutral-400 mt-0.5 truncate max-w-[150px] flex items-center gap-1.5">
              {s.customer_phone && <span>{s.customer_phone}</span>}
              {s.customer_pan_vat && <span className="text-emerald-400">PAN:{s.customer_pan_vat}</span>}
            </div>
          </div>
        ) : s.customer_phone ? (
          <div className="font-mono text-[11px] text-neutral-300">
            {s.customer_phone}
          </div>
        ) : (
          <span className="text-[11px] text-neutral-500 italic">Walk-in</span>
        )
      ),
    },
    {
      id: 'item_count',
      header: t('hist_col_items', 'Items'),
      align: 'center',
      sortable: true,
      accessor: (s) => (
        <span className="font-mono text-neutral-300">{s.item_count || 1}</span>
      ),
    },
    {
      id: 'subtotal',
      header: t('hist_col_subtotal', 'Subtotal'),
      align: 'right',
      sortable: true,
      accessor: (s) => (
        <span className="font-mono text-neutral-400 tabular-nums">
          {formatCurrency(s.subtotal, currencySymbol)}
        </span>
      ),
    },
    {
      id: 'discount',
      header: t('hist_col_discount', 'Discount'),
      align: 'right',
      sortable: true,
      accessor: (s) => (
        <span className="font-mono text-amber-400 tabular-nums">
          {s.discount > 0 ? `- ${formatCurrency(s.discount, currencySymbol)}` : '—'}
        </span>
      ),
    },
    {
      id: 'total',
      header: t('hist_col_total', 'Net Total'),
      align: 'right',
      sortable: true,
      accessor: (s) => (
        <span className="font-mono font-bold text-neutral-100 tabular-nums">
          {formatCurrency(s.total, currencySymbol)}
        </span>
      ),
    },
    {
      id: 'gross_profit',
      header: t('hist_col_profit', 'Gross Profit'),
      align: 'right',
      sortable: true,
      accessor: (s) => (
        <span className="font-mono font-semibold text-emerald-400 tabular-nums">
          {formatCurrency(s.gross_profit ?? 0, currencySymbol)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: t('hist_col_actions', 'Details'),
      align: 'right',
      width: '80px',
      accessor: (s) => (
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
      ),
    },
  ];

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

      {/* Shared DataTable with Search, Date Filter, and Pagination */}
      <DataTable<Sale>
        data={sales}
        columns={columns}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('hist_search_placeholder', 'Search by Sale #ID, customer name, phone, or product...')}
        dateFilterConfig={{
          preset: datePreset,
          onPresetChange: (p, start, end) => {
            setDatePreset(p);
            setStartDate(start);
            setEndDate(end);
          },
          startDate,
          endDate,
          onStartDateChange: setStartDate,
          onEndDateChange: setEndDate,
          hasActiveFilters: Boolean(startDate || endDate || search || datePreset !== 'all'),
          onClear: () => {
            setDatePreset('all');
            setStartDate('');
            setEndDate('');
            setSearch('');
          },
        }}
        emptyIcon={Receipt}
        emptyTitle={t('hist_no_sales', 'No sales transactions found for the specified criteria.')}
        enablePagination={true}
        pageSize={15}
        pageSizeOptions={[10, 15, 25, 50, 100]}
      />

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
                  <div className="text-[11px] text-neutral-400 font-mono flex items-center flex-wrap gap-2 mt-0.5">
                    {selectedSaleDetail.sale.customer_phone ? (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-neutral-500" />
                        <span>{selectedSaleDetail.sale.customer_phone}</span>
                      </span>
                    ) : (
                      <span>No phone recorded</span>
                    )}
                    {selectedSaleDetail.sale.customer_pan_vat && (
                      <span className="text-emerald-400">
                        [PAN: {selectedSaleDetail.sale.customer_pan_vat}]
                      </span>
                    )}
                    {selectedSaleDetail.sale.customer_address && (
                      <span className="text-neutral-400 font-sans">
                        · {selectedSaleDetail.sale.customer_address}
                      </span>
                    )}
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
