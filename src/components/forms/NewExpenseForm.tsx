/**
 * New Expense Form Component
 * Isolated form for creating and editing business overheads and expenses.
 */
import React, { useState, useEffect } from "react";
import {
  AlertCircle,
  Tag,
  DollarSign,
  Calendar,
  CreditCard,
  FileText,
  FileSpreadsheet,
} from "lucide-react";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_PAYMENT_METHODS,
} from "../../constants/index.ts";
import { useToast } from "../../context/ToastContext.tsx";
import { useLanguage } from "../../context/LanguageContext.tsx";
import {
  fromMinorUnits,
  toMinorUnits,
  getTodayISODate,
} from "../../lib/utils/format.ts";
import {
  createExpense,
  updateExpense,
  CreateExpenseInput,
  UpdateExpenseInput,
} from "../../lib/services/expenseService.ts";
import { Expense } from "../../types/index.ts";
import { Input, Textarea } from "../common/Input.tsx";
import { Select } from "../common/Select.tsx";
import { NepaliDatePicker } from "../common/NepaliDatePicker.tsx";

export interface NewExpenseFormProps {
  editingExpense: Expense | null;
  onClose: () => void;
  currencySymbol: string;
  loadExpenses?: () => void;
  onSuccess?: () => void;
  availableCategories?: string[];
}

export const NewExpenseForm: React.FC<NewExpenseFormProps> = ({
  editingExpense,
  onClose,
  currencySymbol,
  loadExpenses,
  onSuccess,
  availableCategories,
}) => {
  const { showToast } = useToast();
  const { isNepali } = useLanguage();

  // Categories list
  const categoryOptions =
    availableCategories && availableCategories.length > 0
      ? availableCategories
      : DEFAULT_EXPENSE_CATEGORIES;

  // Form Fields
  const [formCategory, setFormCategory] = useState<string>(
    DEFAULT_EXPENSE_CATEGORIES[0],
  );
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState(getTodayISODate());
  const [formPaymentMethod, setFormPaymentMethod] = useState<string>(
    DEFAULT_PAYMENT_METHODS[0],
  );
  const [formNote, setFormNote] = useState("");
  const [formReceiptRef, setFormReceiptRef] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Sync state when editingExpense changes
  useEffect(() => {
    if (editingExpense) {
      const isStandard = DEFAULT_EXPENSE_CATEGORIES.includes(
        editingExpense.category,
      );
      if (isStandard) {
        setFormCategory(editingExpense.category);
        setIsCustomCategory(false);
        setCustomCategoryInput("");
      } else {
        setFormCategory("__custom__");
        setIsCustomCategory(true);
        setCustomCategoryInput(editingExpense.category);
      }
      setFormAmount(fromMinorUnits(editingExpense.amount).toString());
      setFormDate(
        editingExpense.date
          ? editingExpense.date.split("T")[0]
          : getTodayISODate(),
      );
      setFormPaymentMethod(
        editingExpense.payment_method || DEFAULT_PAYMENT_METHODS[0],
      );
      setFormNote(editingExpense.note || "");
      setFormReceiptRef(editingExpense.receipt_reference || "");
    } else {
      setFormCategory(DEFAULT_EXPENSE_CATEGORIES[0]);
      setIsCustomCategory(false);
      setCustomCategoryInput("");
      setFormAmount("");
      setFormDate(getTodayISODate());
      setFormPaymentMethod(DEFAULT_PAYMENT_METHODS[0]);
      setFormNote("");
      setFormReceiptRef("");
    }
    setFormError(null);
  }, [editingExpense]);

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const categoryToSave = isCustomCategory
      ? customCategoryInput.trim()
      : formCategory.trim();
    if (!categoryToSave) {
      setFormError(
        isNepali
          ? "कृपया खर्चको वर्ग छान्नुहोस् वा लेख्नुहोस्।"
          : "Please select or specify an expense category.",
      );
      return;
    }

    const numAmount = parseFloat(formAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError(
        isNepali
          ? "कृपया ० भन्दा बढी मान्य रकम प्रविष्ट गर्नुहोस्।"
          : "Please enter a valid expense amount greater than 0.",
      );
      return;
    }

    if (!formDate.trim()) {
      setFormError(
        isNepali
          ? "कृपया मान्य मिति चयन गर्नुहोस्।"
          : "Please select a valid date.",
      );
      return;
    }

    const minorAmount = toMinorUnits(numAmount);

    try {
      if (editingExpense) {
        const updateInput: UpdateExpenseInput = {
          category: categoryToSave,
          amount: minorAmount,
          date: formDate,
          payment_method: formPaymentMethod || null,
          note: formNote.trim() || null,
          receipt_reference: formReceiptRef.trim() || null,
        };
        updateExpense(editingExpense.id, updateInput);
        showToast(
          isNepali
            ? `खर्च विवरण #${editingExpense.id} अद्यावधिक गरियो`
            : `Expense #${editingExpense.id} updated successfully.`,
          "success",
        );
      } else {
        const createInput: CreateExpenseInput = {
          category: categoryToSave,
          amount: minorAmount,
          date: formDate,
          payment_method: formPaymentMethod || null,
          note: formNote.trim() || null,
          receipt_reference: formReceiptRef.trim() || null,
        };
        createExpense(createInput);
        showToast(
          isNepali
            ? "नयाँ खर्च रेकर्ड गरियो"
            : "Expense recorded successfully.",
          "success",
        );
      }

      onClose();
      loadExpenses?.();
      onSuccess?.();
    } catch (err: any) {
      setFormError(err.message || "Failed to save expense");
    }
  };

  return (
    <form onSubmit={handleSaveExpense} className="space-y-4">
      {formError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* Category */}
      <div>
        <Select
          label={
            <>
              <Tag className="w-3.5 h-3.5 text-neutral-400" />
              <span>{isNepali ? "खर्चको वर्ग" : "Expense Category"}</span>
              <span className="text-rose-400">*</span>
            </>
          }
          required
          value={isCustomCategory ? "__custom__" : formCategory}
          onChange={(e) => {
            if (e.target.value === "__custom__") {
              setIsCustomCategory(true);
            } else {
              setIsCustomCategory(false);
              setFormCategory(e.target.value);
            }
          }}
          options={[
            ...categoryOptions.map((cat) => ({
              value: cat,
              label: cat,
            })),
            {
              value: "__custom__",
              label: isNepali ? "+ अनुकूलित वर्ग..." : "+ Custom Category...",
            },
          ]}
        />

        {isCustomCategory && (
          <Input
            type="text"
            placeholder={
              isNepali
                ? "नयाँ खर्च वर्गको नाम प्रविष्ट गर्नुहोस्..."
                : "Enter custom category name..."
            }
            value={customCategoryInput}
            onChange={(e) => setCustomCategoryInput(e.target.value)}
            containerClassName="mt-2"
            autoFocus
          />
        )}
      </div>

      {/* Amount & Date in 2 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label={
            <>
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {isNepali
                  ? `रकम (${currencySymbol})`
                  : `Amount (${currencySymbol})`}
              </span>
              <span className="text-rose-400">*</span>
            </>
          }
          type="number"
          step="0.01"
          min="0.01"
          mono
          placeholder="0.00"
          value={formAmount}
          onChange={(e) => setFormAmount(e.target.value)}
          required
        />

        <div>
          <label className="text-xs font-medium text-neutral-300 mb-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-neutral-400" />
            <span>{isNepali ? "मिति" : "Date"}</span>
            <span className="text-rose-400">*</span>
          </label>
          <NepaliDatePicker
            value={formDate}
            onChange={(adDate) => setFormDate(adDate)}
            required
          />
        </div>
      </div>

      {/* Payment Method & Receipt Reference */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select
          label={
            <>
              <CreditCard className="w-3.5 h-3.5 text-neutral-400" />
              <span>{isNepali ? "भुक्तानी विधि" : "Payment Method"}</span>
            </>
          }
          value={formPaymentMethod}
          onChange={(e) => setFormPaymentMethod(e.target.value)}
          options={DEFAULT_PAYMENT_METHODS.map((pm) => ({
            value: pm,
            label: pm,
          }))}
        />

        <Input
          label={
            <>
              <FileSpreadsheet className="w-3.5 h-3.5 text-neutral-400" />
              <span>
                {isNepali ? "रसिद / बिल नम्बर" : "Receipt / Bill Reference #"}
              </span>
            </>
          }
          type="text"
          mono
          placeholder={
            isNepali ? "उदा. INV-9021 वा बिल #" : "e.g. INV-9021 or Bill #"
          }
          value={formReceiptRef}
          onChange={(e) => setFormReceiptRef(e.target.value)}
        />
      </div>

      {/* Description Note */}
      <Textarea
        label={
          <>
            <FileText className="w-3.5 h-3.5 text-neutral-400" />
            <span>{isNepali ? "विवरण / कैफियत" : "Description / Notes"}</span>
          </>
        }
        rows={3}
        placeholder={
          isNepali
            ? "उदा. गोदामको बिजुली महसुल भुक्तानी..."
            : "e.g. Paid electricity bill for warehouse unit A..."
        }
        value={formNote}
        onChange={(e) => setFormNote(e.target.value)}
      />

      {/* Form Actions */}
      <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-800">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
        >
          {isNepali ? "रद्द गर्नुहोस्" : "Cancel"}
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
        >
          {editingExpense
            ? isNepali
              ? "परिवर्तनहरू बचत गर्नुहोस्"
              : "Save Changes"
            : isNepali
              ? "खर्च सुरक्षित गर्नुहोस्"
              : "Record Expense"}
        </button>
      </div>
    </form>
  );
};
