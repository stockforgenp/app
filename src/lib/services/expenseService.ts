/**
 * Expense Management & Operating Overhead Service
 * Provides CRUD operations, category tracking, and financial overhead aggregation.
 */
import { Expense, ExpenseSummary, ExpenseCategoryBreakdown } from '../../types/index.ts';
import { query, queryOne, run } from '../db/sqliteEngine.ts';

export const DEFAULT_EXPENSE_CATEGORIES: string[] = [
  'Rent & Lease',
  'Utilities (Electricity, Water)',
  'Salaries & Wages',
  'Packaging & Bags',
  'Marketing & Advertising',
  'Repairs & Maintenance',
  'Delivery & Transportation',
  'Internet & Software',
  'Taxes & Licensing',
  'Miscellaneous / Other',
];

export const DEFAULT_PAYMENT_METHODS: string[] = [
  'Cash',
  'Bank Transfer',
  'Card',
  'Digital Wallet',
  'Check',
  'Other',
];

export interface CreateExpenseInput {
  category: string;
  amount: number; // in minor units
  date?: string; // YYYY-MM-DD
  payment_method?: string | null;
  note?: string | null;
  receipt_reference?: string | null;
}

export interface UpdateExpenseInput {
  category?: string;
  amount?: number;
  date?: string;
  payment_method?: string | null;
  note?: string | null;
  receipt_reference?: string | null;
}

export function createExpense(input: CreateExpenseInput): Expense {
  const category = input.category?.trim();
  if (!category) {
    throw new Error('Expense category is required');
  }

  const amount = Math.floor(input.amount);
  if (isNaN(amount) || amount <= 0) {
    throw new Error('Expense amount must be greater than zero');
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const date = input.date?.trim() || todayStr;
  const now = new Date().toISOString();

  run(
    `INSERT INTO expenses (category, amount, date, payment_method, note, receipt_reference, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      category,
      amount,
      date,
      input.payment_method?.trim() || null,
      input.note?.trim() || null,
      input.receipt_reference?.trim() || null,
      now,
      now,
    ]
  );

  const row = queryOne<{ id: number }>('SELECT last_insert_rowid() as id');
  const id = row?.id ?? 0;

  const created = getExpenseById(id);
  if (!created) {
    throw new Error('Failed to retrieve newly created expense record');
  }

  return created;
}

export function updateExpense(id: number, input: UpdateExpenseInput): Expense {
  const existing = getExpenseById(id);
  if (!existing) {
    throw new Error(`Expense #${id} not found`);
  }

  const category = input.category !== undefined ? input.category.trim() : existing.category;
  if (!category) {
    throw new Error('Expense category cannot be empty');
  }

  let amount = existing.amount;
  if (input.amount !== undefined) {
    amount = Math.floor(input.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Expense amount must be greater than zero');
    }
  }

  const date = input.date !== undefined ? input.date.trim() : existing.date;
  const paymentMethod = input.payment_method !== undefined ? (input.payment_method?.trim() || null) : existing.payment_method;
  const note = input.note !== undefined ? (input.note?.trim() || null) : existing.note;
  const receiptRef = input.receipt_reference !== undefined ? (input.receipt_reference?.trim() || null) : existing.receipt_reference;
  const now = new Date().toISOString();

  run(
    `UPDATE expenses
     SET category = ?, amount = ?, date = ?, payment_method = ?, note = ?, receipt_reference = ?, updated_at = ?
     WHERE id = ?`,
    [category, amount, date, paymentMethod, note, receiptRef, now, id]
  );

  const updated = getExpenseById(id);
  if (!updated) {
    throw new Error(`Expense #${id} could not be retrieved after update`);
  }

  return updated;
}

export function deleteExpense(id: number): boolean {
  const existing = getExpenseById(id);
  if (!existing) {
    return false;
  }

  run('DELETE FROM expenses WHERE id = ?', [id]);
  return true;
}

export function getExpenseById(id: number): Expense | null {
  return queryOne<Expense>('SELECT * FROM expenses WHERE id = ?', [id]);
}

export function getExpenses(options?: {
  startDate?: string;
  endDate?: string;
  category?: string;
  search?: string;
  limit?: number;
}): Expense[] {
  let sql = 'SELECT * FROM expenses';
  const whereClauses: string[] = [];
  const params: (string | number)[] = [];

  if (options?.startDate) {
    const sDate = options.startDate.includes('T') ? options.startDate.split('T')[0] : options.startDate;
    whereClauses.push('date >= ?');
    params.push(sDate);
  }

  if (options?.endDate) {
    const eDate = options.endDate.includes('T') ? options.endDate.split('T')[0] : options.endDate;
    whereClauses.push('date <= ?');
    params.push(eDate);
  }

  if (options?.category && options.category !== 'all') {
    whereClauses.push('category = ?');
    params.push(options.category);
  }

  if (options?.search && options.search.trim()) {
    whereClauses.push('(CAST(id AS TEXT) LIKE ? OR note LIKE ? OR receipt_reference LIKE ? OR category LIKE ?)');
    const term = `%${options.search.trim()}%`;
    params.push(term, term, term, term);
  }

  if (whereClauses.length > 0) {
    sql += ' WHERE ' + whereClauses.join(' AND ');
  }

  sql += ' ORDER BY date DESC, id DESC';

  if (options?.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  return query<Expense>(sql, params);
}

export function getExpenseSummary(startDate?: string, endDate?: string): ExpenseSummary {
  let whereClause = '';
  const params: string[] = [];

  if (startDate && endDate) {
    const sDate = startDate.includes('T') ? startDate.split('T')[0] : startDate;
    const eDate = endDate.includes('T') ? endDate.split('T')[0] : endDate;
    whereClause = ' WHERE date >= ? AND date <= ?';
    params.push(sDate, eDate);
  } else if (startDate) {
    const sDate = startDate.includes('T') ? startDate.split('T')[0] : startDate;
    whereClause = ' WHERE date >= ?';
    params.push(sDate);
  } else if (endDate) {
    const eDate = endDate.includes('T') ? endDate.split('T')[0] : endDate;
    whereClause = ' WHERE date <= ?';
    params.push(eDate);
  }

  const totalRow = queryOne<{ total: number; count: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses${whereClause}`,
    params
  );

  const totalExpenses = totalRow?.total ?? 0;
  const expenseCount = totalRow?.count ?? 0;

  const breakdownRows = query<{ category: string; amount: number; count: number }>(
    `SELECT category, COALESCE(SUM(amount), 0) as amount, COUNT(*) as count 
     FROM expenses${whereClause} 
     GROUP BY category 
     ORDER BY amount DESC`,
    params
  );

  const categoryBreakdown: ExpenseCategoryBreakdown[] = breakdownRows.map((r) => ({
    category: r.category,
    amount: r.amount,
    count: r.count,
    percentage: totalExpenses > 0 ? (r.amount / totalExpenses) * 100 : 0,
  }));

  return {
    total_expenses: totalExpenses,
    expense_count: expenseCount,
    categoryBreakdown,
  };
}

export function getAllCategories(): string[] {
  const dbCategories = query<{ category: string }>('SELECT DISTINCT category FROM expenses');
  const catSet = new Set<string>(DEFAULT_EXPENSE_CATEGORIES);
  for (const row of dbCategories) {
    if (row.category) {
      catSet.add(row.category);
    }
  }
  return Array.from(catSet);
}
