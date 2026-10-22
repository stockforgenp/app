import { Eye, Printer, Copy, Edit3, Trash2, RotateCcw } from 'lucide-react';
import { Column } from '../components/common/DataTable.tsx';
import { Purchase } from '../types/index.ts';
import { formatCurrency, formatDateTime, capitalizeWords } from '../helpers/formatHelpers.ts';
import { ActionMenu } from '../components/common/ActionMenu.tsx';

export interface PurchaseHistoryColumnsOptions {
  currencySymbol: string;
  isNepali: boolean;
  formatNumberByLang?: (num: number) => string;
  onInspect?: (purchase: Purchase) => void;
  onInspectPurchase?: (purchase: Purchase) => void;
  onPrint?: (purchase: Purchase) => void;
  onPrintPurchase?: (purchase: Purchase) => void;
  onEditPurchase?: (purchase: Purchase) => void;
  onDeletePurchase?: (purchaseId: number) => void;
  onReturnPurchase?: (purchaseId: number) => void;
  onCopyBillNumber?: (billNumber: string) => void;
}

export function getPurchaseHistoryColumns(
  options: PurchaseHistoryColumnsOptions
): Column<Purchase>[] {
  const {
    currencySymbol,
    isNepali,
    formatNumberByLang,
    onInspect,
    onInspectPurchase,
    onPrint,
    onPrintPurchase,
    onEditPurchase,
    onDeletePurchase,
    onReturnPurchase,
    onCopyBillNumber,
  } = options;

  const handleInspect = onInspectPurchase || onInspect;
  const handlePrint = onPrintPurchase || onPrint;
  const handleReturn = onReturnPurchase || onDeletePurchase;

  return [
    {
      id: 'bill_number',
      header: isNepali ? 'खरिद बिल नं' : 'Purchase Bill #',
      accessor: (row: Purchase) => (
        <div>
          <div className="font-mono font-bold text-neutral-100 flex items-center gap-1.5">
            <span>{row.bill_number || `PO-${row.id}`}</span>
          </div>
          {row.invoice_number && (
            <div className="text-[10px] text-neutral-400 font-mono">
              Inv: {row.invoice_number}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'status',
      header: isNepali ? 'स्थिति' : 'Status',
      align: 'center',
      accessor: (row: Purchase) => {
        const isReturned = row.status === 'RETURNED';
        const isPartialReturn = row.status === 'PARTIAL_RETURN';
        return isReturned ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <RotateCcw className="w-3 h-3" />
            <span>{isNepali ? 'फिर्ता' : 'Returned'}</span>
          </span>
        ) : isPartialReturn ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <RotateCcw className="w-3 h-3" />
            <span>{isNepali ? 'आंशिक फिर्ता' : 'Partial Return'}</span>
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {isNepali ? 'सम्पन्न' : 'Completed'}
          </span>
        );
      },
    },
    {
      id: 'vendor_name',
      header: isNepali ? 'आपूर्तिकर्ता (Vendor)' : 'Supplier / Vendor',
      accessor: (row: Purchase) => (
        <div>
          <div className="font-medium text-neutral-200 capitalize">
            {row.vendor_name ? (
              capitalizeWords(row.vendor_name)
            ) : (
              <span className="text-neutral-500 italic normal-case">Self-Supplied</span>
            )}
          </div>
          {row.vendor_pan_vat && (
            <div className="text-[10px] text-neutral-400 font-mono">
              PAN: {row.vendor_pan_vat}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'created_at',
      header: isNepali ? 'मिति र समय' : 'Date & Time',
      accessor: (row: Purchase) => (
        <span className="text-neutral-400 font-mono text-xs">
          {formatDateTime(row.created_at)}
        </span>
      ),
    },
    {
      id: 'total_units',
      header: isNepali ? 'एकाइ' : 'Units',
      align: 'right',
      accessor: (row: Purchase) => (
        <span className={`font-mono ${row.status === 'RETURNED' ? 'text-neutral-500' : 'text-neutral-300'}`}>
          {formatNumberByLang
            ? formatNumberByLang(row.total_units || 0)
            : (row.total_units || 0)}
        </span>
      ),
    },
    {
      id: 'subtotal',
      header: isNepali ? 'करयोग्य रकम' : 'Taxable Amt',
      align: 'right',
      accessor: (row: Purchase) => (
        <span className="font-mono text-neutral-400">
          {formatCurrency(row.taxable_amount || row.subtotal, currencySymbol)}
        </span>
      ),
    },
    {
      id: 'vat_amount',
      header: isNepali ? '१३% भ्याट' : '13% VAT',
      align: 'right',
      accessor: (row: Purchase) => (
        <span className="font-mono text-amber-400/90 text-xs">
          {row.vat_amount && row.vat_amount > 0
            ? formatCurrency(row.vat_amount, currencySymbol)
            : '—'}
        </span>
      ),
    },
    {
      id: 'grand_total',
      header: isNepali ? 'कुल रकम' : 'Grand Total',
      align: 'right',
      accessor: (row: Purchase) => (
        <span className={`font-mono font-bold ${row.status === 'RETURNED' ? 'text-neutral-500 line-through' : 'text-neutral-100'}`}>
          {formatCurrency(row.grand_total || row.total, currencySymbol)}
        </span>
      ),
    },
    {
      id: 'paid_amount',
      header: isNepali ? 'भुक्तानी रकम' : 'Paid',
      align: 'right',
      sortable: true,
      sortKey: (row: Purchase) =>
        row.paid_amount !== undefined && row.paid_amount !== null
          ? row.paid_amount
          : (row.grand_total || row.total),
      accessor: (row: Purchase) => {
        const paid =
          row.paid_amount !== undefined && row.paid_amount !== null
            ? row.paid_amount
            : (row.grand_total || row.total);
        return (
          <span className={`font-mono font-medium ${row.status === 'RETURNED' ? 'text-neutral-500' : 'text-emerald-400'}`}>
            {formatCurrency(paid, currencySymbol)}
          </span>
        );
      },
    },
    {
      id: 'due_amount',
      header: isNepali ? 'बाँकी बक्यौता' : 'Due',
      align: 'right',
      sortable: true,
      sortKey: (row: Purchase) => row.due_amount ?? 0,
      accessor: (row: Purchase) => {
        const due = row.due_amount ?? 0;
        return (
          <span
            className={`font-mono tabular-nums ${
              row.status === 'RETURNED'
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
      header: isNepali ? 'माध्यम' : 'Mode',
      align: 'center',
      sortable: true,
      sortKey: (row: Purchase) => row.payment_method || 'Cash',
      accessor: (row: Purchase) => {
        const m = row.payment_method || 'Cash';
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
      id: 'actions',
      header: isNepali ? 'कार्य' : 'Actions',
      align: 'right',
      accessor: (row: Purchase) => {
        const isReturned = row.status === 'RETURNED';
        return (
          <ActionMenu
            items={[
              handleInspect
                ? {
                    label: isNepali ? 'विवरण हेर्नुहोस्' : 'View Details',
                    icon: Eye,
                    color: 'emerald',
                    action: () => handleInspect(row),
                  }
                : null,
              onEditPurchase && !isReturned
                ? {
                    label: isNepali ? 'खरिद सच्याउनुहोस्' : 'Edit Purchase',
                    icon: Edit3,
                    color: 'amber',
                    action: () => onEditPurchase(row),
                  }
                : null,
              handlePrint
                ? {
                    label: isNepali ? 'बिल पुनः प्रिन्ट' : 'Reprint Bill',
                    icon: Printer,
                    color: 'sky',
                    action: () => handlePrint(row),
                  }
                : null,
              onCopyBillNumber
                ? {
                    label: isNepali ? 'बिल नं प्रतिलिपि' : 'Copy Bill #',
                    icon: Copy,
                    color: 'default',
                    divider: !handleReturn || isReturned,
                    action: () => onCopyBillNumber(row.bill_number || `PO-${row.id}`),
                  }
                : null,
              handleReturn && !isReturned
                ? {
                    label: isNepali ? 'खरिद फिर्ता गर्नुहोस्' : 'Return Purchase (फिर्ता)',
                    icon: RotateCcw,
                    color: 'rose',
                    divider: true,
                    action: () => handleReturn(row.id),
                  }
                : null,
            ]}
          />
        );
      },
    },
  ];
}
