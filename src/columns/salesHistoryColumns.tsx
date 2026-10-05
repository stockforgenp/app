/**
 * Table Column Definitions: Sales History
 */
import React from 'react';
import { Eye, Printer, Copy } from 'lucide-react';
import { Column } from '../components/common/DataTable.tsx';
import { Sale } from '../types/index.ts';
import { formatCurrency, formatDateTime } from '../helpers/formatHelpers.ts';
import { ActionMenu } from '../components/common/ActionMenu.tsx';

export interface SalesHistoryColumnsOptions {
  currencySymbol: string;
  t?: (key: string, fallback?: string) => string;
  onInspectSale?: (saleId: number) => void;
  onPrintThermalBill?: (saleId: number) => void;
  onCopySaleId?: (saleId: number) => void;
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
    onInspect,
    onPrint,
  } = options;

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
            <div className="font-semibold text-neutral-200 truncate max-w-[150px]">
              {s.customer_name}
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
      accessor: (s: Sale) => (
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
      accessor: (s: Sale) => (
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
                    divider: true,
                    action: () => onCopySaleId(s.id),
                  }
                : null,
            ]}
          />
        </div>
      ),
    },
  ];
}
