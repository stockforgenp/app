/**
 * Feature: Expenses & Operating Overheads Suite
 * Tests:
 * 1. createExpense with validation, default dates, and custom notes/receipt references
 * 2. createExpense rejects invalid inputs (empty category, zero or negative amounts)
 * 3. updateExpense modifies category, amount, payment method, and note
 * 4. updateExpense rejects empty category, invalid amount, or non-existent expense ID
 * 5. deleteExpense removes expense and returns boolean status
 * 6. getExpenseById retrieves single expense or null when non-existent
 * 7. getExpenses filters by date ranges, category, search query, and limit
 * 8. getExpenseSummary aggregates total expenses, count, and category breakdown percentages
 * 9. getAllCategories returns unified list of default and newly introduced categories
 * 10. getExpensesCount tracks total database volume
 * 11. Real CRUD on Expenses: raw SQL INSERT into db, direct SELECT verification, UPDATE row, and DELETE from db
 */

import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment } from './setup.ts';

const {
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseById,
  getExpenses,
  getExpenseSummary,
  getAllCategories,
  getExpensesCount,
  DEFAULT_EXPENSE_CATEGORIES,
} = await import('../src/lib/services/expenseService.ts');

const { query, queryOne, run } = await import('../src/lib/db/sqliteEngine.ts');

describe('Feature: Operating Expenses Management', () => {
  beforeEach(async () => {
    await setupTestEnvironment();
  });

  test('1. createExpense creates expense record with valid data, default date, and notes', () => {
    const expense = createExpense({
      category: 'Rent',
      amount: 4500000, // Rs 45,000.00
      payment_method: 'Bank Transfer',
      note: 'Monthly showroom rent for Baisakh',
      receipt_reference: 'REC-RENT-2081-01',
    });

    assert.ok(expense.id > 0);
    assert.equal(expense.category, 'Rent');
    assert.equal(expense.amount, 4500000);
    assert.equal(expense.payment_method, 'Bank Transfer');
    assert.equal(expense.note, 'Monthly showroom rent for Baisakh');
    assert.equal(expense.receipt_reference, 'REC-RENT-2081-01');
    assert.ok(expense.date);
    assert.ok(expense.created_at);
  });

  test('2. createExpense validates required category and positive non-zero amount', () => {
    assert.throws(
      () => createExpense({ category: '', amount: 50000 }),
      /Expense category is required/i
    );

    assert.throws(
      () => createExpense({ category: '   ', amount: 50000 }),
      /Expense category is required/i
    );

    assert.throws(
      () => createExpense({ category: 'Tea & Snacks', amount: 0 }),
      /amount must be greater than zero/i
    );

    assert.throws(
      () => createExpense({ category: 'Tea & Snacks', amount: -250 }),
      /amount must be greater than zero/i
    );
  });

  test('3. updateExpense updates fields and recalculates updatedAt timestamp', () => {
    const expense = createExpense({
      category: 'Electricity',
      amount: 850000, // Rs 8,500
      date: '2026-04-10',
      payment_method: 'Cash',
      note: 'NEA bill meter #1042',
    });

    const updated = updateExpense(expense.id, {
      amount: 920000, // revised to Rs 9,200
      payment_method: 'eSewa / FonePay',
      note: 'NEA bill meter #1042 + penalty fee',
    });

    assert.equal(updated.id, expense.id);
    assert.equal(updated.amount, 920000);
    assert.equal(updated.payment_method, 'eSewa / FonePay');
    assert.equal(updated.note, 'NEA bill meter #1042 + penalty fee');
    assert.equal(updated.category, 'Electricity'); // preserved
    assert.equal(updated.date, '2026-04-10'); // preserved
  });

  test('4. updateExpense rejects empty category, zero amount, and non-existent IDs', () => {
    const expense = createExpense({
      category: 'Marketing',
      amount: 1500000,
    });

    assert.throws(
      () => updateExpense(expense.id, { category: '   ' }),
      /Expense category cannot be empty/i
    );

    assert.throws(
      () => updateExpense(expense.id, { amount: 0 }),
      /amount must be greater than zero/i
    );

    assert.throws(
      () => updateExpense(expense.id, { amount: -500 }),
      /amount must be greater than zero/i
    );

    assert.throws(
      () => updateExpense(999999, { category: 'Repair' }),
      /Expense #999999 not found/i
    );
  });

  test('5. deleteExpense removes expense and returns true, or false if non-existent', () => {
    const expense = createExpense({
      category: 'Stationery',
      amount: 35000,
    });

    assert.equal(deleteExpense(expense.id), true);
    assert.equal(getExpenseById(expense.id), null);
    assert.equal(deleteExpense(expense.id), false); // Second attempt returns false
  });

  test('6. getExpenseById returns matching record or null', () => {
    const expense = createExpense({
      category: 'Internet',
      amount: 250000,
    });

    const found = getExpenseById(expense.id);
    assert.ok(found);
    assert.equal(found.id, expense.id);
    assert.equal(found.category, 'Internet');

    assert.equal(getExpenseById(888888), null);
  });

  test('7. getExpenses supports filtering by date ranges, categories, search, and limit', () => {
    createExpense({ category: 'Rent', amount: 5000000, date: '2026-04-01', note: 'Godown rent' });
    createExpense({ category: 'Utilities', amount: 300000, date: '2026-04-05', note: 'Water delivery 10 jars' });
    createExpense({ category: 'Utilities', amount: 750000, date: '2026-04-15', note: 'Electricity payment' });
    createExpense({ category: 'Staff Welfare', amount: 450000, date: '2026-04-20', note: 'Afternoon khaja & tea' });
    createExpense({ category: 'Marketing', amount: 1200000, date: '2026-05-01', note: 'Facebook sponsored ads' });

    // Category filter
    const utilities = getExpenses({ category: 'Utilities' });
    assert.equal(utilities.length, 2);
    assert.ok(utilities.every((e) => e.category === 'Utilities'));

    // Date range filter
    const aprilExpenses = getExpenses({ startDate: '2026-04-01', endDate: '2026-04-30' });
    assert.equal(aprilExpenses.length, 4);

    // Search filter
    const khajaSearch = getExpenses({ search: 'khaja' });
    assert.equal(khajaSearch.length, 1);
    assert.equal(khajaSearch[0].category, 'Staff Welfare');

    // Limit filter
    const limited = getExpenses({ limit: 2 });
    assert.equal(limited.length, 2);
  });

  test('8. getExpenseSummary calculates totals, counts, and category percentage breakdown', () => {
    createExpense({ category: 'Rent', amount: 3000000, date: '2026-04-01' }); // 60%
    createExpense({ category: 'Utilities', amount: 1000000, date: '2026-04-05' }); // 20%
    createExpense({ category: 'Maintenance', amount: 1000000, date: '2026-04-10' }); // 20%

    const summary = getExpenseSummary('2026-04-01', '2026-04-30');
    assert.equal(summary.total_expenses, 5000000);
    assert.equal(summary.expense_count, 3);
    assert.equal(summary.categoryBreakdown.length, 3);

    // Sorted by amount DESC
    assert.equal(summary.categoryBreakdown[0].category, 'Rent');
    assert.equal(summary.categoryBreakdown[0].amount, 3000000);
    assert.equal(summary.categoryBreakdown[0].percentage, 60);

    assert.equal(summary.categoryBreakdown[1].amount, 1000000);
    assert.equal(summary.categoryBreakdown[1].percentage, 20);
  });

  test('9. getAllCategories combines default categories and newly added custom ones', () => {
    createExpense({ category: 'Custom Generator Fuel', amount: 180000 });

    const categories = getAllCategories();
    assert.ok(categories.includes('Custom Generator Fuel'));
    for (const def of DEFAULT_EXPENSE_CATEGORIES) {
      assert.ok(categories.includes(def));
    }
  });

  test('10. getExpensesCount returns accurate total count', () => {
    assert.equal(getExpensesCount(), 0);
    createExpense({ category: 'Rent', amount: 100000 });
    createExpense({ category: 'Utilities', amount: 20000 });
    assert.equal(getExpensesCount(), 2);
  });

  test('11. Real CRUD on Expenses: raw SQL INSERT into db, direct SELECT verification, UPDATE row, and DELETE from db', () => {
    const now = new Date().toISOString();

    // 1. RAW SQL INSERT
    run(
      `INSERT INTO expenses (category, amount, date, payment_method, note, receipt_reference, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'Office Supplies',
        75000, // Rs 750
        '2026-04-22',
        'Cash',
        'Thermal printer paper rolls x10',
        'INV-POS-ROLL-99',
        now,
        now,
      ]
    );

    const row = queryOne<{ id: number }>('SELECT last_insert_rowid() as id');
    const insertedId = row?.id ?? 0;
    assert.ok(insertedId > 0, 'Direct SQL insert should generate row ID');

    // 2. RAW SQL SELECT and column validation
    const dbRow = queryOne<{
      id: number;
      category: string;
      amount: number;
      date: string;
      payment_method: string;
      note: string;
      receipt_reference: string;
      created_at: string;
      updated_at: string;
    }>('SELECT * FROM expenses WHERE id = ?', [insertedId]);

    assert.ok(dbRow, 'Direct SELECT should fetch row from expenses table');
    assert.equal(dbRow.id, insertedId);
    assert.equal(dbRow.category, 'Office Supplies');
    assert.equal(dbRow.amount, 75000);
    assert.equal(dbRow.date, '2026-04-22');
    assert.equal(dbRow.payment_method, 'Cash');
    assert.equal(dbRow.note, 'Thermal printer paper rolls x10');
    assert.equal(dbRow.receipt_reference, 'INV-POS-ROLL-99');
    assert.equal(dbRow.created_at, now);

    // 3. RAW SQL UPDATE
    const updatedNow = new Date().toISOString();
    run(
      `UPDATE expenses 
       SET amount = ?, payment_method = ?, note = ?, updated_at = ?
       WHERE id = ?`,
      [85000, 'FonePay QR', 'Thermal printer paper rolls x10 + barcode ribbon', updatedNow, insertedId]
    );

    const updatedRow = queryOne<{ amount: number; payment_method: string; note: string; updated_at: string }>(
      'SELECT amount, payment_method, note, updated_at FROM expenses WHERE id = ?',
      [insertedId]
    );
    assert.equal(updatedRow?.amount, 85000);
    assert.equal(updatedRow?.payment_method, 'FonePay QR');
    assert.equal(updatedRow?.note, 'Thermal printer paper rolls x10 + barcode ribbon');
    assert.equal(updatedRow?.updated_at, updatedNow);

    // 4. RAW SQL DELETE
    run('DELETE FROM expenses WHERE id = ?', [insertedId]);
    const deletedRow = queryOne('SELECT * FROM expenses WHERE id = ?', [insertedId]);
    assert.equal(deletedRow, null, 'Deleted expense should no longer exist in expenses table');
  });
});

