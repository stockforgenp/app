/**
 * Table Column Definitions: Payroll Roster & Salary Disbursements
 */
import {
  CreditCard,
  Printer,
  Copy,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { motion } from "framer-motion";
import { StaffMonthlyPayrollStatus, SalaryPayment } from "../types/index.ts";
import { Column } from "../components/common/DataTable.tsx";
import { ActionMenu } from "../components/common/ActionMenu.tsx";
import { formatCurrency, formatDate, capitalizeWords } from "../helpers/formatHelpers.ts";

export interface PayrollRosterColumnsOptions {
  currencySymbol: string;
  isNepali?: boolean;
  todayDate: string;
  periodLabel: string;
  onPaySalary: (item: StaffMonthlyPayrollStatus) => void;
  onPrintSlip: (payment: SalaryPayment) => void;
  onCopyReference?: (ref: string) => void;
  onDeletePayment?: (payment: SalaryPayment) => void;
}

export function getPayrollRosterColumns(
  options: PayrollRosterColumnsOptions,
): Column<StaffMonthlyPayrollStatus>[] {
  const {
    currencySymbol,
    isNepali = false,
    todayDate,
    periodLabel,
    onPaySalary,
    onPrintSlip,
    onCopyReference,
    onDeletePayment,
  } = options;

  return [
    {
      id: "staff",
      header: isNepali ? "कर्मचारी र पद" : "Employee & Role",
      sortable: true,
      sortKey: (item) => capitalizeWords(item.staff_name),
      accessor: (item) => (
        <div>
          <div className="font-semibold text-neutral-200 capitalize">
            {capitalizeWords(item.staff_name)}
          </div>
          <div className="text-[11px] text-neutral-400 mt-0.5 capitalize">
            {capitalizeWords(item.staff_role)} ·{" "}
            <span className="font-mono">ID #{item.staff_id}</span>
          </div>
        </div>
      ),
    },
    {
      id: "base_salary",
      header: isNepali ? "मासिक आधार तलब" : "Monthly Base Wage",
      align: "right",
      sortable: true,
      sortKey: (item) => item.base_salary,
      accessor: (item) => (
        <div className="text-right font-mono font-medium text-neutral-300 tabular-nums whitespace-nowrap">
          {formatCurrency(item.base_salary, currencySymbol)}
          <span className="text-[10px] text-neutral-500 font-sans block">
            per {item.salary_type}
          </span>
        </div>
      ),
    },
    {
      id: "status",
      header: isNepali
        ? `${periodLabel} अवस्था`
        : `${periodLabel} Status`,
      align: "center",
      sortable: true,
      sortKey: (item) => (item.is_paid ? 1 : 0),
      accessor: (item) => {
        if (item.is_paid) {
          const isToday = item.payment?.payment_date === todayDate;
          return isToday ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isNepali ? "आज भुक्तानी भयो" : "PAID TODAY"}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isNepali ? "भुक्तानी भयो" : "PAID"}</span>
            </span>
          );
        }

        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
            <span>{isNepali ? "बाँकी / भुक्तानी बाँकी" : "DUE / UNPAID"}</span>
          </span>
        );
      },
    },
    {
      id: "details",
      header: isNepali ? "भुक्तानी विवरण" : "Disbursement Details",
      accessor: (item) => {
        if (item.is_paid && item.payment) {
          const isToday = item.payment.payment_date === todayDate;
          return (
            <div className="space-y-0.5">
              <div className="text-[11px] text-neutral-200 font-medium">
                Paid on {formatDate(item.payment.payment_date)} via{" "}
                {item.payment.payment_method}
                {isToday && (
                  <span className="ml-1.5 text-[10px] text-emerald-400 font-semibold uppercase">
                    ({isNepali ? "आज" : "Today"})
                  </span>
                )}
              </div>
              {(item.payment.deductions > 0 || item.payment.bonus > 0) && (
                <div className="flex items-center gap-2 text-[10px] font-mono mt-0.5">
                  {item.payment.deductions > 0 && (
                    <span className="text-amber-400">
                      {isNepali ? "कट्टी" : "Ded."}: -{formatCurrency(item.payment.deductions, currencySymbol)}
                    </span>
                  )}
                  {item.payment.bonus > 0 && (
                    <span className="text-emerald-400">
                      {isNepali ? "बोनस" : "Bonus"}: +{formatCurrency(item.payment.bonus, currencySymbol)}
                    </span>
                  )}
                </div>
              )}
              {item.payment.reference && (
                <div className="text-[10px] font-mono text-neutral-500">
                  Ref: {item.payment.reference}
                </div>
              )}
            </div>
          );
        }

        return (
          <div className="text-[11px] text-neutral-500 italic">
            {isNepali
              ? `${periodLabel} को लागि कुनै भुक्तानी रेकर्ड छैन`
              : `No payment recorded for ${periodLabel}`}
          </div>
        );
      },
    },
    {
      id: "amount_paid",
      header: isNepali ? "कुल भुक्तानी" : "Disbursed Net",
      align: "right",
      sortable: true,
      sortKey: (item) => item.amount_paid || 0,
      accessor: (item) => (
        <div className="text-right font-mono font-bold tabular-nums whitespace-nowrap">
          {item.is_paid ? (
            <span className="text-emerald-400">
              {formatCurrency(item.amount_paid || 0, currencySymbol)}
            </span>
          ) : (
            <span className="text-neutral-500">—</span>
          )}
        </div>
      ),
    },
    {
      id: "actions",
      header: isNepali ? "कार्य" : "Actions",
      align: "right",
      accessor: (item) => (
        <div className="flex items-center justify-end gap-2">
          {!item.is_paid ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => onPaySalary(item)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>{isNepali ? "तलब भुक्तानी" : "Pay Salary"}</span>
            </motion.button>
          ) : (
            item.payment && (
              <>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={() => onPrintSlip(item.payment!)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded border border-emerald-500/20 transition-colors cursor-pointer"
                  title="Print Voucher"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isNepali ? "रसिद" : "Slip"}</span>
                </motion.button>
                <ActionMenu
                  align="right"
                  items={[
                    {
                      label: isNepali ? "तलब रसिद छाप्नुहोस्" : "Print Pay Slip",
                      icon: Printer,
                      color: "emerald",
                      action: () => onPrintSlip(item.payment!),
                    },
                    item.payment.reference && onCopyReference
                      ? {
                          label: isNepali ? "रेफरेन्स कपी गर्नुहोस्" : "Copy Reference",
                          icon: Copy,
                          color: "sky",
                          action: () =>
                            onCopyReference(item.payment!.reference!),
                        }
                      : null,
                    onDeletePayment
                      ? {
                          label: isNepali
                            ? "भुक्तानी उल्टाउनुहोस् / मेटाउनुहोस्"
                            : "Reverse / Delete Payment",
                          icon: Trash2,
                          color: "rose",
                          isDestructive: true,
                          divider: true,
                          action: () => onDeletePayment(item.payment!),
                        }
                      : null,
                  ]}
                />
              </>
            )
          )}
        </div>
      ),
    },
  ];
}

export interface SalaryDisbursementColumnsOptions {
  currencySymbol: string;
  isNepali?: boolean;
  onPrintSlip: (payment: SalaryPayment) => void;
  onCopyReference?: (ref: string) => void;
  onDeletePayment: (payment: SalaryPayment) => void;
}

export function getSalaryDisbursementColumns(
  options: SalaryDisbursementColumnsOptions,
): Column<SalaryPayment>[] {
  const {
    currencySymbol,
    isNepali = false,
    onPrintSlip,
    onCopyReference,
    onDeletePayment,
  } = options;

  return [
    {
      id: "id",
      header: isNepali ? "भुक्तानी #" : "Disbursement #",
      sortable: true,
      sortKey: (p) => p.id,
      accessor: (p) => (
        <span className="font-mono font-bold text-neutral-300">#{p.id}</span>
      ),
    },
    {
      id: "date",
      header: isNepali ? "मिति र अवधि" : "Date & Period",
      sortable: true,
      sortKey: (p) => p.payment_date,
      accessor: (p) => (
        <div>
          <div className="font-semibold text-neutral-200">
            {p.payment_period}
          </div>
          <div className="text-[11px] font-mono text-neutral-500 mt-0.5">
            {formatDate(p.payment_date)}
          </div>
        </div>
      ),
    },
    {
      id: "staff",
      header: isNepali ? "कर्मचारी र पद" : "Employee & Role",
      sortable: true,
      sortKey: (p) => capitalizeWords(p.staff_name),
      accessor: (p) => (
        <div>
          <div className="font-semibold text-neutral-200 capitalize">{capitalizeWords(p.staff_name)}</div>
          <div className="text-[11px] text-neutral-400 mt-0.5 capitalize">
            {capitalizeWords(p.staff_role)}
          </div>
        </div>
      ),
    },
    {
      id: "method",
      header: isNepali ? "विधि र रेफरेन्स" : "Method & Ref",
      accessor: (p) => (
        <div className="text-neutral-300">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-800 text-neutral-300 border border-neutral-700/60">
            {p.payment_method}
          </span>
          {p.reference && (
            <span className="block text-[10px] text-neutral-500 font-mono mt-0.5">
              Ref: {p.reference}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "amount",
      header: isNepali ? "आधार तलब" : "Base Salary",
      align: "right",
      sortable: true,
      sortKey: (p) => p.amount,
      accessor: (p) => (
        <div className="text-right font-mono text-neutral-400 tabular-nums whitespace-nowrap">
          {formatCurrency(p.amount, currencySymbol)}
        </div>
      ),
    },
    {
      id: "adjustments",
      header: isNepali ? "समायोजन (+ / -)" : "Adj (+ / -)",
      align: "right",
      accessor: (p) => (
        <div className="text-right font-mono text-[11px] tabular-nums whitespace-nowrap">
          {p.bonus > 0 && (
            <span className="text-emerald-400 block font-medium">
              +{formatCurrency(p.bonus, currencySymbol)}
            </span>
          )}
          {p.deductions > 0 && (
            <span className="text-rose-400 block font-medium">
              -{formatCurrency(p.deductions, currencySymbol)}
            </span>
          )}
          {p.bonus === 0 && p.deductions === 0 && (
            <span className="text-neutral-600">—</span>
          )}
        </div>
      ),
    },
    {
      id: "net_paid",
      header: isNepali ? "भुक्तानी गरिएको नेट" : "Net Paid",
      align: "right",
      sortable: true,
      sortKey: (p) => p.net_paid,
      accessor: (p) => (
        <div className="text-right font-mono font-bold text-emerald-400 tabular-nums whitespace-nowrap">
          {formatCurrency(p.net_paid, currencySymbol)}
        </div>
      ),
    },
    {
      id: "actions",
      header: isNepali ? "कार्य" : "Actions",
      align: "right",
      accessor: (p) => (
        <ActionMenu
          align="right"
          items={[
            {
              label: isNepali ? "तलब रसिद छाप्नुहोस्" : "Print Pay Slip",
              icon: Printer,
              color: "emerald",
              action: () => onPrintSlip(p),
            },
            p.reference && onCopyReference
              ? {
                  label: isNepali ? "रेफरेन्स कपी गर्नुहोस्" : "Copy Reference",
                  icon: Copy,
                  color: "sky",
                  action: () => onCopyReference(p.reference!),
                }
              : null,
            {
              label: isNepali
                ? "भुक्तानी उल्टाउनुहोस् / मेटाउनुहोस्"
                : "Reverse / Delete Payment",
              icon: Trash2,
              color: "rose",
              isDestructive: true,
              divider: true,
              action: () => onDeletePayment(p),
            },
          ]}
        />
      ),
    },
  ];
}

