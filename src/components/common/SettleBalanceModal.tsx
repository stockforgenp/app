/**
 * Settle Balance / Payment Receipt Modal
 * Allows receiving payment from a customer or making payment to a vendor
 * to settle outstanding dues (either against the entire account balance or a specific bill).
 */
import React, { useState, useEffect } from "react";
import { Receipt, CheckCircle } from "lucide-react";
import { Modal } from "./Modal.tsx";
import { NepaliDatePicker } from "./NepaliDatePicker.tsx";
import {
  formatCurrency,
  fromMinorUnits,
  toMinorUnits,
  formatForDateTimeLocal,
} from "../../lib/utils/format.ts";
import { recordCustomerPayment } from "../../lib/services/customerService.ts";
import { recordVendorPayment } from "../../lib/services/vendorService.ts";
import { useToast } from "../../context/ToastContext.tsx";
import { useLanguage } from "../../context/LanguageContext.tsx";

interface SettleBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  partyType: "customer" | "vendor";
  partyId: number | null;
  partyName: string;
  partyPhone?: string | null;
  currentDue: number; // in minor units
  currencySymbol: string;
  specificBillId?: number | null;
  specificBillNumber?: string | null;
  onSuccess?: () => void;
}

const PAYMENT_METHODS = [
  "Cash",
  "Bank Transfer",
  "eSewa",
  "Khalti",
  "ConnectIPS",
  "Cheque",
  "Other",
];

export const SettleBalanceModal: React.FC<SettleBalanceModalProps> = ({
  isOpen,
  onClose,
  partyType,
  partyId,
  partyName,
  partyPhone,
  currentDue,
  currencySymbol,
  specificBillId,
  specificBillNumber,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const { isNepali } = useLanguage();

  const [amountInput, setAmountInput] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentDate, setPaymentDate] = useState(
    formatForDateTimeLocal().split("T")[0],
  );
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Pre-fill with the full due amount
      setAmountInput(
        currentDue > 0 ? fromMinorUnits(currentDue).toString() : "",
      );
      setPaymentMethod("Cash");
      setPaymentDate(formatForDateTimeLocal().split("T")[0]);
      setNotes(
        specificBillNumber
          ? isNepali
            ? `बिल #${specificBillNumber} को बक्यौता भुक्तानी`
            : `Settlement for Bill #${specificBillNumber}`
          : isNepali
            ? "खाता हिसाब चुक्ता"
            : "Account balance settlement",
      );
    }
  }, [isOpen, currentDue, specificBillNumber, isNepali]);

  if (!isOpen || !partyId) return null;

  const parsedAmountMinor = (() => {
    const val = parseFloat(amountInput.trim());
    if (isNaN(val) || val <= 0) return 0;
    return toMinorUnits(val);
  })();

  const remainingDueAfter = Math.max(0, currentDue - parsedAmountMinor);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmountMinor <= 0) {
      showToast(
        isNepali
          ? "कृपया मान्य भुक्तानी रकम प्रविष्ट गर्नुहोस्।"
          : "Please enter a valid payment amount.",
        "warning",
      );
      return;
    }

    try {
      setIsSubmitting(true);
      if (partyType === "customer") {
        const payment = recordCustomerPayment({
          customerId: partyId,
          amount: parsedAmountMinor,
          paymentMethod,
          paymentDate,
          note: notes.trim() || undefined,
          saleId: specificBillId || undefined,
        });
        showToast(
          isNepali
            ? `रसिद #${payment.receipt_number}: ${formatCurrency(parsedAmountMinor, currencySymbol)} भुक्तानी प्राप्त भयो!`
            : `Receipt #${payment.receipt_number}: Payment of ${formatCurrency(parsedAmountMinor, currencySymbol)} recorded successfully!`,
          "success",
        );
      } else {
        const payment = recordVendorPayment({
          vendorId: partyId,
          amount: parsedAmountMinor,
          paymentMethod,
          paymentDate,
          note: notes.trim() || undefined,
          purchaseId: specificBillId || undefined,
        });
        showToast(
          isNepali
            ? `भौचर #${payment.receipt_number}: ${formatCurrency(parsedAmountMinor, currencySymbol)} आपूर्तिकर्तालाई भुक्तानी गरियो!`
            : `Voucher #${payment.receipt_number}: Payment of ${formatCurrency(parsedAmountMinor, currencySymbol)} paid to vendor!`,
          "success",
        );
      }

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      showToast((err as Error).message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        partyType === "customer"
          ? isNepali
            ? "ग्राहक हिसाब चुक्ता / बक्यौता भुक्तानी"
            : "Receive Customer Payment / Settle Due"
          : isNepali
            ? "आपूर्तिकर्ता भुक्तानी / हिसाब चुक्ता"
            : "Pay Vendor / Settle Due"
      }
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Party Info & Outstanding Balance Card */}
        <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-neutral-400 font-medium">
                {partyType === "customer"
                  ? isNepali
                    ? "ग्राहकको नाम"
                    : "Customer Name"
                  : isNepali
                    ? "आपूर्तिकर्ताको नाम"
                    : "Vendor Name"}
              </p>
              <p className="text-sm font-bold text-neutral-100 mt-0.5">
                {partyName}
              </p>
              {partyPhone && (
                <p className="text-[11px] font-mono text-neutral-400">
                  {partyPhone}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-neutral-400 font-medium">
                {isNepali ? "कुल बाँकी बक्यौता" : "Current Due Balance"}
              </p>
              <p className="text-base font-bold font-mono text-rose-400 mt-0.5">
                {formatCurrency(currentDue, currencySymbol)}
              </p>
            </div>
          </div>

          {specificBillNumber && (
            <div className="text-[11px] bg-neutral-950 px-2.5 py-1.5 rounded-lg border border-neutral-800 text-sky-400 flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 shrink-0" />
              <span>
                {isNepali
                  ? `विशेष बिल #${specificBillNumber} को लागि भुक्तानी`
                  : `Applying specifically to Bill #${specificBillNumber}`}
              </span>
            </div>
          )}
        </div>

        {/* Payment Amount Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
            <span>
              {isNepali ? "भुक्तानी रकम (Amount)" : "Payment Amount"} *
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setAmountInput(fromMinorUnits(currentDue).toString())
                }
                className="text-[10px] text-emerald-400 hover:underline cursor-pointer"
              >
                {isNepali ? "पूरा रकम" : "Full Due"}
              </button>
              {currentDue > 0 && (
                <>
                  <span className="text-neutral-600">|</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAmountInput(
                        fromMinorUnits(Math.round(currentDue / 2)).toString(),
                      )
                    }
                    className="text-[10px] text-sky-400 hover:underline cursor-pointer"
                  >
                    50%
                  </button>
                </>
              )}
            </div>
          </label>
          <div className="relative">
            <input
              type="number"
              step="any"
              min="0"
              required
              placeholder="0.00"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm font-mono font-bold text-emerald-400 bg-neutral-900 border border-neutral-700 rounded-lg focus:outline-none focus:border-emerald-500"
              autoFocus
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-neutral-500 pointer-events-none">
              {currencySymbol}
            </span>
          </div>

          {/* Balance projection after this payment */}
          <div className="flex items-center justify-between text-[11px] text-neutral-400 px-1 pt-0.5">
            <span>
              {isNepali
                ? "भुक्तानी पश्चात बाँकी रहने रकम"
                : "Remaining Due After"}
              :
            </span>
            <span
              className={`font-mono font-semibold ${remainingDueAfter === 0 ? "text-emerald-400" : "text-amber-400"}`}
            >
              {formatCurrency(remainingDueAfter, currencySymbol)}
              {remainingDueAfter === 0 && (
                <span className="ml-1 text-[10px] text-emerald-400">
                  ({isNepali ? "पूर्ण चुक्ता" : "Fully Settled"})
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Date and Payment Method */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">
              {isNepali ? "भुक्तानी मिति" : "Payment Date"} *
            </label>
            <NepaliDatePicker
              value={paymentDate}
              onChange={(d) => setPaymentDate(d)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">
              {isNepali ? "भुक्तानी माध्यम" : "Payment Method"}
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:border-emerald-500"
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Notes / Remarks */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-300">
            {isNepali ? "कैफियत / विवरण (Notes)" : "Notes / Remarks"}
          </label>
          <input
            type="text"
            placeholder={
              isNepali
                ? "उदा. नगद प्राप्त, अनलाइन भुक्तानी..."
                : "e.g. Cash received, bank reference..."
            }
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:border-emerald-500 placeholder-neutral-600"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer"
          >
            {isNepali ? "रद्द गर्नुहोस्" : "Cancel"}
          </button>
          <button
            type="submit"
            disabled={isSubmitting || parsedAmountMinor <= 0}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
          >
            <CheckCircle className="w-4 h-4" />
            <span>
              {isSubmitting
                ? isNepali
                  ? "सुरक्षित गर्दै..."
                  : "Saving..."
                : isNepali
                  ? "भुक्तानी दर्ता गर्नुहोस्"
                  : "Confirm Settlement"}
            </span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
