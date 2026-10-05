/**
 * Table Column Definitions: Expenses
 */
import React from 'react';
import { Edit2, Trash2, Printer, Copy } from 'lucide-react';
import { Column } from '../components/common/DataTable.tsx';
import { Expense } from '../types/index.ts';
import { formatCurrency, formatDate } from '../helpers/formatHelpers.ts';
import { ActionMenu } from '../components/common/ActionMenu.tsx';

export interface ExpenseColumnsOptions {
  currencySymbol: string;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
  onCopyReceiptRef?: (ref: string) => void;
  onPrintSlip?: (expense: Expense) => void;
}

export function getExpenseColumns(
  options: ExpenseColumnsOptions
): Column<Expense>[] {
  const { currencySymbol, onEdit, onDelete, onCopyReceiptRef, onPrintSlip } = options;

  return [
    {
      id: 'date',
      header: 'Date',
      accessor: (exp: Expense) => (
        <span className="font-mono text-neutral-300 whitespace-nowrap">
          {formatDate(exp.date)}
        </span>
      ),
      sortable: true,
      sortKey: (exp: Expense) => exp.date,
    },
    {
      id: 'category',
      header: 'Category',
      accessor: (exp: Expense) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-800 text-neutral-200 border border-neutral-700/60">
          {exp.category}
        </span>
      ),
      sortable: true,
      sortKey: (exp: Expense) => exp.category,
    },
    {
      id: 'receipt_reference',
      header: 'Receipt / Ref',
      accessor: (exp: Expense) =>
        exp.receipt_reference ? (
          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-neutral-300">
            {exp.receipt_reference}
          </span>
        ) : (
          <span className="text-neutral-600">—</span>
        ),
      sortable: true,
      sortKey: (exp: Expense) => exp.receipt_reference || '',
    },
    {
      id: 'payment_method',
      header: 'Payment',
      accessor: (exp: Expense) => (
        <span className="text-neutral-400 whitespace-nowrap">
          {exp.payment_method || 'Cash'}
        </span>
      ),
      sortable: true,
      sortKey: (exp: Expense) => exp.payment_method || 'Cash',
    },
    {
      id: 'note',
      header: 'Description / Notes',
      accessor: (exp: Expense) => (
        <div className="max-w-xs truncate text-neutral-300">
          {exp.note ? (
            <span>{exp.note}</span>
          ) : (
            <span className="text-neutral-600 italic">No notes</span>
          )}
        </div>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'right',
      accessor: (exp: Expense) => (
        <span className="font-mono font-semibold text-rose-400 tabular-nums whitespace-nowrap">
          {formatCurrency(exp.amount, currencySymbol)}
        </span>
      ),
      sortable: true,
      sortKey: (exp: Expense) => exp.amount,
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      accessor: (exp: Expense) => (
        <div className="flex items-center justify-end gap-1.5">
          <ActionMenu
            align="right"
            items={[
              {
                label: 'Edit Expense',
                icon: Edit2,
                color: 'emerald',
                action: () => onEdit(exp),
              },
              exp.receipt_reference && onCopyReceiptRef
                ? {
                    label: 'Copy Receipt Ref',
                    icon: Copy,
                    color: 'sky',
                    action: () => onCopyReceiptRef(exp.receipt_reference!),
                  }
                : null,
              onPrintSlip && exp.receipt_reference
                ? {
                    label: 'Print Voucher',
                    icon: Printer,
                    color: 'sky',
                    action: () => onPrintSlip(exp),
                  }
                : null,
              {
                label: 'Delete Expense',
                icon: Trash2,
                color: 'rose',
                isDestructive: true,
                divider: true,
                action: () => onDelete(exp),
              },
            ]}
          />
        </div>
      ),
    },
  ];
}
