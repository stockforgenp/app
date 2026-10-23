/**
 * DayBookView Component
 * Dedicated Daily Cash & Transaction Book (रोजिन्दा हिसाब किताब)
 * Comprehensive view of all sales, purchases, expenses, and dues along with opening & closing balances.
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Printer,
  RefreshCw,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  UserCheck,
  SlidersHorizontal,
} from "lucide-react";
import { DayBookSummary, DayBookTransactionType } from "../types/index.ts";
import { getDayBook } from "../lib/services/dayBookService.ts";
import { subscribeToDbChanges } from "../lib/db/sqliteEngine.ts";
import {
  formatCurrency,
  formatDateTime,
  getTodayISODate,
} from "../helpers/formatHelpers.ts";
import { useLanguage } from "../context/LanguageContext.tsx";
import { PrintDayBookModal } from "../components/common/PrintDayBookModal.tsx";

interface DayBookViewProps {
  currencySymbol: string;
}

export const DayBookView: React.FC<DayBookViewProps> = ({ currencySymbol }) => {
  const { isNepali, formatNumberByLang } = useLanguage();

  const todayStr = getTodayISODate();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [isRangeMode, setIsRangeMode] = useState<boolean>(false);
  const [rangeStartDate, setRangeStartDate] = useState<string>(todayStr);
  const [rangeEndDate, setRangeEndDate] = useState<string>(todayStr);

  // Filters
  const [activeTypeTab, setActiveTypeTab] = useState<
    "all" | DayBookTransactionType | "returns"
  >("all");
  const [selectedModeFilter, setSelectedModeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Print Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // Data
  const [summary, setSummary] = useState<DayBookSummary>(() =>
    getDayBook({ date: todayStr }),
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const loadData = useCallback(() => {
    setIsLoading(true);
    try {
      const data = isRangeMode
        ? getDayBook({ startDate: rangeStartDate, endDate: rangeEndDate })
        : getDayBook({ date: selectedDate });
      setSummary(data);
    } catch (e) {
      console.error("Failed to load Day Book data:", e);
    } finally {
      setIsLoading(false);
    }
  }, [isRangeMode, rangeStartDate, rangeEndDate, selectedDate]);

  useEffect(() => {
    loadData();
    const unsub = subscribeToDbChanges(() => {
      loadData();
    });
    return unsub;
  }, [loadData]);

  // Date Navigation Helpers
  const handlePrevDay = () => {
    const cur = new Date(selectedDate);
    cur.setDate(cur.getDate() - 1);
    const prev = cur.toISOString().split("T")[0];
    setSelectedDate(prev);
  };

  const handleNextDay = () => {
    const cur = new Date(selectedDate);
    cur.setDate(cur.getDate() + 1);
    const next = cur.toISOString().split("T")[0];
    setSelectedDate(next);
  };

  const handleToday = () => {
    setSelectedDate(todayStr);
    setRangeStartDate(todayStr);
    setRangeEndDate(todayStr);
  };

  // Filtered Entries
  const filteredEntries = useMemo(() => {
    return summary.entries.filter((entry) => {
      // Type Tab Filter
      if (activeTypeTab !== "all") {
        if (activeTypeTab === "returns") {
          if (entry.type !== "SALE_RETURN" && entry.type !== "PURCHASE_RETURN")
            return false;
        } else if (entry.type !== activeTypeTab) {
          return false;
        }
      }

      // Mode Filter
      if (selectedModeFilter !== "all") {
        const entryMode = (entry.paymentMethod || "Cash").toLowerCase();
        const filter = selectedModeFilter.toLowerCase();
        if (filter === "cash" && entryMode !== "cash") return false;
        if (
          filter === "online" &&
          !entryMode.includes("qr") &&
          !entryMode.includes("online") &&
          !entryMode.includes("esewa") &&
          !entryMode.includes("fonepay")
        )
          return false;
        if (
          filter === "bank" &&
          !entryMode.includes("bank") &&
          !entryMode.includes("transfer")
        )
          return false;
        if (
          filter === "cheque" &&
          !entryMode.includes("cheque") &&
          !entryMode.includes("check")
        )
          return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchRef = entry.refNumber.toLowerCase().includes(q);
        const matchParty = entry.partyName.toLowerCase().includes(q);
        const matchNote = entry.notes
          ? entry.notes.toLowerCase().includes(q)
          : false;
        const matchMode = entry.paymentMethod.toLowerCase().includes(q);
        if (!matchRef && !matchParty && !matchNote && !matchMode) return false;
      }

      return true;
    });
  }, [summary.entries, activeTypeTab, selectedModeFilter, searchQuery]);

  // Counts for tabs
  const typeCounts = useMemo(() => {
    const map: Record<string, number> = {
      all: summary.entries.length,
      SALE: 0,
      PURCHASE: 0,
      EXPENSE: 0,
      CUSTOMER_PAYMENT: 0,
      VENDOR_PAYMENT: 0,
      SALARY: 0,
      returns: 0,
    };
    for (const e of summary.entries) {
      if (e.type in map) map[e.type]++;
      if (e.type === "SALE_RETURN" || e.type === "PURCHASE_RETURN") {
        map.returns++;
      }
    }
    return map;
  }, [summary.entries]);

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Date Navigation Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-neutral-900 border border-neutral-800 p-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
              <span>{isNepali ? "दैनिक हिसाब किताब" : "Daily Book"}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-normal">
                {isNepali ? "रोजिन्दा खाता" : "Day Book"}
              </span>
            </h1>
            <p className="text-xs text-neutral-400">
              {isNepali
                ? "दैनिक बिक्री, खरिद, खर्च, बक्यौता असुली एवं क्यास दराजको हिसाब"
                : "Authoritative daily cash journal, all transactions, payment modes & running dues"}
            </p>
          </div>
        </div>

        {/* Date Selector & Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {!isRangeMode ? (
            <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-xl p-1 gap-1">
              <button
                type="button"
                onClick={handlePrevDay}
                className="p-1.5 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                title={isNepali ? "अघिल्लो दिन" : "Previous Day"}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5 px-2">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-xs font-mono font-semibold text-neutral-200 focus:outline-none cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={handleNextDay}
                className="p-1.5 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                title={isNepali ? "पछिल्लो दिन" : "Next Day"}
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleToday}
                className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ml-1 ${
                  selectedDate === todayStr
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {isNepali ? "आज" : "Today"}
              </button>
            </div>
          ) : (
            <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-xl py-1.5 px-2.5 gap-2 text-xs">
              <input
                type="date"
                value={rangeStartDate}
                onChange={(e) => setRangeStartDate(e.target.value)}
                className="bg-transparent font-mono text-neutral-200 text-xs focus:outline-none cursor-pointer"
              />
              <span className="text-neutral-500 text-[11px]">|</span>
              <input
                type="date"
                value={rangeEndDate}
                onChange={(e) => setRangeEndDate(e.target.value)}
                className="bg-transparent font-mono text-neutral-200 text-xs focus:outline-none cursor-pointer"
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsRangeMode(!isRangeMode)}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-xl border transition-colors cursor-pointer ${
              isRangeMode
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200"
            }`}
          >
            {isRangeMode
              ? isNepali
                ? "एक दिन हेर्नुहोस्"
                : "Single Date"
              : isNepali
                ? "मिति दायरा"
                : "Date Range"}
          </button>

          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="p-2 text-neutral-400 hover:text-neutral-100 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin text-emerald-400" : ""}`}
            />
          </button>

          <button
            type="button"
            onClick={() => setIsPrintModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors cursor-pointer shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{isNepali ? "प्रिन्ट / रिपोर्ट" : "Print Day Book"}</span>
          </button>
        </div>
      </div>

      {/* Top Financial Strip: Opening, Inflows, Outflows, Net & Closing */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* 1. Opening Cash Balance */}
        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-medium">
            <span>
              {isNepali ? "सुरुवाती नगद (Opening)" : "Opening Cash Balance"}
            </span>
            <Wallet className="w-4 h-4 text-neutral-500" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold font-mono text-neutral-100">
              {formatCurrency(summary.openingBalance, currencySymbol)}
            </span>
            <p className="text-[10px] text-neutral-500 mt-0.5">
              {isNepali
                ? "अघिल्लो दिनको बचत मौज्दात"
                : "Carried forward balance"}
            </p>
          </div>
        </div>

        {/* 2. Total Inflow (Debit / Received) */}
        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-medium">
            <span>
              {isNepali ? "कुल आम्दानी (Inflow)" : "Total Money In (Debit)"}
            </span>
            <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-400">
              <ArrowDownLeft className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold font-mono text-emerald-400">
              +{formatCurrency(summary.totalInflow, currencySymbol)}
            </span>
            <div className="flex items-center justify-between text-[10px] text-neutral-500 mt-0.5">
              <span>
                Cash: {formatCurrency(summary.cashInflow, currencySymbol)}
              </span>
              <span>
                Online:{" "}
                {formatCurrency(
                  summary.totalInflow - summary.cashInflow,
                  currencySymbol,
                )}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Total Outflow (Credit / Paid) */}
        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-medium">
            <span>
              {isNepali ? "कुल भुक्तानी (Outflow)" : "Total Money Out (Credit)"}
            </span>
            <div className="p-1 rounded-md bg-rose-500/10 text-rose-400">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold font-mono text-rose-400">
              -{formatCurrency(summary.totalOutflow, currencySymbol)}
            </span>
            <div className="flex items-center justify-between text-[10px] text-neutral-500 mt-0.5">
              <span>
                Cash: {formatCurrency(summary.cashOutflow, currencySymbol)}
              </span>
              <span>
                Online:{" "}
                {formatCurrency(
                  summary.totalOutflow - summary.cashOutflow,
                  currencySymbol,
                )}
              </span>
            </div>
          </div>
        </div>

        {/* 4. Net Cash Flow */}
        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-medium">
            <span>
              {isNepali ? "खुद नगद प्रवाह (Net Cash)" : "Net Cash In Hand"}
            </span>
            <div
              className={`p-1 rounded-md ${
                summary.netCash >= 0
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-rose-500/10 text-rose-400"
              }`}
            >
              {summary.netCash >= 0 ? (
                <ArrowDownLeft className="w-3.5 h-3.5" />
              ) : (
                <ArrowUpRight className="w-3.5 h-3.5" />
              )}
            </div>
          </div>
          <div className="mt-2">
            <span
              className={`text-xl font-bold font-mono ${
                summary.netCash >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {summary.netCash >= 0 ? "+" : ""}
              {formatCurrency(summary.netCash, currencySymbol)}
            </span>
            <p className="text-[10px] text-neutral-500 mt-0.5">
              Overall Net: {formatCurrency(summary.netCashFlow, currencySymbol)}
            </p>
          </div>
        </div>

        {/* 5. Closing Cash Balance */}
        <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-300 text-xs font-medium">
            <span>
              {isNepali ? "अन्तिम नगद (Closing Cash)" : "Closing Cash Balance"}
            </span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold font-mono text-emerald-300">
              {formatCurrency(summary.closingBalance, currencySymbol)}
            </span>
            <p className="text-[10px] text-neutral-400 mt-0.5">
              {isNepali
                ? "दराजमा हुनुपर्ने मौज्दात"
                : "Expected in cash drawer"}
            </p>
          </div>
        </div>
      </div>

      {/* Secondary Strip: Payment Mode Breakdown & Dues Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Payment Modes Grid */}
        <div className="lg:col-span-2 p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {isNepali
                  ? "भुक्तानी माध्यमगत विभाजन"
                  : "Payment Mode Distribution"}
              </span>
            </h3>
            <span className="text-[11px] text-neutral-500">
              {summary.modeSummaries.length}{" "}
              {isNepali ? "माध्यमहरू" : "modes active"}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {summary.modeSummaries.map((m) => {
              const isCash = m.mode === "Cash";
              return (
                <div
                  key={m.mode}
                  onClick={() =>
                    setSelectedModeFilter(
                      selectedModeFilter === m.mode ? "all" : m.mode,
                    )
                  }
                  className={`p-3 rounded-lg border transition-all cursor-pointer ${
                    selectedModeFilter === m.mode
                      ? "bg-emerald-500/10 border-emerald-500/40"
                      : "bg-neutral-950/70 border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-neutral-200">
                    <span className="truncate">{m.mode}</span>
                    {isCash && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    )}
                  </div>
                  <div className="mt-2 space-y-0.5 font-mono text-[11px]">
                    <div className="flex justify-between text-neutral-400">
                      <span>In:</span>
                      <span className="text-emerald-400 font-medium">
                        {formatCurrency(m.inflow, currencySymbol)}
                      </span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>Out:</span>
                      <span className="text-rose-400 font-medium">
                        {formatCurrency(m.outflow, currencySymbol)}
                      </span>
                    </div>
                    <div className="flex justify-between text-neutral-300 font-bold pt-1 border-t border-neutral-800/80">
                      <span>Net:</span>
                      <span
                        className={
                          m.net >= 0 ? "text-emerald-300" : "text-rose-300"
                        }
                      >
                        {formatCurrency(m.net, currencySymbol)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dues & Credit Activity Card */}
        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
              <UserCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {isNepali
                  ? "दैनिक बाँकी बक्यौता (Dues)"
                  : "Dues & Credit Tracking"}
              </span>
            </h3>
          </div>

          <div className="space-y-2 text-xs">
            {/* Customer Dues */}
            <div className="p-2.5 rounded-lg bg-neutral-950/60 border border-neutral-800 space-y-1">
              <span className="text-[11px] font-semibold text-neutral-400">
                {isNepali
                  ? "ग्राहक बक्यौता (Customer Accounts)"
                  : "Customer Credit"}
              </span>
              <div className="flex justify-between font-mono">
                <span className="text-neutral-500">New Credit Given:</span>
                <span className="text-rose-400 font-bold">
                  {formatCurrency(summary.newCustomerDue, currencySymbol)}
                </span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-neutral-500">Old Due Collected:</span>
                <span className="text-emerald-400 font-bold">
                  {formatCurrency(summary.customerDueCollected, currencySymbol)}
                </span>
              </div>
              <div className="flex justify-between font-mono pt-1 border-t border-neutral-800 text-[11px]">
                <span className="text-neutral-400">Net Due Delta:</span>
                <span
                  className={
                    summary.newCustomerDue - summary.customerDueCollected > 0
                      ? "text-rose-400 font-bold"
                      : "text-emerald-400 font-bold"
                  }
                >
                  {formatCurrency(
                    summary.newCustomerDue - summary.customerDueCollected,
                    currencySymbol,
                  )}
                </span>
              </div>
            </div>

            {/* Vendor Dues */}
            <div className="p-2.5 rounded-lg bg-neutral-950/60 border border-neutral-800 space-y-1">
              <span className="text-[11px] font-semibold text-neutral-400">
                {isNepali
                  ? "आपूर्तिकर्ता बक्यौता (Vendor Payables)"
                  : "Vendor Payables"}
              </span>
              <div className="flex justify-between font-mono">
                <span className="text-neutral-500">New Credit Taken:</span>
                <span className="text-amber-400 font-bold">
                  {formatCurrency(summary.newVendorDue, currencySymbol)}
                </span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-neutral-500">Vendor Dues Paid:</span>
                <span className="text-indigo-400 font-bold">
                  {formatCurrency(summary.vendorDuePaid, currencySymbol)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Type Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-neutral-900 border border-neutral-800 rounded-xl overflow-x-auto w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTypeTab("all")}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                activeTypeTab === "all"
                  ? "bg-neutral-800 text-neutral-100 shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {isNepali ? "सबै कारोबार" : "All"} (
              {formatNumberByLang(typeCounts.all)})
            </button>
            <button
              type="button"
              onClick={() => setActiveTypeTab("SALE")}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                activeTypeTab === "SALE"
                  ? "bg-neutral-800 text-emerald-400 shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {isNepali ? "बिक्री" : "Sales"} (
              {formatNumberByLang(typeCounts.SALE)})
            </button>
            <button
              type="button"
              onClick={() => setActiveTypeTab("PURCHASE")}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                activeTypeTab === "PURCHASE"
                  ? "bg-neutral-800 text-purple-400 shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {isNepali ? "खरिद" : "Purchases"} (
              {formatNumberByLang(typeCounts.PURCHASE)})
            </button>
            <button
              type="button"
              onClick={() => setActiveTypeTab("EXPENSE")}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                activeTypeTab === "EXPENSE"
                  ? "bg-neutral-800 text-rose-400 shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {isNepali ? "खर्चहरू" : "Expenses"} (
              {formatNumberByLang(typeCounts.EXPENSE)})
            </button>
            <button
              type="button"
              onClick={() => setActiveTypeTab("CUSTOMER_PAYMENT")}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                activeTypeTab === "CUSTOMER_PAYMENT"
                  ? "bg-neutral-800 text-sky-400 shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {isNepali ? "बक्यौता असुली" : "Due Collections"} (
              {formatNumberByLang(typeCounts.CUSTOMER_PAYMENT)})
            </button>
            <button
              type="button"
              onClick={() => setActiveTypeTab("VENDOR_PAYMENT")}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                activeTypeTab === "VENDOR_PAYMENT"
                  ? "bg-neutral-800 text-amber-400 shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {isNepali ? "आपूर्तिकर्ता भुक्तानी" : "Vendor Dues Paid"} (
              {formatNumberByLang(typeCounts.VENDOR_PAYMENT)})
            </button>
            <button
              type="button"
              onClick={() => setActiveTypeTab("SALARY")}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                activeTypeTab === "SALARY"
                  ? "bg-neutral-800 text-indigo-400 shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {isNepali ? "तलब" : "Salary"} (
              {formatNumberByLang(typeCounts.SALARY)})
            </button>
            <button
              type="button"
              onClick={() => setActiveTypeTab("returns")}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                activeTypeTab === "returns"
                  ? "bg-neutral-800 text-rose-300 shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {isNepali ? "फिर्ता / नोट" : "Returns"} (
              {formatNumberByLang(typeCounts.returns)})
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={
                isNepali
                  ? "बिल, पार्टी, माध्यम खोज्नुहोस्..."
                  : "Search ref, party, mode..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Main Day Book Transaction Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-400 font-semibold uppercase bg-neutral-950/60 text-[11px]">
                <th className="py-3 px-3.5 whitespace-nowrap">
                  {isNepali ? "समय" : "Time"}
                </th>
                <th className="py-3 px-3.5 whitespace-nowrap">
                  {isNepali ? "प्रकार" : "Type"}
                </th>
                <th className="py-3 px-3.5 whitespace-nowrap">
                  {isNepali ? "बिल / रसिद नं" : "Ref #"}
                </th>
                <th className="py-3 px-3.5">
                  {isNepali ? "पार्टी / विवरण" : "Party / Particulars"}
                </th>
                <th className="py-3 px-3.5 text-center whitespace-nowrap">
                  {isNepali ? "माध्यम" : "Mode"}
                </th>
                <th className="py-3 px-3.5 text-right whitespace-nowrap">
                  {isNepali ? "बिल रकम" : "Bill Amount"}
                </th>
                <th className="py-3 px-3.5 text-right whitespace-nowrap text-emerald-400">
                  {isNepali ? "आम्दानी (+)" : "Inflow (+)"}
                </th>
                <th className="py-3 px-3.5 text-right whitespace-nowrap text-rose-400">
                  {isNepali ? "भुक्तानी (-)" : "Outflow (-)"}
                </th>
                <th className="py-3 px-3.5 text-right whitespace-nowrap text-amber-400">
                  {isNepali ? "बाँकी (Due)" : "Due"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-12 text-center text-neutral-500 text-xs"
                  >
                    {isNepali
                      ? "छानिएको मिति वा फिल्टरमा कुनै कारोबार भेटिएन।"
                      : "No transaction records found for the selected date or filter."}
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => {
                  const isSale = entry.type === "SALE";
                  const isPurchase = entry.type === "PURCHASE";
                  const isExpense = entry.type === "EXPENSE";
                  const isCustPay = entry.type === "CUSTOMER_PAYMENT";
                  const isVendPay = entry.type === "VENDOR_PAYMENT";
                  const isSalary = entry.type === "SALARY";
                  const isSaleRet = entry.type === "SALE_RETURN";
                  const isPurRet = entry.type === "PURCHASE_RETURN";

                  const badgeClass = isSale
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : isPurchase
                      ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                      : isExpense
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        : isCustPay
                          ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                          : isVendPay
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : isSalary
                              ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                              : "bg-rose-500/15 text-rose-300 border-rose-500/30";

                  const typeLabel = isSale
                    ? isNepali
                      ? "बिक्री"
                      : "Sale"
                    : isPurchase
                      ? isNepali
                        ? "खरिद"
                        : "Purchase"
                      : isExpense
                        ? isNepali
                          ? "खर्च"
                          : "Expense"
                        : isCustPay
                          ? isNepali
                            ? "असुली"
                            : "Due Coll"
                          : isVendPay
                            ? isNepali
                              ? "भुक्तानी"
                              : "Due Paid"
                            : isSalary
                              ? isNepali
                                ? "तलब"
                                : "Salary"
                              : isSaleRet
                                ? isNepali
                                  ? "बिक्री फिर्ता"
                                  : "Sale Ret"
                                : isNepali
                                  ? "खरिद फिर्ता"
                                  : "Pur Ret";

                  const timeStr = entry.time.includes("T")
                    ? entry.time.split("T")[1]?.slice(0, 5) || ""
                    : "";

                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-neutral-800/30 transition-colors"
                    >
                      <td className="py-2.5 px-3.5 font-mono text-[11px] text-neutral-400 whitespace-nowrap">
                        {timeStr
                          ? timeStr
                          : formatDateTime(entry.time).split(" ")[1] ||
                            entry.time.slice(0, 10)}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${badgeClass}`}
                        >
                          {typeLabel}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 font-mono font-bold text-neutral-200 whitespace-nowrap">
                        {entry.refNumber}
                      </td>
                      <td className="py-2.5 px-3.5 max-w-[200px]">
                        <div className="font-medium text-neutral-200 truncate">
                          {entry.partyName}
                        </div>
                        {entry.notes && (
                          <div className="text-[10px] text-neutral-500 truncate mt-0.5">
                            {entry.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-neutral-800 text-neutral-300 border border-neutral-700">
                          {entry.paymentMethod}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono text-neutral-400 tabular-nums whitespace-nowrap">
                        {formatCurrency(entry.billAmount, currencySymbol)}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono font-bold text-emerald-400 tabular-nums whitespace-nowrap">
                        {entry.inflow > 0
                          ? `+${formatCurrency(entry.inflow, currencySymbol)}`
                          : "—"}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono font-bold text-rose-400 tabular-nums whitespace-nowrap">
                        {entry.outflow > 0
                          ? `-${formatCurrency(entry.outflow, currencySymbol)}`
                          : "—"}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono font-bold text-amber-400 tabular-nums whitespace-nowrap">
                        {entry.dueAmount > 0
                          ? formatCurrency(entry.dueAmount, currencySymbol)
                          : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredEntries.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-neutral-700 bg-neutral-950 font-semibold text-xs">
                  <td colSpan={5} className="py-3 px-3.5 text-neutral-300">
                    {isNepali
                      ? "कुल जम्मा (Filtered Total)"
                      : "Total for Selected Entries"}{" "}
                    ({filteredEntries.length} entries)
                  </td>
                  <td className="py-3 px-3.5 text-right font-mono text-neutral-300">
                    {formatCurrency(
                      filteredEntries.reduce((a, b) => a + b.billAmount, 0),
                      currencySymbol,
                    )}
                  </td>
                  <td className="py-3 px-3.5 text-right font-mono text-emerald-400 font-bold">
                    +
                    {formatCurrency(
                      filteredEntries.reduce((a, b) => a + b.inflow, 0),
                      currencySymbol,
                    )}
                  </td>
                  <td className="py-3 px-3.5 text-right font-mono text-rose-400 font-bold">
                    -
                    {formatCurrency(
                      filteredEntries.reduce((a, b) => a + b.outflow, 0),
                      currencySymbol,
                    )}
                  </td>
                  <td className="py-3 px-3.5 text-right font-mono text-amber-400 font-bold">
                    {formatCurrency(
                      filteredEntries.reduce((a, b) => a + b.dueAmount, 0),
                      currencySymbol,
                    )}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Print Day Book Modal */}
      <PrintDayBookModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        summary={summary}
        currencySymbol={currencySymbol}
      />
    </div>
  );
};
