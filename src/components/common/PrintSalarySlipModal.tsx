/**
 * Printable Salary Slip & Payment Voucher Modal
 * Prints professional employee pay slips with earnings, bonus, deductions, and signature blocks.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Printer,
  X,
  Copy,
  Check,
  Building,
  UserCheck,
  Calendar,
  DollarSign,
  FileCheck2,
} from 'lucide-react';
import { SalaryPayment, AppSettings } from '../../types/index.ts';
import { getSettings } from '../../lib/services/settingsService.ts';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
} from '../../lib/utils/format.ts';
import { useToast } from '../../context/ToastContext.tsx';

interface PrintSalarySlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: SalaryPayment | null;
  currencySymbol: string;
}

export const PrintSalarySlipModal: React.FC<PrintSalarySlipModalProps> = ({
  isOpen,
  onClose,
  payment,
  currencySymbol,
}) => {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const settings: AppSettings = getSettings();

  const storeName = settings.store_name || 'StockForge Retail';
  const storeAddress = settings.store_address;
  const storePhone = settings.store_phone;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    if (!payment) return;
    try {
      let text = `*SALARY PAYMENT SLIP - ${storeName.toUpperCase()}*\n`;
      if (storeAddress) text += `${storeAddress}\n`;
      if (storePhone) text += `Tel: ${storePhone}\n`;
      text += `-----------------------------------------\n`;
      text += `Voucher #: PAY-${payment.id.toString().padStart(5, '0')}\n`;
      text += `Date: ${formatDate(payment.payment_date)}\n`;
      text += `Period: ${payment.payment_period}\n`;
      text += `Employee: ${payment.staff_name || 'Staff'}\n`;
      text += `Designation: ${payment.staff_role || 'Staff'}\n`;
      text += `Payment Method: ${payment.payment_method}\n`;
      if (payment.reference) text += `Ref / Txn #: ${payment.reference}\n`;
      text += `-----------------------------------------\n`;
      text += `Base Salary:     ${formatCurrency(payment.amount, currencySymbol)}\n`;
      if (payment.bonus > 0) {
        text += `Bonus / Allow:  +${formatCurrency(payment.bonus, currencySymbol)}\n`;
      }
      if (payment.deductions > 0) {
        text += `Deductions:     -${formatCurrency(payment.deductions, currencySymbol)}\n`;
      }
      text += `=========================================\n`;
      text += `*NET AMOUNT PAID: ${formatCurrency(payment.net_paid, currencySymbol)}*\n`;
      text += `=========================================\n`;
      if (payment.note) text += `Notes: ${payment.note}\n`;
      text += `-----------------------------------------\n`;

      navigator.clipboard.writeText(text);
      setCopied(true);
      showToast('Salary slip text copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('Failed to copy text', 'error');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && payment && (
        <motion.div
          key="salary-slip-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs"
          onClick={onClose}
        >
          <motion.div
            key="salary-slip-panel"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 380, mass: 0.6 }}
            className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col max-h-[94vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-neutral-800 shrink-0 bg-neutral-900">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <FileCheck2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                <span>Salary Payment Slip</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                  #PAY-{payment.id.toString().padStart(5, '0')}
                </span>
              </h3>
              <p className="text-[11px] text-neutral-400">
                Official employee salary disbursement voucher
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Printable Slip Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-neutral-950/70 flex justify-center items-start">
          {/* THE PRINTABLE SLIP */}
          <div
            id="printable-bill"
            className="w-full max-w-lg p-7 bg-white text-gray-900 shadow-xl rounded-xl font-sans text-xs border border-gray-200"
            style={{ color: '#111827' }}
          >
            {/* Header */}
            <div className="text-center pb-4 border-b border-gray-300">
              <h2 className="text-base font-black tracking-tight text-gray-900 uppercase">
                {storeName}
              </h2>
              {storeAddress && (
                <p className="text-[11px] text-gray-600 mt-0.5 whitespace-pre-line leading-tight">
                  {storeAddress}
                </p>
              )}
              {storePhone && (
                <p className="text-[11px] text-gray-600 mt-0.5">
                  Tel: {storePhone}
                </p>
              )}
              <div className="mt-2.5 inline-block px-3 py-1 bg-gray-100 border border-gray-300 text-gray-800 rounded text-[11px] font-bold tracking-wider uppercase">
                Salary Disbursement Voucher / Pay Slip
              </div>
            </div>

            {/* Voucher Metadata */}
            <div className="grid grid-cols-2 gap-3 py-3 border-b border-gray-200 text-[11px]">
              <div>
                <span className="text-gray-500 font-medium block">Employee Name:</span>
                <span className="text-sm font-bold text-gray-900">{payment.staff_name}</span>
                <span className="text-[10px] text-gray-600 block mt-0.5">
                  Designation: <span className="font-semibold text-gray-800">{payment.staff_role}</span>
                </span>
              </div>
              <div className="text-right">
                <span className="text-gray-500 font-medium block">Voucher No:</span>
                <span className="font-mono font-bold text-gray-900">
                  PAY-{payment.id.toString().padStart(5, '0')}
                </span>
                <span className="text-[10px] text-gray-600 block mt-0.5">
                  Date: <span className="font-medium text-gray-800">{formatDate(payment.payment_date)}</span>
                </span>
              </div>
            </div>

            <div className="py-2.5 border-b border-gray-200 text-[11px] flex justify-between bg-gray-50/80 px-2 rounded my-1">
              <div>
                <span className="text-gray-500">Pay Period: </span>
                <span className="font-bold text-gray-900">{payment.payment_period}</span>
              </div>
              <div>
                <span className="text-gray-500">Payment Mode: </span>
                <span className="font-semibold text-gray-800">{payment.payment_method}</span>
                {payment.reference && (
                  <span className="font-mono text-gray-600 text-[10px] ml-1">
                    (Ref: {payment.reference})
                  </span>
                )}
              </div>
            </div>

            {/* Salary Calculation Breakdown */}
            <div className="py-3 border-b border-gray-300">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-600 uppercase text-[10px] tracking-wider">
                    <th className="pb-1.5 font-bold">Salary Component</th>
                    <th className="pb-1.5 font-bold text-center">Type</th>
                    <th className="pb-1.5 font-bold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-2 text-gray-900 font-medium">Basic Earned Wage</td>
                    <td className="py-2 text-center text-gray-600 text-[10px]">Earnings (+)</td>
                    <td className="py-2 text-right font-mono font-semibold text-gray-900">
                      {formatCurrency(payment.amount, currencySymbol)}
                    </td>
                  </tr>

                  {payment.bonus > 0 && (
                    <tr>
                      <td className="py-2 text-gray-900 font-medium">Bonus / Incentives / Overtime</td>
                      <td className="py-2 text-center text-emerald-700 text-[10px] font-semibold">Addition (+)</td>
                      <td className="py-2 text-right font-mono font-semibold text-emerald-700">
                        +{formatCurrency(payment.bonus, currencySymbol)}
                      </td>
                    </tr>
                  )}

                  {payment.deductions > 0 && (
                    <tr>
                      <td className="py-2 text-gray-900 font-medium">Deductions / Advance / Penalties</td>
                      <td className="py-2 text-center text-rose-700 text-[10px] font-semibold">Deduction (-)</td>
                      <td className="py-2 text-right font-mono font-semibold text-rose-700">
                        -{formatCurrency(payment.deductions, currencySymbol)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Net Total Box */}
            <div className="py-3 bg-gray-50 px-3 rounded-lg border border-gray-200 mt-2 flex justify-between items-center">
              <div>
                <span className="text-xs font-black text-gray-900 uppercase tracking-tight block">
                  Net Amount Disbursed:
                </span>
                <span className="text-[10px] text-gray-500">
                  Full & Final settlement for {payment.payment_period}
                </span>
              </div>
              <div className="text-right">
                <span className="text-lg font-black font-mono text-gray-950">
                  {formatCurrency(payment.net_paid, currencySymbol)}
                </span>
              </div>
            </div>

            {/* Note if present */}
            {payment.note && (
              <div className="mt-2 text-[10px] text-gray-600 italic bg-gray-50/50 p-2 rounded border border-gray-100">
                <span className="font-semibold text-gray-700 not-italic">Notes: </span>
                {payment.note}
              </div>
            )}

            {/* Dual Signature Blocks */}
            <div className="grid grid-cols-2 gap-8 pt-10 text-[10px]">
              <div className="text-center">
                <div className="border-t border-gray-400 pt-1.5 font-bold text-gray-800">
                  Authorized Signatory
                </div>
                <div className="text-gray-500 text-[9px]">Store Management / Accounts</div>
              </div>
              <div className="text-center">
                <div className="border-t border-gray-400 pt-1.5 font-bold text-gray-800">
                  Employee Signature
                </div>
                <div className="text-gray-500 text-[9px]">Acknowledged & Received</div>
              </div>
            </div>

            {/* Slip footer note */}
            <div className="pt-6 text-center text-[9px] text-gray-500">
              System generated salary voucher on {formatDateTime(new Date().toISOString())} via StockForge Desktop
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-neutral-900 border-t border-neutral-800 shrink-0">
          <button
            type="button"
            onClick={handleCopyText}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-300 hover:text-neutral-100 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer"
            title="Copy pay slip text for WhatsApp / SMS"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy for WhatsApp</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>

            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Salary Slip</span>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
  );
};
