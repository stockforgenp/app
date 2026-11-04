/**
 * Professional Printable Itemized Date-Wise Ledger Report Modal
 * Provides an A4 print-optimized document preview and window.print() trigger
 * for date-wise grouped sales or purchase statements with full line-item details.
 */
import React, { useRef, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Printer, X, Receipt, Truck, Calendar, Percent } from 'lucide-react';
import { ItemizedSaleRow, ItemizedPurchaseRow, AppSettings } from '../../types/index.ts';
import { getSettings } from '../../lib/services/settingsService.ts';
import {
  formatCurrency,
  formatDateAD,
  formatDateBS,
  formatDateTime,
  formatNumberByLang,
  capitalizeWords,
} from '../../lib/utils/format.ts';
import { useLanguage } from '../../context/LanguageContext.tsx';

export interface PrintItemizedLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'sales' | 'purchases';
  data: (ItemizedSaleRow | ItemizedPurchaseRow)[];
  currencySymbol: string;
  filters?: {
    startDate?: string;
    endDate?: string;
    search?: string;
    datePreset?: string;
  };
  partyInfo?: {
    name: string;
    phone?: string | null;
    panVat?: string | null;
    address?: string | null;
    email?: string | null;
    partyType?: 'Customer' | 'Vendor';
  };
}

interface GroupedBill {
  billId: number;
  billNumber: string | null;
  invoiceNumber?: string | null;
  createdAt: string;
  partyName: string;
  partyPhone: string | null;
  partyPanVat: string | null;
  paymentMethod: string;
  status: string;
  subtotal: number;
  discount: number;
  vatAmount: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  notes?: string | null;
  items: (ItemizedSaleRow | ItemizedPurchaseRow)[];
}

interface DateGroup {
  dateKey: string;
  sampleCreatedAt: string;
  bills: GroupedBill[];
  dayTotal: number;
  dayPaid: number;
  dayDue: number;
  dayProfit: number;
  dayUnits: number;
  dayItemsCount: number;
}

export const PrintItemizedLedgerModal: React.FC<PrintItemizedLedgerModalProps> = ({
  isOpen,
  onClose,
  type,
  data,
  currencySymbol,
  filters,
  partyInfo,
}) => {
  const { isNepali } = useLanguage();
  const settings: AppSettings = getSettings();
  const reportRef = useRef<HTMLDivElement>(null);

  const [includeMargin, setIncludeMargin] = useState(false);
  const [pageMargin, setPageMargin] = useState<'standard' | 'none'>('standard');

  const storeName = settings.store_name || 'StockForge Retail';
  const storeAddress = settings.store_address;
  const storePhone = settings.store_phone;
  const storeEmail = settings.store_email;

  // Group data by date, then by bill
  const dateGroups: DateGroup[] = useMemo(() => {
    const dateMap = new Map<
      string,
      { sampleCreatedAt: string; billMap: Map<number, GroupedBill> }
    >();

    for (const row of data) {
      const rawDate = row.created_at || '';
      const dateKey = rawDate ? rawDate.split('T')[0].split(' ')[0] : 'Unknown Date';

      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { sampleCreatedAt: rawDate, billMap: new Map() });
      }
      const { billMap } = dateMap.get(dateKey)!;

      const billId =
        type === 'sales'
          ? (row as ItemizedSaleRow).sale_id
          : (row as ItemizedPurchaseRow).purchase_id;

      if (!billMap.has(billId)) {
        if (type === 'sales') {
          const sr = row as ItemizedSaleRow;
          billMap.set(billId, {
            billId,
            billNumber: sr.bill_number,
            createdAt: sr.created_at,
            partyName: sr.customer_name || (isNepali ? 'खुद्रा ग्राहक' : 'Walk-in Customer'),
            partyPhone: sr.customer_phone,
            partyPanVat: sr.customer_pan_vat,
            paymentMethod: sr.payment_method || 'Cash',
            status: sr.sale_status || 'COMPLETED',
            subtotal: sr.sale_subtotal || 0,
            discount: sr.sale_discount || 0,
            vatAmount: sr.sale_vat_amount || 0,
            grandTotal: sr.sale_grand_total || 0,
            paidAmount: sr.sale_paid_amount || 0,
            dueAmount: sr.sale_due_amount || 0,
            items: [],
          });
        } else {
          const pr = row as ItemizedPurchaseRow;
          billMap.set(billId, {
            billId,
            billNumber: pr.bill_number,
            invoiceNumber: pr.invoice_number,
            createdAt: pr.created_at,
            partyName: pr.vendor_name || (isNepali ? 'अज्ञात आपूर्तिकर्ता' : 'Unknown Supplier'),
            partyPhone: pr.vendor_phone,
            partyPanVat: pr.vendor_pan_vat,
            paymentMethod: pr.payment_method || 'Cash',
            status: pr.purchase_status || 'COMPLETED',
            subtotal: pr.purchase_subtotal || 0,
            discount: pr.purchase_discount || 0,
            vatAmount: pr.purchase_vat_amount || 0,
            grandTotal: pr.purchase_grand_total || 0,
            paidAmount: pr.purchase_paid_amount || 0,
            dueAmount: pr.purchase_due_amount || 0,
            notes: pr.notes,
            items: [],
          });
        }
      }

      billMap.get(billId)!.items.push(row);
    }

    const sortedDates = Array.from(dateMap.keys()).sort((a, b) => b.localeCompare(a));

    return sortedDates.map((dKey) => {
      const { sampleCreatedAt, billMap } = dateMap.get(dKey)!;
      const bills = Array.from(billMap.values()).sort((a, b) => b.billId - a.billId);

      let dayTotal = 0;
      let dayPaid = 0;
      let dayDue = 0;
      let dayProfit = 0;
      let dayUnits = 0;
      let dayItemsCount = 0;

      for (const b of bills) {
        if (b.status === 'RETURNED') continue;
        dayTotal += b.grandTotal;
        dayPaid += b.paidAmount;
        dayDue += b.dueAmount;
        for (const it of b.items) {
          dayItemsCount += 1;
          dayUnits += it.quantity;
          if (type === 'sales') {
            dayProfit += (it as ItemizedSaleRow).gross_profit || 0;
          }
        }
      }

      return {
        dateKey: dKey,
        sampleCreatedAt,
        bills,
        dayTotal,
        dayPaid,
        dayDue,
        dayProfit,
        dayUnits,
        dayItemsCount,
      };
    });
  }, [data, type, isNepali]);

  // Overall totals across all active records
  const overallTotals = useMemo(() => {
    let totalBills = 0;
    let totalItems = 0;
    let totalUnits = 0;
    let grandTotal = 0;
    let totalPaid = 0;
    let totalDue = 0;
    let totalProfit = 0;

    for (const g of dateGroups) {
      totalBills += g.bills.filter((b) => b.status !== 'RETURNED').length;
      totalItems += g.dayItemsCount;
      totalUnits += g.dayUnits;
      grandTotal += g.dayTotal;
      totalPaid += g.dayPaid;
      totalDue += g.dayDue;
      totalProfit += g.dayProfit;
    }

    return {
      totalBills,
      totalItems,
      totalUnits,
      grandTotal,
      totalPaid,
      totalDue,
      totalProfit,
    };
  }, [dateGroups]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="print-itemized-ledger-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Modal Top Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/90 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                  {type === 'sales' ? <Receipt className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-neutral-100">
                    {type === 'sales'
                      ? isNepali
                        ? 'मिति अनुसार वस्तुगत बिक्री लेजर प्रिन्ट'
                        : 'Itemized Sales Statement & Ledger Preview'
                      : isNepali
                      ? 'मिति अनुसार वस्तुगत खरिद लेजर प्रिन्ट'
                      : 'Itemized Purchase Statement & Ledger Preview'}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    {dateGroups.length} {isNepali ? 'मिति समूह' : 'Date Groups'} •{' '}
                    {overallTotals.totalBills} {isNepali ? 'सम्पन्न बिलहरू' : 'Completed Bills'} •{' '}
                    {overallTotals.totalUnits} {isNepali ? 'एकाइहरू' : 'Units'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-end">
                {type === 'sales' && (
                  <button
                    type="button"
                    onClick={() => setIncludeMargin((prev) => !prev)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                      includeMargin
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold'
                        : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200 border-neutral-700'
                    }`}
                    title={
                      includeMargin
                        ? isNepali
                          ? 'मार्जिन (नाफा) बिलमा छापिनेछ'
                          : 'Profit margin will be printed on statement'
                        : isNepali
                          ? 'मार्जिन (नाफा) हटाइएको छ (ग्राहक प्रति)'
                          : 'Profit margin excluded (Customer Copy)'
                    }
                  >
                    <Percent className="w-3.5 h-3.5" />
                    <span>
                      {isNepali
                        ? includeMargin
                          ? 'मार्जिन: समावेश'
                          : 'मार्जिन: हटाइयो'
                        : includeMargin
                          ? 'Margin: Included'
                          : 'Margin: Excluded'}
                    </span>
                    {includeMargin && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 ml-0.5 animate-pulse" />
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setPageMargin((prev) => (prev === 'standard' ? 'none' : 'standard'))
                  }
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                    pageMargin === 'none'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-semibold'
                      : 'bg-neutral-800 text-neutral-300 hover:text-white border-neutral-700'
                  }`}
                  title={
                    pageMargin === 'none'
                      ? isNepali
                        ? '०mm कागज मार्जिन (थर्मल प्रिन्टरका लागि)'
                        : '0mm edge-to-edge paper margin'
                      : isNepali
                        ? '६mm सामान्य कागज मार्जिन'
                        : 'Standard 6mm paper margin'
                  }
                >
                  <span>
                    {pageMargin === 'none'
                      ? isNepali
                        ? 'कागज: ०mm'
                        : 'Paper: 0mm'
                      : isNepali
                        ? 'कागज: ६mm'
                        : 'Paper: 6mm'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isNepali ? 'प्रिन्ट गर्नुहोस्' : 'Print Statement'}</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Printable Document Preview Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-neutral-950/70 flex justify-center items-start">
              <div
                id="printable-report"
                ref={reportRef}
                className="w-full max-w-4xl bg-white text-gray-900 shadow-xl p-8 rounded-xl font-sans text-xs"
                style={{ color: '#111827' }}
              >
                {pageMargin === 'none' && (
                  <style>{`
                    @media print {
                      @page {
                        margin: 0mm !important;
                        size: auto;
                      }
                      #printable-report,
                      .printable-area {
                        margin: 0 !important;
                        padding: 4mm !important;
                      }
                    }
                  `}</style>
                )}

                {/* Store Header */}
                <div className="border-b-2 border-gray-900 pb-4 mb-4 flex justify-between items-start">
                  <div>
                    <h1 className="text-xl font-bold uppercase tracking-tight text-gray-900">
                      {storeName}
                    </h1>
                    {storeAddress && (
                      <p className="text-gray-600 text-xs mt-0.5 whitespace-pre-line">
                        {storeAddress}
                      </p>
                    )}
                    {(storePhone || storeEmail) && (
                      <p className="text-gray-500 text-[11px] mt-0.5">
                        {storePhone ? `Phone: ${storePhone}` : ''}
                        {storePhone && storeEmail ? ' | ' : ''}
                        {storeEmail ? `Email: ${storeEmail}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-3 py-1 bg-gray-900 text-white font-bold text-xs uppercase tracking-wider rounded">
                      {type === 'sales' ? 'Sales Itemized Ledger' : 'Purchase Itemized Ledger'}
                    </span>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Printed: {formatDateTime(new Date().toISOString())}
                    </p>
                  </div>
                </div>

                {/* Optional Customer / Vendor Specific Header */}
                {partyInfo && (
                  <div className="bg-gray-100 border border-gray-300 rounded p-3 mb-4 flex justify-between items-center text-xs">
                    <div>
                      <span className="text-gray-500 font-semibold uppercase text-[10px] block">
                        {partyInfo.partyType || (type === 'sales' ? 'Customer' : 'Vendor')}
                      </span>
                      <h2 className="text-sm font-bold text-gray-900">{partyInfo.name}</h2>
                      {partyInfo.address && (
                        <p className="text-gray-600 text-[11px] mt-0.5">{partyInfo.address}</p>
                      )}
                    </div>
                    <div className="text-right text-[11px] text-gray-700 font-mono space-y-0.5">
                      {partyInfo.phone && <p>Phone: {partyInfo.phone}</p>}
                      {partyInfo.panVat && <p>PAN / VAT: {partyInfo.panVat}</p>}
                      {partyInfo.email && <p>Email: {partyInfo.email}</p>}
                    </div>
                  </div>
                )}

                {/* Filter / Period Info */}
                <div className="bg-gray-50 border border-gray-200 rounded p-3 mb-5 flex flex-wrap justify-between items-center text-xs">
                  <div>
                    <span className="font-semibold text-gray-700">Period: </span>
                    <span className="text-gray-900">
                      {filters?.startDate && filters?.endDate
                        ? `${formatDateAD(filters.startDate)} to ${formatDateAD(filters.endDate)}`
                        : filters?.datePreset
                        ? `Preset: ${capitalizeWords(filters.datePreset)}`
                        : 'All Historical Transactions'}
                    </span>
                    {filters?.search && (
                      <span className="ml-3 text-gray-600 font-mono">
                        Query: &quot;{filters.search}&quot;
                      </span>
                    )}
                  </div>
                  <div className="text-gray-600 text-[11px]">
                    Total Date Groups: <strong>{dateGroups.length}</strong> | Total Bills:{' '}
                    <strong>{overallTotals.totalBills}</strong>
                  </div>
                </div>

                {/* KPI Summary Cards */}
                <div className="grid grid-cols-4 gap-3 mb-6">
                  <div className="border border-gray-300 rounded p-2.5 bg-gray-50/50">
                    <div className="text-[10px] uppercase text-gray-500 font-semibold">
                      Total Inflow / Bills
                    </div>
                    <div className="text-sm font-bold text-gray-900 font-mono mt-0.5">
                      {formatNumberByLang(overallTotals.totalBills)} Bills
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {formatNumberByLang(overallTotals.totalUnits)} total units
                    </div>
                  </div>

                  <div className="border border-gray-300 rounded p-2.5 bg-gray-50/50">
                    <div className="text-[10px] uppercase text-gray-500 font-semibold">
                      {type === 'sales' ? 'Total Revenue' : 'Total Spend'}
                    </div>
                    <div className="text-sm font-bold text-gray-900 font-mono mt-0.5">
                      {formatCurrency(overallTotals.grandTotal, currencySymbol)}
                    </div>
                  </div>

                  <div className="border border-gray-300 rounded p-2.5 bg-gray-50/50">
                    <div className="text-[10px] uppercase text-gray-500 font-semibold">
                      Total Paid Amount
                    </div>
                    <div className="text-sm font-bold text-emerald-700 font-mono mt-0.5">
                      {formatCurrency(overallTotals.totalPaid, currencySymbol)}
                    </div>
                  </div>

                  <div className="border border-gray-300 rounded p-2.5 bg-gray-50/50">
                    <div className="text-[10px] uppercase text-gray-500 font-semibold">
                      {type === 'sales'
                        ? includeMargin
                          ? (isNepali ? 'कुल नाफा' : 'Gross Margin')
                          : (isNepali ? 'कुल बाँकी बक्यौता' : 'Total Outstanding Due')
                        : (isNepali ? 'कुल तिर्न बाँकी' : 'Total Due Balance')}
                    </div>
                    <div className="text-sm font-bold text-gray-900 font-mono mt-0.5">
                      {type === 'sales'
                        ? includeMargin
                          ? formatCurrency(overallTotals.totalProfit, currencySymbol)
                          : formatCurrency(overallTotals.totalDue, currencySymbol)
                        : formatCurrency(overallTotals.totalDue, currencySymbol)}
                    </div>
                  </div>
                </div>

                {/* Date-Wise Grouped Transactions */}
                <div className="space-y-6">
                  {dateGroups.map((group) => {
                    const formattedAD = formatDateAD(group.dateKey);
                    const formattedBS = formatDateBS(group.dateKey);

                    return (
                      <div
                        key={group.dateKey}
                        className="border border-gray-300 rounded-lg overflow-hidden page-break-inside-avoid"
                      >
                        {/* Date Header */}
                        <div className="bg-gray-100 border-b border-gray-300 px-4 py-2 flex justify-between items-center font-semibold text-gray-800 text-xs">
                          <div>
                            <span className="font-bold text-gray-900">{formattedAD}</span>
                            <span className="text-gray-600 ml-2 font-normal">({formattedBS})</span>
                            <span className="ml-3 text-[11px] text-gray-500">
                              [{group.bills.length} bills, {group.dayUnits} units]
                            </span>
                          </div>
                          <div className="font-mono text-gray-900 font-bold">
                            Day Total: {formatCurrency(group.dayTotal, currencySymbol)}
                            {group.dayDue > 0 && (
                              <span className="text-amber-700 ml-3 font-normal">
                                (Due: {formatCurrency(group.dayDue, currencySymbol)})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Bills under this date */}
                        <div className="divide-y divide-gray-200">
                          {group.bills.map((bill) => {
                            const isReturned = bill.status === 'RETURNED';

                            return (
                              <div
                                key={bill.billId}
                                className={`p-3 space-y-2 ${
                                  isReturned ? 'bg-red-50/50' : 'bg-white'
                                }`}
                              >
                                {/* Bill Summary Line */}
                                <div className="flex justify-between items-center text-[11px] border-b border-gray-100 pb-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold font-mono text-gray-900">
                                      {bill.billNumber || `#${bill.billId}`}
                                    </span>
                                    {type === 'purchases' && bill.invoiceNumber && (
                                      <span className="text-gray-600 font-mono">
                                        (Inv: {bill.invoiceNumber})
                                      </span>
                                    )}
                                    <span className="text-gray-700 font-semibold">
                                      {capitalizeWords(bill.partyName)}
                                    </span>
                                    {bill.partyPhone && (
                                      <span className="text-gray-500 font-mono text-[10px]">
                                        {bill.partyPhone}
                                      </span>
                                    )}
                                    <span className="text-gray-500 text-[10px]">
                                      [{bill.paymentMethod}]
                                    </span>
                                    {isReturned && (
                                      <span className="text-red-700 font-bold uppercase text-[9px] px-1 bg-red-100 rounded">
                                        Returned
                                      </span>
                                    )}
                                  </div>
                                  <div className="font-mono text-gray-900">
                                    <span>
                                      Total:{' '}
                                      <strong>
                                        {formatCurrency(bill.grandTotal, currencySymbol)}
                                      </strong>
                                    </span>
                                    {bill.dueAmount > 0 && (
                                      <span className="ml-2 text-amber-700">
                                        (Due: {formatCurrency(bill.dueAmount, currencySymbol)})
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Items Table */}
                                <table className="w-full text-left text-[11px]">
                                  <thead>
                                    <tr className="border-b border-gray-200 text-gray-500 text-[10px] uppercase">
                                      <th className="py-1 w-6 text-center">#</th>
                                      <th className="py-1">Product Description</th>
                                      <th className="py-1 text-center">Unit</th>
                                      <th className="py-1 text-right">Qty</th>
                                      <th className="py-1 text-right">Rate</th>
                                      <th className="py-1 text-right">Disc</th>
                                      <th className="py-1 text-right">Total</th>
                                      {type === 'sales' && includeMargin ? (
                                        <th className="py-1 text-right">{isNepali ? 'नाफा' : 'Margin'}</th>
                                      ) : type === 'purchases' ? (
                                        <th className="py-1 text-center">{isNepali ? 'ब्याच' : 'Batch'}</th>
                                      ) : null}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {bill.items.map((it, idx) => {
                                      const rate =
                                        type === 'sales'
                                          ? (it as ItemizedSaleRow).selling_price
                                          : (it as ItemizedPurchaseRow).cost_price;

                                      const profit =
                                        type === 'sales'
                                          ? (it as ItemizedSaleRow).gross_profit
                                          : undefined;

                                      const batch =
                                        type === 'purchases'
                                          ? (it as ItemizedPurchaseRow).batch_number
                                          : null;

                                      return (
                                        <tr key={it.item_id}>
                                          <td className="py-1 text-center text-gray-400 font-mono">
                                            {idx + 1}
                                          </td>
                                          <td className="py-1 font-medium text-gray-800">
                                            {it.product_name}
                                            {it.product_sku && (
                                              <span className="text-gray-400 font-mono text-[10px] ml-1">
                                                [{it.product_sku}]
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-1 text-center text-gray-600">
                                            {it.packaging_name || it.product_unit}
                                          </td>
                                          <td className="py-1 text-right font-mono font-bold text-gray-900">
                                            {it.quantity}
                                          </td>
                                          <td className="py-1 text-right font-mono text-gray-600">
                                            {formatCurrency(rate, currencySymbol)}
                                          </td>
                                          <td className="py-1 text-right font-mono text-gray-500">
                                            {it.item_discount > 0
                                              ? `-${formatCurrency(
                                                  it.item_discount,
                                                  currencySymbol
                                                )}`
                                              : '-'}
                                          </td>
                                          <td className="py-1 text-right font-mono font-bold text-gray-900">
                                            {formatCurrency(it.item_total, currencySymbol)}
                                          </td>
                                          {type === 'sales' && includeMargin ? (
                                            <td className="py-1 text-right font-mono text-gray-600">
                                              {profit !== undefined
                                                ? formatCurrency(profit, currencySymbol)
                                                : '-'}
                                            </td>
                                          ) : type === 'purchases' ? (
                                            <td className="py-1 text-center font-mono text-gray-500 text-[10px]">
                                              {batch ? `#${batch}` : '-'}
                                            </td>
                                          ) : null}
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Report Footer / Signature */}
                <div className="mt-8 pt-4 border-t border-gray-300 flex justify-between items-end text-xs text-gray-500">
                  <div>
                    <p>StockForge ERP Inventory & POS Management</p>
                    <p className="text-[10px]">
                      This is an electronically generated statement.
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="w-36 border-b border-gray-400 pb-1 mb-1"></div>
                    <p className="font-semibold text-gray-700">Authorized Signature</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-between px-6 py-3 bg-neutral-900 border-t border-neutral-800 shrink-0">
              <span className="text-xs text-neutral-400">
                {isNepali
                  ? 'कागजातलाई A4 वा लेटर आकारमा सिधै प्रिन्ट गर्न सकिन्छ।'
                  : 'Ready to print in A4 or Letter format.'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 text-xs text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer"
                >
                  {isNepali ? 'बन्द गर्नुहोस्' : 'Close'}
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isNepali ? 'प्रिन्ट गर्नुहोस्' : 'Print Statement'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

