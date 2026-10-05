/**
 * Expenses & Operating Overheads View
 * Complete management of overhead expenses (rent, utilities, payroll, packaging, etc.)
 * Integrates with offline SQLite database and updates analytics/profit figures.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ReceiptText,
  PlusCircle,
  Trash2,
  Edit2,
  DollarSign,
  TrendingDown,
  PieChart,
  AlertCircle,
  Copy,
} from 'lucide-react';
import { Expense, ExpenseSummary } from '../../types/index.ts';
import {
  getExpenses,
  getExpenseSummary,
  createExpense,
  updateExpense,
  deleteExpense,
  getAllCategories,
  CreateExpenseInput,
  UpdateExpenseInput,
} from '../../lib/services/expenseService.ts';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_PAYMENT_METHODS,
} from '../../constants/index.ts';
import {
  formatCurrency,
  formatDate,
  formatNumber,
  toMinorUnits,
  fromMinorUnits,
  getTodayISODate,
} from '../../lib/utils/format.ts';
import { Modal } from '../common/Modal.tsx';
import { ActionMenu } from '../common/ActionMenu.tsx';
import { Select } from '../common/Select.tsx';
import { Input, Textarea } from '../common/Input.tsx';
import { DataTable, Column } from '../common/DataTable.tsx';
import { getExpenseColumns } from '../../columns/index.ts';
import { DatePreset, calculateDateRange } from '../../lib/utils/dateFilters.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { subscribeToDbChanges } from '../../lib/db/sqliteEngine.ts';

interface ExpensesViewProps {
  currencySymbol: string;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({ currencySymbol }) => {
  const { showToast } = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_EXPENSE_CATEGORIES);
  const [summary, setSummary] = useState<ExpenseSummary>({
    total_expenses: 0,
    expense_count: 0,
    categoryBreakdown: [],
  });

  // Filter state
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  // Form fields
  const [formCategory, setFormCategory] = useState(DEFAULT_EXPENSE_CATEGORIES[0]);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(getTodayISODate());
  const [formPaymentMethod, setFormPaymentMethod] = useState(DEFAULT_PAYMENT_METHODS[0]);
  const [formNote, setFormNote] = useState('');
  const [formReceiptRef, setFormReceiptRef] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Compute effective date range based on preset
  const computedDateRange = useMemo(() => {
    if (datePreset === 'all') {
      return { start: undefined, end: undefined };
    }
    if (datePreset === 'custom') {
      return { start: startDate || undefined, end: endDate || undefined };
    }
    const range = calculateDateRange(datePreset);
    return { start: range.startDate || undefined, end: range.endDate || undefined };
  }, [datePreset, startDate, endDate]);

  const loadData = useCallback(() => {
    try {
      const { start, end } = computedDateRange;
      const loadedExpenses = getExpenses({
        startDate: start,
        endDate: end,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        search: search.trim() ? search.trim() : undefined,
      });
      setExpenses(loadedExpenses);

      const loadedSummary = getExpenseSummary(start, end);
      setSummary(loadedSummary);

      const loadedCategories = getAllCategories();
      setCategories(loadedCategories);
    } catch (e) {
      console.error('Error loading expenses:', e);
    }
  }, [computedDateRange, selectedCategory, search]);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToDbChanges(() => {
      loadData();
    });
    return unsubscribe;
  }, [loadData]);

  const handleOpenCreateModal = () => {
    setEditingExpense(null);
    setFormCategory(DEFAULT_EXPENSE_CATEGORIES[0]);
    setIsCustomCategory(false);
    setCustomCategoryInput('');
    setFormAmount('');
    setFormDate(getTodayISODate());
    setFormPaymentMethod(DEFAULT_PAYMENT_METHODS[0]);
    setFormNote('');
    setFormReceiptRef('');
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    const isStandard = DEFAULT_EXPENSE_CATEGORIES.includes(expense.category);
    if (isStandard) {
      setFormCategory(expense.category);
      setIsCustomCategory(false);
      setCustomCategoryInput('');
    } else {
      setFormCategory('__custom__');
      setIsCustomCategory(true);
      setCustomCategoryInput(expense.category);
    }
    setFormAmount(fromMinorUnits(expense.amount).toString());
    setFormDate(expense.date.split('T')[0]);
    setFormPaymentMethod(expense.payment_method || DEFAULT_PAYMENT_METHODS[0]);
    setFormNote(expense.note || '');
    setFormReceiptRef(expense.receipt_reference || '');
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const categoryToSave = isCustomCategory ? customCategoryInput.trim() : formCategory.trim();
    if (!categoryToSave) {
      setFormError('Please select or specify an expense category.');
      return;
    }

    const numAmount = parseFloat(formAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError('Please enter a valid expense amount greater than 0.');
      return;
    }

    if (!formDate.trim()) {
      setFormError('Please select a valid date.');
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
        showToast(`Expense #${editingExpense.id} updated successfully.`, 'success');
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
        showToast('Expense recorded successfully.', 'success');
      }

      setIsFormModalOpen(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save expense');
    }
  };

  const handleDeleteExpense = () => {
    if (!expenseToDelete) return;
    try {
      deleteExpense(expenseToDelete.id);
      showToast(`Expense #${expenseToDelete.id} deleted.`, 'info');
      setExpenseToDelete(null);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete expense', 'error');
    }
  };

  // Top category details
  const topCategory = useMemo(() => {
    if (summary.categoryBreakdown.length === 0) return null;
    return summary.categoryBreakdown[0];
  }, [summary]);

  const averageExpense = useMemo(() => {
    if (summary.expense_count === 0) return 0;
    return Math.round(summary.total_expenses / summary.expense_count);
  }, [summary]);

  const expenseColumns = useMemo<Column<Expense>[]>(
    () =>
      getExpenseColumns({
        currencySymbol,
        onEdit: handleOpenEditModal,
        onDelete: (exp) => setExpenseToDelete(exp),
        onCopyReceiptRef: (ref) => {
          navigator.clipboard.writeText(ref);
          showToast('Receipt reference copied', 'info');
        },
      }),
    [currencySymbol, showToast],
  );

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-neutral-100">Expenses & Overheads</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
              Offline Tracker
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Track operating expenses, rent, utility bills, packaging, and calculate accurate net profits
          </p>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Record Expense</span>
          </motion.button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Expenses */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">Total Overheads</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-400 font-mono tabular-nums">
              {formatCurrency(summary.total_expenses, currencySymbol)}
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">
              For selected timeframe ({summary.expense_count} {summary.expense_count === 1 ? 'entry' : 'entries'})
            </div>
          </div>
        </motion.div>

        {/* Total Entries Count */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">Recorded Expenses</span>
            <div className="w-8 h-8 rounded-lg bg-neutral-800 border border-neutral-700/60 flex items-center justify-center text-neutral-300">
              <ReceiptText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-neutral-100 font-mono tabular-nums">
              {formatNumber(summary.expense_count)}
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">
              Active ledger transactions
            </div>
          </div>
        </motion.div>

        {/* Top Spending Category */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">Largest Cost Center</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <PieChart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-base font-bold text-neutral-200 truncate">
              {topCategory ? topCategory.category : 'None'}
            </div>
            <div className="text-[11px] text-neutral-400 mt-1 font-mono">
              {topCategory
                ? `${formatCurrency(topCategory.amount, currencySymbol)} (${topCategory.percentage.toFixed(0)}%)`
                : 'No expenses recorded'}
            </div>
          </div>
        </motion.div>

        {/* Average Expense Entry */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">Average per Expense</span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-neutral-200 font-mono tabular-nums">
              {formatCurrency(averageExpense, currencySymbol)}
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">
              Mean transaction size
            </div>
          </div>
        </motion.div>
      </div>

      {/* Category Breakdown Progress Bars (if data exists) */}
      {summary.categoryBreakdown.length > 0 && (
        <div className="p-5 bg-neutral-900 border border-neutral-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">
              Category Distribution
            </span>
            <span className="text-[11px] text-neutral-400">
              {summary.categoryBreakdown.length} active {summary.categoryBreakdown.length === 1 ? 'category' : 'categories'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {summary.categoryBreakdown.slice(0, 6).map((cat) => (
              <div
                key={cat.category}
                onClick={() => setSelectedCategory(selectedCategory === cat.category ? 'all' : cat.category)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedCategory === cat.category
                    ? 'bg-neutral-800 border-emerald-500/50'
                    : 'bg-neutral-950/50 border-neutral-800/80 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-neutral-300 font-medium truncate max-w-[160px]">
                    {cat.category}
                  </span>
                  <span className="text-neutral-400 font-mono text-[11px]">
                    {formatCurrency(cat.amount, currencySymbol)}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-400 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(4, cat.percentage))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-neutral-400 mt-1.5">
                  <span>{cat.count} {cat.count === 1 ? 'record' : 'records'}</span>
                  <span>{cat.percentage.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unified Shared DataTable with Search, Date Filter, Category Filter, and Pagination */}
      <DataTable<Expense>
        data={expenses}
        columns={expenseColumns}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search note, receipt ref, or category..."
        dateFilterConfig={{
          preset: datePreset,
          onPresetChange: (p, start, end) => {
            setDatePreset(p);
            setStartDate(start);
            setEndDate(end);
          },
          startDate,
          endDate,
          onStartDateChange: setStartDate,
          onEndDateChange: setEndDate,
          hasActiveFilters: Boolean(
            startDate ||
              endDate ||
              search ||
              selectedCategory !== 'all' ||
              datePreset !== 'all',
          ),
          onClear: () => {
            setDatePreset('all');
            setStartDate('');
            setEndDate('');
            setSearch('');
            setSelectedCategory('all');
          },
        }}
        filtersSlot={
          <Select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            containerClassName="w-full sm:w-48"
            sizeVariant="sm"
            options={[
              { value: 'all', label: 'All Categories' },
              ...categories.map((cat) => ({ value: cat, label: cat })),
            ]}
          />
        }
        extraActionsSlot={
          <button
            onClick={handleOpenCreateModal}
            className="px-3.5 py-1.5 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 shrink-0"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Record Expense</span>
          </button>
        }
        emptyIcon={ReceiptText}
        emptyTitle="No expenses recorded yet"
        emptyMessage="Log overheads such as shop rent, power bills, inventory delivery charges, or employee wages."
        emptyAction={
          <button
            onClick={handleOpenCreateModal}
            className="px-3.5 py-1.5 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Record Expense</span>
          </button>
        }
        enablePagination={true}
        pageSize={10}
        pageSizeOptions={[10, 25, 50, 100]}
      />

      {/* Record / Edit Expense Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingExpense ? `Edit Expense #${editingExpense.id}` : 'Record New Expense'}
        subtitle="Track shop overheads, utilities, inventory supplies, and bills"
        maxWidth="md"
      >
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
              label="Expense Category"
              required
              value={isCustomCategory ? '__custom__' : formCategory}
              onChange={(e) => {
                if (e.target.value === '__custom__') {
                  setIsCustomCategory(true);
                } else {
                  setIsCustomCategory(false);
                  setFormCategory(e.target.value);
                }
              }}
              options={[
                ...DEFAULT_EXPENSE_CATEGORIES.map((cat) => ({ value: cat, label: cat })),
                { value: '__custom__', label: '+ Custom Category...' },
              ]}
            />

            {isCustomCategory && (
              <Input
                type="text"
                placeholder="Enter custom category name..."
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
                  Amount ({currencySymbol}) <span className="text-rose-400">*</span>
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

            <Input
              label={
                <>
                  Date <span className="text-rose-400">*</span>
                </>
              }
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              required
            />
          </div>

          {/* Payment Method & Receipt Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Payment Method"
              value={formPaymentMethod}
              onChange={(e) => setFormPaymentMethod(e.target.value)}
              options={DEFAULT_PAYMENT_METHODS.map((pm) => ({ value: pm, label: pm }))}
            />

            <Input
              label="Receipt / Bill Reference #"
              type="text"
              mono
              placeholder="e.g. INV-9021 or Bill #"
              value={formReceiptRef}
              onChange={(e) => setFormReceiptRef(e.target.value)}
            />
          </div>

          {/* Description Note */}
          <Textarea
            label="Description / Notes"
            rows={3}
            placeholder="e.g. Paid electricity bill for warehouse unit A..."
            value={formNote}
            onChange={(e) => setFormNote(e.target.value)}
          />

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => setIsFormModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
            >
              {editingExpense ? 'Save Changes' : 'Record Expense'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!expenseToDelete}
        onClose={() => setExpenseToDelete(null)}
        title="Delete Expense Record"
        subtitle="This action is irreversible and will adjust operating profits"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-neutral-300 leading-relaxed">
            Are you sure you want to delete expense record{' '}
            <span className="font-semibold text-neutral-100">#{expenseToDelete?.id}</span> (
            <span className="text-rose-400 font-mono">
              {expenseToDelete ? formatCurrency(expenseToDelete.amount, currencySymbol) : ''}
            </span>{' '}
            for <span className="text-neutral-100">{expenseToDelete?.category}</span>)?
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => setExpenseToDelete(null)}
              className="px-3.5 py-1.5 text-xs font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteExpense}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors cursor-pointer"
            >
              Delete Expense
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
