import { Eye, Printer, Copy, Edit3 } from 'lucide-react';
import { Column } from '../components/common/DataTable.tsx';
import { Purchase } from '../types/index.ts';
import { formatCurrency, formatDateTime } from '../helpers/formatHelpers.ts';
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
    onCopyBillNumber,
  } = options;

  const handleInspect = onInspectPurchase || onInspect;
  const handlePrint = onPrintPurchase || onPrint;

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
      id: 'vendor_name',
      header: isNepali ? 'आपूर्तिकर्ता (Vendor)' : 'Supplier / Vendor',
      accessor: (row: Purchase) => (
        <div>
          <div className="font-medium text-neutral-200">
            {row.vendor_name || (
              <span className="text-neutral-500 italic">Self-Supplied</span>
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
        <span className="font-mono text-neutral-300">
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
        <span className="font-mono font-bold text-emerald-400">
          {formatCurrency(row.grand_total || row.total, currencySymbol)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: isNepali ? 'कार्य' : 'Actions',
      align: 'right',
      accessor: (row: Purchase) => (
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
            onEditPurchase
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
                  action: () => onCopyBillNumber(row.bill_number || `PO-${row.id}`),
                }
              : null,
          ]}
        />
      ),
    },
  ];
}
