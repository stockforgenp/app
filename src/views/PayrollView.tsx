/**
 * Payroll Management View
 * Features:
 * - Current Date & Month Payroll Status (Fully Paid, Partially Paid, or Unpaid/Pending)
 * - Month-by-month payroll selector with liability vs disbursed tracking
 * - Staff Roster view showing each employee's status (Paid vs Due) for the selected month
 * - Instant 1-click salary disbursement with pre-filled details
 * - Historical disbursements ledger audit log
 * - Thermal & A4 printable salary vouchers
 * - Automatic overhead expense ledger synchronization
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CreditCard,
  AlertCircle,
  Receipt,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Users,
  Check,
  RotateCcw,
} from "lucide-react";
import {
  Staff,
  SalaryPayment,
  StaffMonthlyPayrollStatus,
  MonthlyPayrollSummary,
} from "../types/index.ts";
import {
  getAllStaff,
  getSalaryPayments,
  deleteSalaryPayment,
  getMonthlyPayrollSummary,
  MONTH_NAMES,
  SALARY_PAYMENT_METHODS,
} from "../lib/services/staffService.ts";
import { formatCurrency, getTodayISODate } from "../lib/utils/format.ts";
import { Modal } from "../components/common/Modal.tsx";
import { ConfirmDialog } from "../components/common/ConfirmDialog.tsx";
import { PrintSalarySlipModal } from "../components/common/PrintSalarySlipModal.tsx";
import { DataTable, Column } from "../components/common/DataTable.tsx";
import {
  getPayrollRosterColumns,
  getSalaryDisbursementColumns,
} from "../columns/index.ts";
import { Select } from "../components/common/Select.tsx";
import { useToast } from "../context/ToastContext.tsx";
import { useLanguage } from "../context/LanguageContext.tsx";
import { subscribeToDbChanges } from "../lib/db/sqliteEngine.ts";
import { NewPayrollForm } from "../components/forms/NewPayrollForm.tsx";

interface PayrollViewProps {
  currencySymbol: string;
}

export const PayrollView: React.FC<PayrollViewProps> = ({ currencySymbol }) => {
  const { showToast } = useToast();
  const { isNepali } = useLanguage();
  const location = useLocation();

  // Selected Month & Year (defaults to today's current month & year)
  const today = useMemo(() => new Date(), []);
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(
    today.getMonth() + 1,
  ); // 1-12

  // Active View Tab: 'roster' (current month status roster) vs 'ledger' (all disbursements)
  const [activeTab, setActiveTab] = useState<"roster" | "ledger">("roster");

  // Roster sub-filter: 'all' | 'unpaid' | 'paid'
  const [rosterStatusFilter, setRosterStatusFilter] = useState<
    "all" | "unpaid" | "paid"
  >("all");
  const [rosterSearch, setRosterSearch] = useState("");

  // Ledger state & filters
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [paymentSearch, setPaymentSearch] = useState("");
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<
    number | "all"
  >("all");
  const [selectedMethodFilter, setSelectedMethodFilter] =
    useState<string>("all");

  // Monthly status summary for the selected month/year
  const [monthlyStatus, setMonthlyStatus] = useState<MonthlyPayrollSummary>({
    period_label: "",
    year: selectedYear,
    month: selectedMonth,
    is_current_month: true,
    total_active_staff: 0,
    paid_count: 0,
    unpaid_count: 0,
    percent_paid: 0,
    total_commitment: 0,
    total_paid: 0,
    total_pending: 0,
    total_deductions: 0,
    total_bonus: 0,
    overall_status: "unpaid",
    staff_statuses: [],
    today_status: {
      date: getTodayISODate(),
      formatted: "Today",
      is_paid: false,
      payments_count: 0,
      total_paid: 0,
    },
  });

  // Modals state
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [disbursingStaff, setDisbursingStaff] = useState<
    Staff | StaffMonthlyPayrollStatus | null
  >(null);

  // Print voucher modal
  const [printingPayment, setPrintingPayment] = useState<SalaryPayment | null>(
    null,
  );

  // Reversal / Delete modal
  const [paymentToDelete, setPaymentToDelete] = useState<SalaryPayment | null>(
    null,
  );

  // Load Data
  const loadData = useCallback(() => {
    try {
      const allStaff = getAllStaff();
      setStaffList(allStaff);

      const staffFilter =
        selectedStaffFilter === "all" ? undefined : selectedStaffFilter;
      const paymentRecords = getSalaryPayments({
        staffId: staffFilter,
        search: paymentSearch.trim() || undefined,
      });
      setPayments(paymentRecords);

      const mSummary = getMonthlyPayrollSummary(selectedYear, selectedMonth);
      setMonthlyStatus(mSummary);
    } catch (err: any) {
      console.error("Error loading payroll data:", err);
    }
  }, [selectedYear, selectedMonth, selectedStaffFilter, paymentSearch]);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToDbChanges(() => {
      loadData();
    });
    return unsubscribe;
  }, [loadData]);

  // Handle URL Query Params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const staffIdParam = params.get("staffId");
    if (staffIdParam) {
      const id = parseInt(staffIdParam, 10);
      if (!isNaN(id)) {
        setSelectedStaffFilter(id);
        setActiveTab("ledger");
      }
    }
  }, [location.search]);

  // Navigate Months
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((prev) => prev - 1);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((prev) => prev + 1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  };

  const handleJumpToCurrentMonth = () => {
    setSelectedYear(today.getFullYear());
    setSelectedMonth(today.getMonth() + 1);
  };

  // Open Pay Modal pre-filled for a specific employee
  const handleOpenPaySalary = (
    targetStaff?: Staff | StaffMonthlyPayrollStatus,
  ) => {
    setDisbursingStaff(targetStaff || null);
    setIsPayModalOpen(true);
  };

  // Reversal / Delete
  const handleDeletePayment = () => {
    if (!paymentToDelete) return;
    try {
      deleteSalaryPayment(paymentToDelete.id);
      showToast(`Payment #${paymentToDelete.id} reversed and removed`, "info");
      setPaymentToDelete(null);
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to delete payment record", "error");
    }
  };

  // Copy Reference handler
  const handleCopyReference = useCallback(
    (ref: string) => {
      navigator.clipboard.writeText(ref);
      showToast(`Reference ${ref} copied`, "info");
    },
    [showToast],
  );

  // Column definitions for Tab 1 (Roster) and Tab 2 (Ledger)
  const rosterColumns = useMemo<Column<StaffMonthlyPayrollStatus>[]>(
    () =>
      getPayrollRosterColumns({
        currencySymbol,
        isNepali,
        todayDate: monthlyStatus.today_status.date,
        periodLabel: monthlyStatus.period_label,
        onPaySalary: handleOpenPaySalary,
        onPrintSlip: (payment) => setPrintingPayment(payment),
        onCopyReference: handleCopyReference,
        onDeletePayment: (payment) => setPaymentToDelete(payment),
      }),
    [
      currencySymbol,
      isNepali,
      monthlyStatus.today_status.date,
      monthlyStatus.period_label,
      handleCopyReference,
    ],
  );

  const ledgerColumns = useMemo<Column<SalaryPayment>[]>(
    () =>
      getSalaryDisbursementColumns({
        currencySymbol,
        isNepali,
        onPrintSlip: (payment) => setPrintingPayment(payment),
        onCopyReference: handleCopyReference,
        onDeletePayment: (payment) => setPaymentToDelete(payment),
      }),
    [currencySymbol, isNepali, handleCopyReference],
  );

  // Filtered Roster
  const filteredRoster = useMemo(() => {
    if (!monthlyStatus.staff_statuses) return [];
    let list = monthlyStatus.staff_statuses;
    if (rosterStatusFilter === "paid") {
      list = list.filter((s) => s.is_paid);
    } else if (rosterStatusFilter === "unpaid") {
      list = list.filter((s) => !s.is_paid);
    }
    if (rosterSearch.trim()) {
      const q = rosterSearch.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.staff_name.toLowerCase().includes(q) ||
          s.staff_role.toLowerCase().includes(q) ||
          String(s.staff_id).includes(q),
      );
    }
    return list;
  }, [monthlyStatus.staff_statuses, rosterStatusFilter, rosterSearch]);

  // Filtered Payments (Ledger)
  const filteredPayments = useMemo(() => {
    if (selectedMethodFilter === "all") return payments;
    return payments.filter((p) => p.payment_method === selectedMethodFilter);
  }, [payments, selectedMethodFilter]);

  // Is viewing current month?
  const isCurrentMonth =
    selectedYear === today.getFullYear() &&
    selectedMonth === today.getMonth() + 1;

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-150">
      {/* Hero Status & Period Navigator Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 relative overflow-hidden shadow-xs space-y-5"
      >
        {/* Subtle background glow depending on status */}
        <div
          className={`absolute -right-20 -top-20 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-20 transition-all duration-700 ${
            monthlyStatus.overall_status === "fully_paid"
              ? "bg-emerald-500"
              : monthlyStatus.overall_status === "partially_paid"
                ? "bg-amber-500"
                : "bg-rose-500"
          }`}
        />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          {/* Left: Period Selector & Dual Status Callouts */}
          <div className="space-y-4 flex-1">
            {/* Period Navigator Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Payroll Period:
              </span>

              <div className="inline-flex items-center bg-neutral-950 border border-neutral-800 rounded-lg p-0.5">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-850 rounded transition-colors cursor-pointer"
                  title="Previous Month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </motion.button>

                <div className="px-3 py-0.5 text-xs font-bold text-neutral-100 font-mono">
                  {monthlyStatus.period_label ||
                    `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`}
                </div>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-850 rounded transition-colors cursor-pointer"
                  title="Next Month"
                >
                  <ChevronRight className="w-4 h-4" />
                </motion.button>
              </div>

              {isCurrentMonth ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Current Month
                </span>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={handleJumpToCurrentMonth}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-700 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>Current Month</span>
                </motion.button>
              )}
            </div>

            {/* DUAL STATUS STRIP: Month Status & Today's Date Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
              {/* Status 1: Selected Month Payroll Status */}
              <motion.div
                whileHover={{ scale: 1.01 }}
                className={`p-3 rounded-xl border flex flex-col justify-between ${
                  monthlyStatus.overall_status === "fully_paid"
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : monthlyStatus.overall_status === "partially_paid"
                      ? "bg-amber-500/10 border-amber-500/30"
                      : "bg-rose-500/10 border-rose-500/30"
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-medium text-neutral-400">
                  <span>Month Status ({monthlyStatus.period_label})</span>
                  {monthlyStatus.overall_status === "fully_paid" && (
                    <span className="text-emerald-400 font-bold uppercase tracking-wider text-[10px]">
                      PAID
                    </span>
                  )}
                  {monthlyStatus.overall_status === "partially_paid" && (
                    <span className="text-amber-400 font-bold uppercase tracking-wider text-[10px]">
                      PARTIAL
                    </span>
                  )}
                  {monthlyStatus.overall_status === "unpaid" && (
                    <span className="text-rose-400 font-bold uppercase tracking-wider text-[10px]">
                      UNPAID
                    </span>
                  )}
                </div>

                <div className="mt-1 flex items-center gap-2">
                  {monthlyStatus.overall_status === "fully_paid" && (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-xs font-semibold text-emerald-300">
                        Fully Paid — {monthlyStatus.paid_count}/
                        {monthlyStatus.total_active_staff} Staff Disbursed
                      </span>
                    </>
                  )}
                  {monthlyStatus.overall_status === "partially_paid" && (
                    <>
                      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-xs font-semibold text-amber-300">
                        Partially Paid — {monthlyStatus.paid_count} Paid,{" "}
                        {monthlyStatus.unpaid_count} Pending
                      </span>
                    </>
                  )}
                  {monthlyStatus.overall_status === "unpaid" && (
                    <>
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span className="text-xs font-semibold text-rose-300">
                        Unpaid / Due — {monthlyStatus.total_active_staff} Staff
                        Pending
                      </span>
                    </>
                  )}
                </div>
              </motion.div>

              {/* Status 2: Current Date (Today's) Payroll Status */}
              <motion.div
                whileHover={{ scale: 1.01 }}
                className={`p-3 rounded-xl border flex flex-col justify-between ${
                  monthlyStatus.today_status.is_paid
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : "bg-neutral-950/70 border-neutral-800"
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-medium text-neutral-400">
                  <span>
                    Today's Status ({monthlyStatus.today_status.formatted})
                  </span>
                  {monthlyStatus.today_status.is_paid ? (
                    <span className="text-emerald-400 font-bold uppercase tracking-wider text-[10px]">
                      PAID TODAY
                    </span>
                  ) : (
                    <span className="text-neutral-500 font-medium text-[10px]">
                      NOT PAID TODAY
                    </span>
                  )}
                </div>

                <div className="mt-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {monthlyStatus.today_status.is_paid ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-xs font-semibold text-emerald-300 truncate">
                          {monthlyStatus.today_status.payments_count}{" "}
                          {monthlyStatus.today_status.payments_count === 1
                            ? "salary"
                            : "salaries"}{" "}
                          disbursed today (
                          {formatCurrency(
                            monthlyStatus.today_status.total_paid,
                            currencySymbol,
                          )}
                          )
                        </span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4 text-neutral-500 shrink-0" />
                        <span className="text-xs text-neutral-400">
                          No disbursements recorded today
                        </span>
                      </>
                    )}
                  </div>

                  {!monthlyStatus.today_status.is_paid && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={() => handleOpenPaySalary()}
                      className="px-2 py-0.5 text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded transition-colors shrink-0 cursor-pointer"
                    >
                      + Pay Today
                    </motion.button>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-2xl pt-1">
              <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1 font-mono">
                <span>
                  Disbursed:{" "}
                  {formatCurrency(monthlyStatus.total_paid, currencySymbol)} (
                  {monthlyStatus.percent_paid}%)
                </span>
                <span>
                  Liability:{" "}
                  {formatCurrency(
                    monthlyStatus.total_commitment,
                    currencySymbol,
                  )}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-neutral-950 border border-neutral-800 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min(100, monthlyStatus.percent_paid)}%`,
                  }}
                  transition={{ type: "spring", damping: 20, stiffness: 120 }}
                  className={`h-full rounded-full ${
                    monthlyStatus.overall_status === "fully_paid"
                      ? "bg-emerald-400"
                      : monthlyStatus.overall_status === "partially_paid"
                        ? "bg-amber-400"
                        : "bg-rose-500"
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Right: Quick Stat Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-3 shrink-0">
            {/* Monthly Liability */}
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ duration: 0.15 }}
              className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 text-center"
            >
              <div className="text-[11px] font-medium text-neutral-400">
                Total Liability
              </div>
              <div className="text-base font-bold text-neutral-100 font-mono tabular-nums mt-1">
                {formatCurrency(monthlyStatus.total_commitment, currencySymbol)}
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5">
                {monthlyStatus.total_active_staff} active staff
              </div>
            </motion.div>

            {/* Total Paid */}
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ duration: 0.15 }}
              className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 text-center"
            >
              <div className="text-[11px] font-medium text-emerald-400">
                Total Disbursed
              </div>
              <div className="text-base font-bold text-emerald-400 font-mono tabular-nums mt-1">
                {formatCurrency(monthlyStatus.total_paid, currencySymbol)}
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5">
                {monthlyStatus.paid_count} staff paid
                {monthlyStatus.total_deductions > 0 && (
                  <span className="text-amber-400/90 ml-1">
                    (-
                    {formatCurrency(
                      monthlyStatus.total_deductions,
                      currencySymbol,
                    )}{" "}
                    ded.)
                  </span>
                )}
              </div>
            </motion.div>

            {/* Pending Dues */}
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ duration: 0.15 }}
              className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 text-center"
            >
              <div
                className={`text-[11px] font-medium ${
                  monthlyStatus.total_pending > 0
                    ? "text-rose-400"
                    : "text-emerald-400"
                }`}
              >
                Pending Dues
              </div>
              <div
                className={`text-base font-bold font-mono tabular-nums mt-1 ${
                  monthlyStatus.total_pending > 0
                    ? "text-rose-400"
                    : "text-emerald-400"
                }`}
              >
                {formatCurrency(monthlyStatus.total_pending, currencySymbol)}
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5">
                {monthlyStatus.unpaid_count} pending
              </div>
            </motion.div>

            {/* Today's Paid */}
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ duration: 0.15 }}
              className={`p-3.5 rounded-xl border text-center ${
                monthlyStatus.today_status.is_paid
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-neutral-950 border-neutral-800"
              }`}
            >
              <div
                className={`text-[11px] font-medium ${
                  monthlyStatus.today_status.is_paid
                    ? "text-emerald-400"
                    : "text-neutral-400"
                }`}
              >
                Disbursed Today
              </div>
              <div
                className={`text-base font-bold font-mono tabular-nums mt-1 ${
                  monthlyStatus.today_status.is_paid
                    ? "text-emerald-300"
                    : "text-neutral-400"
                }`}
              >
                {monthlyStatus.today_status.is_paid
                  ? formatCurrency(
                      monthlyStatus.today_status.total_paid,
                      currencySymbol,
                    )
                  : "$0"}
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5">
                {monthlyStatus.today_status.payments_count}{" "}
                {monthlyStatus.today_status.payments_count === 1
                  ? "payment"
                  : "payments"}{" "}
                today
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* View Switcher: Monthly Roster Status vs All Disbursements Ledger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.96 }}
            type="button"
            onClick={() => setActiveTab("roster")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeTab === "roster"
                ? "bg-neutral-800 text-neutral-100 shadow-xs"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>
              Staff Status Roster ({monthlyStatus.period_label || "This Month"})
            </span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.96 }}
            type="button"
            onClick={() => setActiveTab("ledger")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeTab === "ledger"
                ? "bg-neutral-800 text-neutral-100 shadow-xs"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Disbursements Audit Ledger ({payments.length})</span>
          </motion.button>
        </div>

        {/* Tab 1 Roster Filter Controls */}
        {activeTab === "roster" && (
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => setRosterStatusFilter("all")}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                rosterStatusFilter === "all"
                  ? "bg-neutral-800 text-neutral-200"
                  : "text-neutral-400 hover:text-neutral-300"
              }`}
            >
              All ({monthlyStatus.total_active_staff})
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => setRosterStatusFilter("unpaid")}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                rosterStatusFilter === "unpaid"
                  ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                  : "text-neutral-400 hover:text-rose-400"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              <span>Due / Unpaid ({monthlyStatus.unpaid_count})</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => setRosterStatusFilter("paid")}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                rosterStatusFilter === "paid"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "text-neutral-400 hover:text-emerald-400"
              }`}
            >
              <Check className="w-3 h-3 text-emerald-400" />
              <span>Paid ({monthlyStatus.paid_count})</span>
            </motion.button>
          </div>
        )}
      </div>

      {/* VIEW 1: Monthly Staff Status Roster */}
      {activeTab === "roster" && (
        <DataTable<StaffMonthlyPayrollStatus>
          data={filteredRoster}
          columns={rosterColumns}
          searchQuery={rosterSearch}
          onSearchChange={setRosterSearch}
          searchPlaceholder={
            isNepali
              ? "कर्मचारीको नाम वा पद खोज्नुहोस्..."
              : "Search staff by name or role..."
          }
          extraActionsSlot={
            <button
              type="button"
              onClick={() => handleOpenPaySalary()}
              className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors shadow-xs cursor-pointer shrink-0"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>{isNepali ? "तलब भुक्तानी" : "Disburse Salary"}</span>
            </button>
          }
          enablePagination={true}
          pageSize={15}
          getRowId={(item) => item.staff_id}
          emptyIcon={Users}
          emptyTitle={
            isNepali ? "कुनै कर्मचारी फेला परेन" : "No staff records found"
          }
          emptyMessage={
            isNepali
              ? "यो वर्गमा कुनै कर्मचारीको विवरण छैन।"
              : "No staff records found in this category."
          }
        />
      )}

      {/* VIEW 2: Historical Disbursements Audit Ledger */}
      {activeTab === "ledger" && (
        <DataTable<SalaryPayment>
          data={filteredPayments}
          columns={ledgerColumns}
          searchQuery={paymentSearch}
          onSearchChange={setPaymentSearch}
          searchPlaceholder={
            isNepali
              ? "कर्मचारीको नाम, महिना, रेफरेन्स खोज्नुहोस्..."
              : "Search payments by staff name, period, reference, or note..."
          }
          filtersSlot={
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Staff Filter */}
              <Select
                value={selectedStaffFilter}
                onChange={(e) =>
                  setSelectedStaffFilter(
                    e.target.value === "all"
                      ? "all"
                      : parseInt(e.target.value, 10),
                  )
                }
                containerClassName="w-48"
                sizeVariant="sm"
                options={[
                  {
                    value: "all",
                    label: isNepali ? "सबै कर्मचारीहरू" : "All Employees",
                  },
                  ...staffList.map((s) => ({
                    value: s.id,
                    label: `${s.name} (${s.role})`,
                  })),
                ]}
              />

              {/* Payment Method Filter */}
              <Select
                value={selectedMethodFilter}
                onChange={(e) => setSelectedMethodFilter(e.target.value)}
                containerClassName="w-36"
                sizeVariant="sm"
                options={[
                  {
                    value: "all",
                    label: isNepali ? "सबै विधिहरू" : "All Methods",
                  },
                  ...SALARY_PAYMENT_METHODS.map((m) => ({
                    value: m,
                    label: m,
                  })),
                ]}
              />

              {(selectedStaffFilter !== "all" ||
                selectedMethodFilter !== "all" ||
                paymentSearch) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStaffFilter("all");
                    setSelectedMethodFilter("all");
                    setPaymentSearch("");
                  }}
                  className="text-xs text-neutral-400 hover:text-neutral-200 px-2 py-1 transition-colors cursor-pointer"
                >
                  {isNepali ? "रिसेट" : "Reset"}
                </button>
              )}
            </div>
          }
          extraActionsSlot={
            <button
              type="button"
              onClick={() => handleOpenPaySalary()}
              className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors shadow-xs cursor-pointer shrink-0"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>{isNepali ? "तलब भुक्तानी" : "Disburse Salary"}</span>
            </button>
          }
          enablePagination={true}
          pageSize={15}
          getRowId={(p) => p.id}
          emptyIcon={Receipt}
          emptyTitle={
            isNepali
              ? "कुनै भुक्तानी फेला परेन"
              : "No salary disbursement records found"
          }
          emptyMessage={
            isNepali
              ? "कुनै भुक्तानी रेकर्डहरू फेला परेनन्।"
              : "No salary disbursement records found matching your filters."
          }
          emptyAction={
            <button
              type="button"
              onClick={() => handleOpenPaySalary()}
              className="px-3 py-1.5 text-xs text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg border border-emerald-500/20 transition-colors cursor-pointer"
            >
              + {isNepali ? "तलब भुक्तानी गर्नुहोस्" : "Disburse Salary"}
            </button>
          }
        />
      )}

      {/* Modal: Record Salary Disbursement */}
      <Modal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        title={
          isNepali
            ? "तलब भुक्तानी रेकर्ड गर्नुहोस्"
            : "Record Salary Disbursement"
        }
        subtitle={
          isNepali
            ? "बोनस, कट्टी र स्वचालित खर्च मिलानसहित कर्मचारीको खुद तलब गणना गर्नुहोस्।"
            : "Calculate employee net salary with bonuses, withholdings, and automatic expense synchronization."
        }
        maxWidth="lg"
      >
        <NewPayrollForm
          initialStaff={disbursingStaff}
          defaultPeriod={
            monthlyStatus.period_label ||
            `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`
          }
          monthlyStatus={monthlyStatus}
          staffList={staffList}
          currencySymbol={currencySymbol}
          onClose={() => setIsPayModalOpen(false)}
          loadPayroll={loadData}
          onSuccess={(payment) => {
            setPrintingPayment(payment);
          }}
        />
      </Modal>

      {/* Print Salary Slip Modal */}
      <PrintSalarySlipModal
        isOpen={!!printingPayment}
        onClose={() => setPrintingPayment(null)}
        payment={printingPayment}
        currencySymbol={currencySymbol}
      />

      {/* Confirm Payment Reversal Dialog */}
      <ConfirmDialog
        isOpen={!!paymentToDelete}
        onClose={() => setPaymentToDelete(null)}
        onConfirm={handleDeletePayment}
        title="Reverse Salary Disbursement?"
        message={`Are you sure you want to reverse disbursement #${paymentToDelete?.id} for ${paymentToDelete?.staff_name} (${formatCurrency(paymentToDelete?.net_paid || 0, currencySymbol)})? If synchronized with operating expenses, the expense record will also be removed.`}
        confirmText="Reverse & Delete"
        isDestructive={true}
      />
    </div>
  );
};
