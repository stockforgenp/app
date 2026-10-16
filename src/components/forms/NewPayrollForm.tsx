/**
 * New Payroll / Salary Disbursement Form Component
 * Isolated form for calculating and recording employee salary disbursements,
 * bonuses, deductions, and automatic overhead expense synchronization.
 */
import React, { useState, useEffect, useMemo } from "react";
import {
  AlertCircle,
  CreditCard,
  DollarSign,
  Calendar,
  Users,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import {
  Staff,
  StaffMonthlyPayrollStatus,
  MonthlyPayrollSummary,
  SalaryPayment,
  RecordSalaryInput,
} from "../../types/index.ts";
import {
  getAllStaff,
  recordSalaryPayment,
  SALARY_PAYMENT_METHODS,
  MONTH_NAMES,
} from "../../lib/services/staffService.ts";
import {
  formatCurrency,
  formatDate,
  toMinorUnits,
  fromMinorUnits,
  getTodayISODate,
} from "../../lib/utils/format.ts";
import { useToast } from "../../context/ToastContext.tsx";
import { useLanguage } from "../../context/LanguageContext.tsx";
import { Input } from "../common/Input.tsx";
import { Select } from "../common/Select.tsx";
import { NepaliDatePicker } from "../common/NepaliDatePicker.tsx";

export interface NewPayrollFormProps {
  initialStaff?: Staff | StaffMonthlyPayrollStatus | null;
  defaultPeriod?: string;
  monthlyStatus?: MonthlyPayrollSummary | null;
  staffList?: Staff[];
  currencySymbol: string;
  onClose: () => void;
  loadPayroll?: () => void;
  onSuccess?: (payment: SalaryPayment) => void;
}

export const NewPayrollForm: React.FC<NewPayrollFormProps> = ({
  initialStaff,
  defaultPeriod,
  monthlyStatus,
  staffList: externalStaffList,
  currencySymbol,
  onClose,
  loadPayroll,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const { isNepali } = useLanguage();

  // Internal or passed staff list
  const [internalStaffList, setInternalStaffList] = useState<Staff[]>([]);

  useEffect(() => {
    if (externalStaffList && externalStaffList.length > 0) {
      setInternalStaffList(externalStaffList);
    } else {
      try {
        const staff = getAllStaff();
        setInternalStaffList(staff);
      } catch (err) {
        console.error("Failed to load staff list for payroll form:", err);
      }
    }
  }, [externalStaffList]);

  const employees = externalStaffList && externalStaffList.length > 0
    ? externalStaffList
    : internalStaffList;

  // Form Fields State
  const [payStaffId, setPayStaffId] = useState<number>(0);
  const [payBaseAmount, setPayBaseAmount] = useState<string>("0");
  const [payBonus, setPayBonus] = useState<string>("0");
  const [payDeductions, setPayDeductions] = useState<string>("0");
  const [payDate, setPayDate] = useState<string>(getTodayISODate());
  const [payPeriod, setPayPeriod] = useState<string>("");
  const [payMethod, setPayMethod] = useState<string>(SALARY_PAYMENT_METHODS[0]);
  const [payReference, setPayReference] = useState<string>("");
  const [payNote, setPayNote] = useState<string>("");
  const [paySyncWithExpenses, setPaySyncWithExpenses] = useState<boolean>(true);
  const [payFormError, setPayFormError] = useState<string | null>(null);

  // Initialize or re-sync form fields when initialStaff / defaultPeriod changes
  useEffect(() => {
    let chosenId = 0;
    let chosenBase = "0";

    if (initialStaff) {
      chosenId = "staff_id" in initialStaff ? initialStaff.staff_id : initialStaff.id;
      chosenBase = fromMinorUnits(initialStaff.base_salary).toString();
    } else if (employees.length > 0) {
      const firstActive = employees.find((s) => s.status === "active") || employees[0];
      if (firstActive) {
        chosenId = firstActive.id;
        chosenBase = fromMinorUnits(firstActive.base_salary).toString();
      }
    }

    setPayStaffId(chosenId);
    setPayBaseAmount(chosenBase);
    setPayBonus("0");
    setPayDeductions("0");
    setPayDate(getTodayISODate());
    setPayPeriod(
      defaultPeriod ||
        monthlyStatus?.period_label ||
        `${MONTH_NAMES[new Date().getMonth()]} ${new Date().getFullYear()}`
    );
    setPayMethod(SALARY_PAYMENT_METHODS[0]);
    setPayReference("");
    setPayNote("");
    setPaySyncWithExpenses(true);
    setPayFormError(null);
  }, [initialStaff, defaultPeriod, monthlyStatus, employees]);

  // When staff selection changes in modal
  const handlePayStaffChange = (staffId: number) => {
    setPayStaffId(staffId);
    const found = employees.find((s) => s.id === staffId);
    if (found) {
      setPayBaseAmount(fromMinorUnits(found.base_salary).toString());
    }
  };

  // Check if selected staff is already paid for the current target period
  const alreadyPaidWarning = useMemo(() => {
    if (!payStaffId || !monthlyStatus?.staff_statuses) return null;
    const match = monthlyStatus.staff_statuses.find(
      (s) => s.staff_id === payStaffId && s.is_paid
    );
    if (match && match.payment) {
      return {
        date: match.payment_date,
        amount: match.amount_paid || 0,
        period: match.payment_period,
      };
    }
    return null;
  }, [payStaffId, monthlyStatus]);

  // Live Net Pay Calculation
  const modalNetPay = useMemo(() => {
    const b = parseFloat(payBaseAmount) || 0;
    const bonus = parseFloat(payBonus) || 0;
    const ded = parseFloat(payDeductions) || 0;
    return Math.max(0, b + bonus - ded);
  }, [payBaseAmount, payBonus, payDeductions]);

  // Save Salary Payment
  const handleSaveSalaryPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setPayFormError(null);

    if (!payStaffId) {
      setPayFormError(
        isNepali ? "कृपया कर्मचारी चयन गर्नुहोस्।" : "Please select an employee."
      );
      return;
    }

    const baseNum = parseFloat(payBaseAmount);
    if (isNaN(baseNum) || baseNum <= 0) {
      setPayFormError(
        isNepali
          ? "आधारभूत तलब शून्य भन्दा बढी हुनुपर्दछ।"
          : "Base wage must be greater than zero."
      );
      return;
    }

    const bonusNum = parseFloat(payBonus) || 0;
    const deductionsNum = parseFloat(payDeductions) || 0;

    if (modalNetPay <= 0) {
      setPayFormError(
        isNepali
          ? "खुद भुक्तानी योग्य तलब शून्य भन्दा बढी हुनुपर्दछ।"
          : "Net payable salary must be greater than zero."
      );
      return;
    }

    if (!payPeriod.trim()) {
      setPayFormError(
        isNepali
          ? "कृपया भुक्तानी अवधि (जस्तै भदौ २०८१) प्रविष्ट गर्नुहोस्।"
          : "Please enter a payment period (e.g. September 2026)."
      );
      return;
    }

    try {
      const input: RecordSalaryInput = {
        staff_id: payStaffId,
        amount: toMinorUnits(baseNum),
        bonus: toMinorUnits(bonusNum),
        deductions: toMinorUnits(deductionsNum),
        payment_date: payDate,
        payment_period: payPeriod.trim(),
        payment_method: payMethod,
        reference: payReference.trim() || null,
        note: payNote.trim() || null,
        syncWithExpenses: paySyncWithExpenses,
      };

      const payment = recordSalaryPayment(input);
      showToast(
        isNepali
          ? `${payment.staff_name} लाई ${formatCurrency(payment.net_paid, currencySymbol)} तलब भुक्तानी गरियो`
          : `Disbursed ${formatCurrency(payment.net_paid, currencySymbol)} to ${payment.staff_name}`,
        "success"
      );

      onClose();
      loadPayroll?.();
      onSuccess?.(payment);
    } catch (err: any) {
      setPayFormError(err.message || "Failed to record salary disbursement");
    }
  };

  return (
    <form onSubmit={handleSaveSalaryPayment} className="space-y-4">
      {payFormError && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{payFormError}</span>
        </div>
      )}

      {/* Already Paid Warning Notice if applicable */}
      {alreadyPaidWarning && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
          <div>
            <span className="font-semibold">
              {isNepali ? "सूचना:" : "Notice:"}
            </span>{" "}
            {isNepali
              ? `यस कर्मचारीलाई ${alreadyPaidWarning.period} अवधिको लागि (${formatCurrency(alreadyPaidWarning.amount, currencySymbol)} मिति ${alreadyPaidWarning.date ? formatDate(alreadyPaidWarning.date) : ""}) मा पहिले नै तलब भुक्तानी भइसकेको छ। यदि थप भुक्तानी गर्न चाहनुहुन्छ भने मात्र पुष्टि गर्नुहोस्।`
              : `This employee has already been disbursed a salary for ${alreadyPaidWarning.period} (${formatCurrency(alreadyPaidWarning.amount, currencySymbol)} on ${alreadyPaidWarning.date ? formatDate(alreadyPaidWarning.date) : ""}). Confirm only if you intend to disburse an additional payment.`}
          </div>
        </div>
      )}

      {/* Select Staff Member */}
      <Select
        label={
          <>
            <Users className="w-3.5 h-3.5 text-neutral-400" />
            <span>{isNepali ? "कर्मचारी चयन गर्नुहोस्" : "Select Employee"}</span>
            <span className="text-rose-400">*</span>
          </>
        }
        required
        value={payStaffId}
        onChange={(e) => handlePayStaffChange(parseInt(e.target.value, 10))}
        placeholder={isNepali ? "-- कर्मचारी छान्नुहोस् --" : "-- Choose Staff Member --"}
        options={employees.map((s) => ({
          value: s.id,
          label: `${s.name} (${s.role}) — ${formatCurrency(s.base_salary, currencySymbol)}/mo${s.status === "inactive" ? (isNepali ? " (निष्क्रिय)" : " (Inactive)") : ""}`,
        }))}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input
          label={
            <>
              <DollarSign className="w-3.5 h-3.5 text-neutral-400" />
              <span>{isNepali ? "आधारभूत तलब" : "Base Wage"}</span>
              <span className="text-rose-400">*</span>
            </>
          }
          type="number"
          step="0.01"
          min="0"
          mono
          required
          value={payBaseAmount}
          onChange={(e) => setPayBaseAmount(e.target.value)}
        />

        <Input
          label={
            <span className="text-emerald-400">
              {isNepali ? "बोनस / भत्ता" : "Bonus / Allowance"}
            </span>
          }
          type="number"
          step="0.01"
          min="0"
          mono
          className="text-emerald-400"
          value={payBonus}
          onChange={(e) => setPayBonus(e.target.value)}
        />

        <Input
          label={
            <span className="text-rose-400">
              {isNepali ? "कट्टी / अग्रिम रकम" : "Deductions / Adv."}
            </span>
          }
          type="number"
          step="0.01"
          min="0"
          mono
          className="text-rose-400"
          value={payDeductions}
          onChange={(e) => setPayDeductions(e.target.value)}
        />
      </div>

      {/* Net Pay Callout Banner */}
      <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-between">
        <div className="text-xs text-neutral-400 font-medium">
          {isNepali ? "खुद भुक्तानी रकम" : "Net Disbursed Amount"}
        </div>
        <div className="text-base font-bold text-emerald-400 font-mono tabular-nums">
          {formatCurrency(toMinorUnits(modalNetPay), currencySymbol)}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label={
            <>
              <Calendar className="w-3.5 h-3.5 text-neutral-400" />
              <span>{isNepali ? "भुक्तानी अवधि" : "Payment Period"}</span>
              <span className="text-rose-400">*</span>
            </>
          }
          type="text"
          required
          placeholder={isNepali ? "उदा. भदौ २०८१" : "e.g. September 2026"}
          value={payPeriod}
          onChange={(e) => setPayPeriod(e.target.value)}
        />

        <div>
          <label className="text-xs font-medium text-neutral-300 mb-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-neutral-400" />
            <span>{isNepali ? "भुक्तानी मिति" : "Disbursement Date"}</span>
            <span className="text-rose-400">*</span>
          </label>
          <NepaliDatePicker
            value={payDate}
            onChange={(adDate) => setPayDate(adDate)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Payment Method */}
        <Select
          label={
            <>
              <CreditCard className="w-3.5 h-3.5 text-neutral-400" />
              <span>{isNepali ? "भुक्तानी विधि" : "Payment Method"}</span>
            </>
          }
          value={payMethod}
          onChange={(e) => setPayMethod(e.target.value)}
          options={SALARY_PAYMENT_METHODS.map((m) => ({
            value: m,
            label: m,
          }))}
        />

        <Input
          label={
            <>
              <FileSpreadsheet className="w-3.5 h-3.5 text-neutral-400" />
              <span>
                {isNepali ? "चेक / कारोबार नम्बर" : "Cheque / Txn Ref"}
              </span>
              <span className="text-neutral-500 text-[10px]">
                {isNepali ? "(वैकल्पिक)" : "(optional)"}
              </span>
            </>
          }
          type="text"
          mono
          placeholder={isNepali ? "उदा. TXN-99824" : "e.g. TXN-99824"}
          value={payReference}
          onChange={(e) => setPayReference(e.target.value)}
        />
      </div>

      {/* Notes */}
      <Input
        label={
          <>
            <FileText className="w-3.5 h-3.5 text-neutral-400" />
            <span>{isNepali ? "कैफियत / टिप्पणी" : "Voucher Notes"}</span>
            <span className="text-neutral-500 text-[10px]">
              {isNepali ? "(वैकल्पिक)" : "(optional)"}
            </span>
          </>
        }
        type="text"
        placeholder={
          isNepali ? "उदा. चाडपर्व भत्ता समावेश गरिएको" : "e.g. Includes festival holiday bonus"
        }
        value={payNote}
        onChange={(e) => setPayNote(e.target.value)}
      />

      {/* Sync With Expenses Toggle */}
      <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg flex items-center justify-between">
        <div className="text-xs">
          <div className="font-semibold text-neutral-200">
            {isNepali ? "खर्च खातासँग मिलान गर्नुहोस्" : "Sync with Expense Ledger"}
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5">
            {isNepali
              ? 'खर्च सूचीमा स्वतः "Salaries & Wages" शीर्षकमा रेकर्ड गर्दछ'
              : 'Automatically records an overhead expense under "Salaries & Wages"'}
          </div>
        </div>
        <input
          type="checkbox"
          id="payrollSyncExpenses"
          checked={paySyncWithExpenses}
          onChange={(e) => setPaySyncWithExpenses(e.target.checked)}
          className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
        />
      </div>

      {/* Buttons */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
        >
          {isNepali ? "रद्द गर्नुहोस्" : "Cancel"}
        </button>
        <button
          type="submit"
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
        >
          <CreditCard className="w-4 h-4" />
          <span>{isNepali ? "भुक्तानी पुष्टि गर्नुहोस्" : "Confirm Disbursement"}</span>
        </button>
      </div>
    </form>
  );
};
