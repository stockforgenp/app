/**
 * Reusable Itemized Date-Wise Ledger Component for Sales and Purchases.
 * Groups transactions by date (newest first), shows day totals, bill metadata,
 * and individual line item tables with quantities, pricing, discounts, and margins.
 */
import React, { useState, useMemo } from "react";
import {
  Calendar,
  Receipt,
  Truck,
  User,
  CreditCard,
  Printer,
  Eye,
  Edit3,
  Trash2,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Clock,
  Building2,
  Tag,
  Percent,
} from "lucide-react";
import { ItemizedSaleRow, ItemizedPurchaseRow } from "../../types/index.ts";
import {
  formatCurrency,
  formatDateAD,
  formatDateBS,
  capitalizeWords,
} from "../../lib/utils/format.ts";
import { useLanguage } from "../../context/LanguageContext.tsx";
import { getCalendarSystem } from "../../lib/services/settingsService.ts";

export interface ItemizedDateLedgerProps {
  type: "sales" | "purchases";
  data: (ItemizedSaleRow | ItemizedPurchaseRow)[];
  currencySymbol: string;
  onInspectBill?: (billId: number) => void;
  onPrintBill?: (billId: number) => void;
  onEditBill?: (billId: number) => void;
  onReturnBill?: (billId: number) => void;
  onHardDeleteBill?: (billId: number) => void;
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

export const ItemizedDateLedger: React.FC<ItemizedDateLedgerProps> = ({
  type,
  data,
  currencySymbol,
  onInspectBill,
  onPrintBill,
  onEditBill,
  onReturnBill,
  onHardDeleteBill,
}) => {
  const { isNepali, formatNumberByLang } = useLanguage();
  const calendarSystem = getCalendarSystem();

  // Collapsed dates state (set of collapsed date keys)
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
  const [showMargin, setShowMargin] = useState(true);

  // Group data by date, then by bill
  const dateGroups: DateGroup[] = useMemo(() => {
    const dateMap = new Map<
      string,
      { sampleCreatedAt: string; billMap: Map<number, GroupedBill> }
    >();

    for (const row of data) {
      const rawDate = row.created_at || "";
      const dateKey = rawDate
        ? rawDate.split("T")[0].split(" ")[0]
        : "Unknown Date";

      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { sampleCreatedAt: rawDate, billMap: new Map() });
      }
      const { billMap } = dateMap.get(dateKey)!;

      const billId =
        type === "sales"
          ? (row as ItemizedSaleRow).sale_id
          : (row as ItemizedPurchaseRow).purchase_id;

      if (!billMap.has(billId)) {
        if (type === "sales") {
          const sr = row as ItemizedSaleRow;
          billMap.set(billId, {
            billId,
            billNumber: sr.bill_number,
            createdAt: sr.created_at,
            partyName:
              sr.customer_name ||
              (isNepali ? "खुद्रा ग्राहक" : "Walk-in Customer"),
            partyPhone: sr.customer_phone,
            partyPanVat: sr.customer_pan_vat,
            paymentMethod: sr.payment_method || "Cash",
            status: sr.sale_status || "COMPLETED",
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
            partyName:
              pr.vendor_name ||
              (isNepali ? "अज्ञात आपूर्तिकर्ता" : "Unknown Supplier"),
            partyPhone: pr.vendor_phone,
            partyPanVat: pr.vendor_pan_vat,
            paymentMethod: pr.payment_method || "Cash",
            status: pr.purchase_status || "COMPLETED",
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

    // Sort dates in descending order (latest first)
    const sortedDates = Array.from(dateMap.keys()).sort((a, b) =>
      b.localeCompare(a),
    );

    return sortedDates.map((dKey) => {
      const { sampleCreatedAt, billMap } = dateMap.get(dKey)!;
      // Sort bills within the day by ID descending
      const bills = Array.from(billMap.values()).sort(
        (a, b) => b.billId - a.billId,
      );

      let dayTotal = 0;
      let dayPaid = 0;
      let dayDue = 0;
      let dayProfit = 0;
      let dayUnits = 0;
      let dayItemsCount = 0;

      for (const b of bills) {
        if (b.status === "RETURNED") continue;
        dayTotal += b.grandTotal;
        dayPaid += b.paidAmount;
        dayDue += b.dueAmount;
        for (const it of b.items) {
          dayItemsCount += 1;
          dayUnits += it.quantity;
          if (type === "sales") {
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

  const toggleDateCollapse = (dateKey: string) => {
    setCollapsedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    setCollapsedDates(new Set());
  };

  const handleCollapseAll = () => {
    setCollapsedDates(new Set(dateGroups.map((g) => g.dateKey)));
  };

  if (dateGroups.length === 0) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-neutral-800 text-neutral-400 flex items-center justify-center mx-auto">
          {type === "sales" ? (
            <Receipt className="w-6 h-6" />
          ) : (
            <Truck className="w-6 h-6" />
          )}
        </div>
        <h4 className="text-base font-semibold text-neutral-200">
          {isNepali ? "कुनै कारोबार भेटिएन" : "No transactions found"}
        </h4>
        <p className="text-xs text-neutral-400 max-w-md mx-auto">
          {isNepali
            ? "तपाईंले छान्नुभएको मिति वा खोज फिल्टर अनुसार कुनै वस्तुगत कारोबार उपलब्ध छैन।"
            : "No itemized transaction records match the specified filters or date criteria."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Top Ledger Toolbar info & Collapse / Expand */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-neutral-400">
        <div className="flex items-center gap-2">
          <span className="font-medium text-neutral-300">
            {isNepali ? "मिति समूह:" : "Date Groups:"}{" "}
            {formatNumberByLang(dateGroups.length)}
          </span>
          <span className="text-neutral-600">•</span>
          <span>
            {type === "sales"
              ? isNepali
                ? "कुल वस्तुगत बिक्री रेकर्ड"
                : "Total Itemized Sales"
              : isNepali
                ? "कुल वस्तुगत खरिद रेकर्ड"
                : "Total Itemized Purchases"}
            :{" "}
            <strong className="text-neutral-200">
              {formatNumberByLang(data.length)}
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {type === "sales" && (
            <button
              type="button"
              onClick={() => setShowMargin((prev) => !prev)}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors cursor-pointer ${
                showMargin
                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                  : "bg-neutral-800 text-neutral-400 border-neutral-700"
              }`}
              title={
                showMargin
                  ? isNepali
                    ? "नाफा/मार्जिन लुकाउनुहोस्"
                    : "Hide profit margins"
                  : isNepali
                    ? "नाफा/मार्जिन देखाउनुहोस्"
                    : "Show profit margins"
              }
            >
              <Percent className="w-3 h-3" />
              <span>
                {isNepali
                  ? showMargin
                    ? "नाफा: सक्रिय"
                    : "नाफा: लुकाइयो"
                  : showMargin
                    ? "Margin: ON"
                    : "Margin: OFF"}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExpandAll}
            className="px-2.5 py-1 text-[11px] font-medium bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 rounded-md transition-colors cursor-pointer"
          >
            {isNepali ? "सबै खोल्नुहोस्" : "Expand All"}
          </button>
          <button
            type="button"
            onClick={handleCollapseAll}
            className="px-2.5 py-1 text-[11px] font-medium bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 rounded-md transition-colors cursor-pointer"
          >
            {isNepali ? "सबै बन्द गर्नुहोस्" : "Collapse All"}
          </button>
        </div>
      </div>

      {/* Date Groups */}
      {dateGroups.map((group) => {
        const isCollapsed = collapsedDates.has(group.dateKey);
        const formattedAD = formatDateAD(group.dateKey);
        const formattedBS = formatDateBS(group.dateKey, {
          digits: isNepali ? "np" : "en",
        });

        return (
          <div
            key={group.dateKey}
            className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xs transition-all"
          >
            {/* Date Header Banner */}
            <div
              onClick={() => toggleDateCollapse(group.dateKey)}
              className="px-5 py-4 bg-neutral-900 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-4 cursor-pointer select-none hover:bg-neutral-850 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-neutral-100 tracking-tight">
                      {calendarSystem === "BS" || isNepali
                        ? formattedBS
                        : formattedAD}
                    </h3>
                    <span className="text-[11px] text-neutral-400 font-medium">
                      (
                      {calendarSystem === "BS" || isNepali
                        ? formattedAD
                        : formattedBS}
                      )
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-neutral-400">
                    <span className="font-semibold text-neutral-300">
                      {formatNumberByLang(group.bills.length)}{" "}
                      {isNepali
                        ? group.bills.length === 1
                          ? "बिल"
                          : "बिलहरू"
                        : group.bills.length === 1
                          ? "Bill"
                          : "Bills"}
                    </span>
                    <span>•</span>
                    <span>
                      {formatNumberByLang(group.dayItemsCount)}{" "}
                      {isNepali ? "वस्तुहरू" : "Items"} (
                      {formatNumberByLang(group.dayUnits)}{" "}
                      {isNepali ? "एकाइ" : "units"})
                    </span>
                  </div>
                </div>
              </div>

              {/* Day Financial Badges */}
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="text-right">
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-neutral-400 block">
                    {isNepali ? "दिनको कुल" : "Day Total"}
                  </span>
                  <span className="text-sm font-bold font-mono text-emerald-400">
                    {formatCurrency(group.dayTotal, currencySymbol)}
                  </span>
                </div>

                {group.dayDue > 0 && (
                  <div className="text-right hidden sm:block">
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-amber-400/90 block">
                      {isNepali ? "बाँकी" : "Due"}
                    </span>
                    <span className="text-xs font-bold font-mono text-amber-400">
                      {formatCurrency(group.dayDue, currencySymbol)}
                    </span>
                  </div>
                )}

                {type === "sales" && showMargin && (
                  <div className="text-right hidden md:block">
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-sky-400/90 block">
                      {isNepali ? "नाफा" : "Gross Profit"}
                    </span>
                    <span className="text-xs font-bold font-mono text-sky-400">
                      {formatCurrency(group.dayProfit, currencySymbol)}
                    </span>
                  </div>
                )}

                <div className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 ml-1">
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </div>
            </div>

            {/* List of Bills under this date */}
            {!isCollapsed && (
              <div className="divide-y divide-neutral-800/80">
                {group.bills.map((bill) => {
                  const isReturned = bill.status === "RETURNED";

                  return (
                    <div
                      key={bill.billId}
                      className={`p-4 sm:p-5 space-y-3.5 transition-colors ${
                        isReturned
                          ? "bg-rose-950/10 border-l-4 border-l-rose-500"
                          : "hover:bg-neutral-850/30"
                      }`}
                    >
                      {/* Bill Header Info Row */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2.5">
                          {/* Bill Number Badge */}
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-800 border border-neutral-700/80 text-neutral-200">
                            <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="font-mono text-xs font-bold">
                              {bill.billNumber || `#${bill.billId}`}
                            </span>
                          </div>

                          {/* Purchase Supplier Invoice Number */}
                          {type === "purchases" && bill.invoiceNumber && (
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-800/60 text-[11px] font-mono text-neutral-300">
                              <Tag className="w-3 h-3 text-sky-400" />
                              <span>Inv: {bill.invoiceNumber}</span>
                            </div>
                          )}

                          {/* Party Details (Customer / Vendor) */}
                          <div className="flex items-center gap-1.5 text-xs text-neutral-300">
                            {type === "sales" ? (
                              <User className="w-3.5 h-3.5 text-neutral-400" />
                            ) : (
                              <Building2 className="w-3.5 h-3.5 text-neutral-400" />
                            )}
                            <span className="font-semibold text-neutral-100">
                              {capitalizeWords(bill.partyName)}
                            </span>
                            {bill.partyPhone && (
                              <span className="text-[11px] text-neutral-400 font-mono">
                                ({bill.partyPhone})
                              </span>
                            )}
                            {bill.partyPanVat && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono">
                                PAN: {bill.partyPanVat}
                              </span>
                            )}
                          </div>

                          {/* Payment Method */}
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-800 text-[11px] text-neutral-300">
                            <CreditCard className="w-3 h-3 text-amber-400" />
                            <span>{bill.paymentMethod}</span>
                          </div>

                          {/* Time */}
                          <div className="flex items-center gap-1 text-[11px] text-neutral-400 font-mono">
                            <Clock className="w-3 h-3 text-neutral-500" />
                            <span>
                              {bill.createdAt
                                ? new Date(bill.createdAt).toLocaleTimeString(
                                    [],
                                    {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )
                                : ""}
                            </span>
                          </div>

                          {/* Status Badge */}
                          {isReturned ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              {isNepali ? "फिर्ता" : "Returned"}
                            </span>
                          ) : bill.status !== "COMPLETED" ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {bill.status}
                            </span>
                          ) : null}
                        </div>

                        {/* Bill Actions & Amounts */}
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-xs font-bold font-mono text-neutral-100">
                              {formatCurrency(bill.grandTotal, currencySymbol)}
                            </span>
                            {bill.dueAmount > 0 && (
                              <span className="block text-[10px] font-mono text-amber-400">
                                {isNepali ? "बाँकी:" : "Due:"}{" "}
                                {formatCurrency(bill.dueAmount, currencySymbol)}
                              </span>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1">
                            {onInspectBill && (
                              <button
                                type="button"
                                title={
                                  isNepali
                                    ? "विवरण हेर्नुहोस्"
                                    : "Inspect Details"
                                }
                                onClick={() => onInspectBill(bill.billId)}
                                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {onPrintBill && (
                              <button
                                type="button"
                                title={isNepali ? "बिल प्रिन्ट" : "Print Bill"}
                                onClick={() => onPrintBill(bill.billId)}
                                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5 text-emerald-400" />
                              </button>
                            )}
                            {!isReturned && onEditBill && (
                              <button
                                type="button"
                                title={
                                  isNepali
                                    ? "बिल सम्पादन गर्नुहोस्"
                                    : "Edit Bill"
                                }
                                onClick={() => onEditBill(bill.billId)}
                                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                              </button>
                            )}
                            {!isReturned && onReturnBill && (
                              <button
                                type="button"
                                title={
                                  isNepali ? "फिर्ता गर्नुहोस्" : "Return Bill"
                                }
                                onClick={() => onReturnBill(bill.billId)}
                                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-rose-400 transition-colors cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                              </button>
                            )}
                            {onHardDeleteBill && (
                              <button
                                type="button"
                                title={
                                  isNepali
                                    ? "स्थायी मेटाउनुहोस्"
                                    : "Permanently Delete"
                                }
                                onClick={() => onHardDeleteBill(bill.billId)}
                                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-rose-950/40 text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Items Table for this Bill */}
                      <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-950/70">
                        <table className="w-full text-left text-xs text-neutral-300">
                          <thead className="bg-neutral-900/90 text-neutral-400 text-[11px] uppercase tracking-wider font-semibold border-b border-neutral-800">
                            <tr>
                              <th className="py-2.5 px-3 w-10 text-center">
                                #
                              </th>
                              <th className="py-2.5 px-3">
                                {isNepali
                                  ? "सामानको नाम र SKU"
                                  : "Item / Product & SKU"}
                              </th>
                              <th className="py-2.5 px-3 text-center">
                                {isNepali
                                  ? "प्याकेजिङ / एकाइ"
                                  : "Unit / Packaging"}
                              </th>
                              <th className="py-2.5 px-3 text-right">
                                {isNepali ? "मात्रा" : "Qty"}
                              </th>
                              <th className="py-2.5 px-3 text-right">
                                {type === "sales"
                                  ? isNepali
                                    ? "बिक्री दर"
                                    : "Selling Rate"
                                  : isNepali
                                    ? "खरिद दर"
                                    : "Cost Rate"}
                              </th>
                              <th className="py-2.5 px-3 text-right">
                                {isNepali ? "छुट" : "Discount"}
                              </th>
                              <th className="py-2.5 px-3 text-right">
                                {isNepali ? "जम्मा" : "Total"}
                              </th>
                              {type === "sales" && showMargin ? (
                                <th className="py-2.5 px-3 text-right">
                                  {isNepali ? "नाफा" : "Gross Margin"}
                                </th>
                              ) : type === "purchases" ? (
                                <th className="py-2.5 px-3 text-center">
                                  {isNepali
                                    ? "ब्याच / म्याद"
                                    : "Batch / Expiry"}
                                </th>
                              ) : null}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-850">
                            {bill.items.map((it, idx) => {
                              const unitDisplay = it.packaging_name
                                ? `${it.product_unit} (${it.packaging_name}${
                                    it.package_multiplier
                                      ? ` x${it.package_multiplier}`
                                      : ""
                                  })`
                                : it.product_unit || "pcs";

                              const rate =
                                type === "sales"
                                  ? (it as ItemizedSaleRow).selling_price
                                  : (it as ItemizedPurchaseRow).cost_price;

                              const profit =
                                type === "sales"
                                  ? (it as ItemizedSaleRow).gross_profit
                                  : undefined;

                              const batchNo =
                                type === "purchases"
                                  ? (it as ItemizedPurchaseRow).batch_number
                                  : null;
                              const expDate =
                                type === "purchases"
                                  ? (it as ItemizedPurchaseRow).expiry_date
                                  : null;

                              return (
                                <tr
                                  key={it.item_id}
                                  className="hover:bg-neutral-800/40 transition-colors"
                                >
                                  <td className="py-2 px-3 text-center font-mono text-[11px] text-neutral-400">
                                    {idx + 1}
                                  </td>
                                  <td className="py-2 px-3">
                                    <div className="font-semibold text-neutral-100">
                                      {it.product_name}
                                    </div>
                                    {it.product_sku && (
                                      <div className="print:hidden text-[10px] font-mono text-neutral-400">
                                        SKU: {it.product_sku}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-center text-[11px] text-neutral-300">
                                    {unitDisplay}
                                  </td>
                                  <td className="py-2 px-3 text-right font-bold font-mono text-neutral-100">
                                    {formatNumberByLang(it.quantity)}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono text-neutral-300">
                                    {formatCurrency(rate, currencySymbol)}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono">
                                    {it.item_discount > 0 ? (
                                      <span className="text-amber-400">
                                        -
                                        {formatCurrency(
                                          it.item_discount,
                                          currencySymbol,
                                        )}
                                      </span>
                                    ) : (
                                      <span className="text-neutral-500">
                                        -
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-right font-bold font-mono text-neutral-100">
                                    {formatCurrency(
                                      it.item_total,
                                      currencySymbol,
                                    )}
                                  </td>
                                  {type === "sales" && showMargin ? (
                                    <td className="py-2 px-3 text-right font-mono text-[11px]">
                                      {profit !== undefined ? (
                                        <span
                                          className={
                                            profit >= 0
                                              ? "text-emerald-400 font-semibold"
                                              : "text-rose-400"
                                          }
                                        >
                                          {formatCurrency(
                                            profit,
                                            currencySymbol,
                                          )}
                                        </span>
                                      ) : (
                                        "-"
                                      )}
                                    </td>
                                  ) : type === "purchases" ? (
                                    <td className="py-2 px-3 text-center text-[11px] font-mono text-neutral-400">
                                      {batchNo ? (
                                        <div>
                                          <span className="text-sky-400">
                                            #{batchNo}
                                          </span>
                                          {expDate && (
                                            <span className="block text-[10px] text-neutral-500">
                                              Exp: {expDate}
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        "-"
                                      )}
                                    </td>
                                  ) : null}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Bill Subtotal, Tax, and Net Summary Footer */}
                      <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-800/60">
                        <div className="flex items-center gap-3 text-neutral-400 text-[11px]">
                          <span>
                            {isNepali ? "कुल वस्तु रकम:" : "Subtotal:"}{" "}
                            <strong className="text-neutral-200 font-mono">
                              {formatCurrency(bill.subtotal, currencySymbol)}
                            </strong>
                          </span>
                          {bill.discount > 0 && (
                            <span>
                              {isNepali ? "छुट:" : "Discount:"}{" "}
                              <strong className="text-amber-400 font-mono">
                                -{formatCurrency(bill.discount, currencySymbol)}
                              </strong>
                            </span>
                          )}
                          {bill.vatAmount > 0 && (
                            <span>
                              {isNepali ? "भ्याट (१३%):" : "VAT (13%):"}{" "}
                              <strong className="text-sky-400 font-mono">
                                +
                                {formatCurrency(bill.vatAmount, currencySymbol)}
                              </strong>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-[11px]">
                          <span className="text-neutral-300">
                            {isNepali ? "अन्तिम रकम:" : "Grand Total:"}{" "}
                            <strong className="text-sm font-bold font-mono text-neutral-100">
                              {formatCurrency(bill.grandTotal, currencySymbol)}
                            </strong>
                          </span>
                          <span className="text-neutral-400">
                            {isNepali ? "भुक्तान:" : "Paid:"}{" "}
                            <strong className="text-emerald-400 font-mono">
                              {formatCurrency(bill.paidAmount, currencySymbol)}
                            </strong>
                          </span>
                          {bill.dueAmount > 0 && (
                            <span className="text-neutral-400">
                              {isNepali ? "बाँकी:" : "Due:"}{" "}
                              <strong className="text-amber-400 font-mono">
                                {formatCurrency(bill.dueAmount, currencySymbol)}
                              </strong>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
