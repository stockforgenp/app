/**
 * Table Column Definitions: Sales History
 */
import { Eye, Printer, Copy, Edit3, Trash2, RotateCcw } from 'lucide-react';
import { Column } from '../components/common/DataTable.tsx';
import { Sale } from '../types/index.ts';
import { formatCurrency, formatDateTime, capitalizeWords } from '../helpers/formatHelpers.ts';
import { ActionMenu } from '../components/common/ActionMenu.tsx';

export interface SalesHistoryColumnsOptions {
  currencySymbol: string;
  t?: (key: string, fallback?: string) => string;
  onInspectSale?: (saleId: number) => void;
  onPrintThermalBill?: (saleId: number) => void;
  onCopySaleId?: (saleId: number) => void;
  onEditSale?: (saleId: number) => void;
  onDeleteSale?: (saleId: number) => void;
  onReturnSale?: (saleId: number) => void;
  onInspect?: (sale: Sale) => void;
  onPrint?: (sale: Sale) => void;
}

export function getSalesHistoryColumns(
  options: SalesHistoryColumnsOptions
): Column<Sale>[] {
  const {
    currencySymbol,
    t = (_k, fallback = '') => fallback,
    onInspectSale,
    onPrintThermalBill,
    onCopySaleId,
    onEditSale,
    onDeleteSale,
    onReturnSale,
    onInspect,
    onPrint,
  } = options;

  const handleReturn = onReturnSale || onDeleteSale;

  return [
    {
      id: 'bill_number',
      header: t('hist_col_id', 'Sale ID'),
      sortable: true,
      accessor: (s: Sale) => (
        <div className="font-mono text-neutral-200">
          <div className="font-bold">{s.bill_number || `#${s.id}`}</div>
          {s.bill_number && (
            <div className="text-[10px] text-neutral-500 font-normal">
              #{s.id}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'status',
      header: t('hist_col_status', 'Status'),
      align: 'center',
      sortable: true,
      accessor: (s: Sale) => {
        const isReturned = s.status === 'RETURNED';
        const isPartialReturn = s.status === 'PARTIAL_RETURN';
        return isReturned ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <RotateCcw className="w-3 h-3" />
            <span>{t('status_returned', 'Returned')}</span>
          </span>
        ) : isPartialReturn ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <RotateCcw className="w-3 h-3" />
            <span>{t('status_partial_return', 'Partial Return')}</span>
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {t('status_completed', 'Completed')}
          </span>
        );
      },
    },
    {
      id: 'created_at',
      header: t('hist_col_date', 'Date & Time'),
      sortable: true,
      accessor: (s: Sale) => (
        <span className="font-mono text-neutral-400 whitespace-nowrap">
          {formatDateTime(s.created_at)}
        </span>
      ),
    },
    {
      id: 'customer_name',
      header: t('hist_col_customer', 'Customer'),
      sortable: true,
      accessor: (s: Sale) =>
        s.customer_name ? (
          <div>
            <div className="font-semibold text-neutral-200 truncate max-w-[150px] capitalize">
              {capitalizeWords(s.customer_name)}
            </div>
            <div className="text-[10px] font-mono text-neutral-400 mt-0.5 truncate max-w-[150px] flex items-center gap-1.5">
              {s.customer_phone && <span>{s.customer_phone}</span>}
              {s.customer_pan_vat && (
                <span className="text-emerald-400">PAN:{s.customer_pan_vat}</span>
              )}
            </div>
          </div>
        ) : s.customer_phone ? (
          <div className="font-mono text-[11px] text-neutral-300">
            {s.customer_phone}
          </div>
        ) : (
          <span className="text-[11px] text-neutral-500 italic">Walk-in</span>
        ),
    },
    {
      id: 'item_count',
      header: t('hist_col_items', 'Items'),
      align: 'center',
      sortable: true,
      accessor: (s: Sale) => (
        <span className="font-mono text-neutral-300">{s.item_count || 1}</span>
      ),
    },
    {
      id: 'subtotal',
      header: t('hist_col_subtotal', 'Subtotal'),
      align: 'right',
      sortable: true,
      accessor: (s: Sale) => (
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
      accessor: (s: Sale) => (
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
      accessor: (s: Sale) => (
        <span className={`font-mono font-bold tabular-nums ${s.status === 'RETURNED' ? 'text-neutral-500 line-through' : 'text-neutral-100'}`}>
          {formatCurrency(s.grand_total ?? s.total, currencySymbol)}
        </span>
      ),
    },
    {
      id: 'paid_amount',
      header: t('hist_col_paid', 'Paid'),
      align: 'right',
      sortable: true,
      sortKey: (s: Sale) =>
        s.paid_amount !== undefined && s.paid_amount !== null
          ? s.paid_amount
          : (s.grand_total ?? s.total),
      accessor: (s: Sale) => {
        const paid =
          s.paid_amount !== undefined && s.paid_amount !== null
            ? s.paid_amount
            : (s.grand_total ?? s.total);
        return (
          <span className={`font-mono tabular-nums font-medium ${s.status === 'RETURNED' ? 'text-neutral-500' : 'text-emerald-400'}`}>
            {formatCurrency(paid, currencySymbol)}
          </span>
        );
      },
    },
    {
      id: 'due_amount',
      header: t('hist_col_due', 'Due'),
      align: 'right',
      sortable: true,
      sortKey: (s: Sale) => s.due_amount ?? 0,
      accessor: (s: Sale) => {
        const due = s.due_amount ?? 0;
        return (
          <span
            className={`font-mono tabular-nums ${
              s.status === 'RETURNED'
                ? 'text-neutral-500'
                : due > 0
                ? 'text-rose-400 font-medium'
                : 'text-neutral-500'
            }`}
          >
            {formatCurrency(due, currencySymbol)}
          </span>
        );
      },
    },
    {
      id: 'payment_method',
      header: t('hist_col_payment_mode', 'Mode'),
      align: 'center',
      sortable: true,
      sortKey: (s: Sale) => s.payment_method || 'Cash',
      accessor: (s: Sale) => {
        const m = s.payment_method || 'Cash';
        const isCash = m.toLowerCase() === 'cash';
        return (
          <span
            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
              isCash
                ? 'bg-neutral-800 text-neutral-300 border-neutral-700'
                : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
            }`}
          >
            {m}
          </span>
        );
      },
    },
    {
      id: 'gross_profit',
      header: t('hist_col_profit', 'Gross Profit'),
      align: 'right',
      sortable: true,
      accessor: (s: Sale) => (
        <span className={`font-mono font-semibold tabular-nums ${s.status === 'RETURNED' ? 'text-neutral-500' : 'text-emerald-400'}`}>
          {formatCurrency(s.gross_profit ?? 0, currencySymbol)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: t('hist_col_actions', 'Details'),
      align: 'right',
      width: '80px',
      accessor: (s: Sale) => {
        const isReturned = s.status === 'RETURNED';
        return (
          <div className="flex items-center justify-end gap-2">
            <ActionMenu
              align="right"
              items={[
                onInspectSale || onInspect
                  ? {
                      label: 'Inspect Transaction',
                      icon: Eye,
                      color: 'sky',
                      action: () => (onInspectSale ? onInspectSale(s.id) : onInspect?.(s)),
                    }
                  : null,
                onEditSale && !isReturned
                  ? {
                      label: 'Edit Sale',
                      icon: Edit3,
                      color: 'amber',
                      action: () => onEditSale(s.id),
                    }
                  : null,
                onPrintThermalBill || onPrint
                  ? {
                      label: 'Print Thermal Bill',
                      icon: Printer,
                      color: 'emerald',
                      action: () => (onPrintThermalBill ? onPrintThermalBill(s.id) : onPrint?.(s)),
                    }
                  : null,
                onCopySaleId
                  ? {
                      label: 'Copy Sale ID',
                      icon: Copy,
                      color: 'indigo',
                      divider: !handleReturn || isReturned,
                      action: () => onCopySaleId(s.id),
                    }
                  : null,
                handleReturn && !isReturned
                  ? {
                      label: t('hist_return_sale', 'Return Sale (फिर्ता)'),
                      icon: RotateCcw,
                      color: 'rose',
                      divider: true,
                      action: () => handleReturn(s.id),
                    }
                  : null,
              ]}
            />
          </div>
        );
      },
    },
  ];
}
