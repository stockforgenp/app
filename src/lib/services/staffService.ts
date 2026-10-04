/**
 * Staff Management & Payroll Service
 * Handles employee profiles, base salary structures, and salary disbursements.
 * Syncs salary payments with the operating overhead expenses table for complete financial accuracy.
 */
import {
  Staff,
  SalaryPayment,
  CreateStaffInput,
  UpdateStaffInput,
  RecordSalaryInput,
  StaffSummary,
  StaffRole,
  StaffMonthlyPayrollStatus,
  MonthlyPayrollSummary,
  TodayPayrollStatus,
} from '../../types/index.ts';
import { query, queryOne, run, transaction } from '../db/sqliteEngine.ts';
import { getTodayISODate } from '../utils/format.ts';

export const DEFAULT_STAFF_ROLES: StaffRole[] = [
  'Store Manager',
  'Cashier',
  'Sales Associate',
  'Inventory Manager',
  'Delivery Person',
  'Accountant',
  'Security Guard',
  'Cleaner',
  'Other',
];

export const SALARY_PAYMENT_METHODS: string[] = [
  'Cash',
  'Bank Transfer',
  'Check',
  'Digital Wallet',
  'Other',
];

/**
 * Retrieve all staff members with aggregated payment stats
 */
export function getAllStaff(filter?: {
  status?: 'all' | 'active' | 'inactive';
  search?: string;
}): Staff[] {
  let sql = `
    SELECT 
      s.*,
      COALESCE((SELECT SUM(net_paid) FROM salary_payments WHERE staff_id = s.id), 0) as total_paid,
      (SELECT MAX(payment_date) FROM salary_payments WHERE staff_id = s.id) as last_payment_date
    FROM staff s
  `;

  const whereClauses: string[] = [];
  const params: (string | number)[] = [];

  if (filter?.status && filter.status !== 'all') {
    whereClauses.push('s.status = ?');
    params.push(filter.status);
  }

  if (filter?.search && filter.search.trim()) {
    whereClauses.push('(s.name LIKE ? OR s.role LIKE ? OR s.phone LIKE ? OR s.email LIKE ?)');
    const term = `%${filter.search.trim()}%`;
    params.push(term, term, term, term);
  }

  if (whereClauses.length > 0) {
    sql += ' WHERE ' + whereClauses.join(' AND ');
  }

  sql += ' ORDER BY s.status ASC, s.name ASC';

  return query<Staff>(sql, params);
}

/**
 * Get individual staff member by ID
 */
export function getStaffById(id: number): Staff | null {
  return queryOne<Staff>(
    `SELECT 
       s.*,
       COALESCE((SELECT SUM(net_paid) FROM salary_payments WHERE staff_id = s.id), 0) as total_paid,
       (SELECT MAX(payment_date) FROM salary_payments WHERE staff_id = s.id) as last_payment_date
     FROM staff s
     WHERE s.id = ?`,
    [id]
  );
}

/**
 * Create a new staff member
 */
export function createStaff(input: CreateStaffInput): Staff {
  const name = input.name?.trim();
  if (!name) {
    throw new Error('Staff member name is required');
  }

  const role = input.role?.trim() || 'Sales Associate';
  const baseSalary = Math.max(0, Math.floor(input.base_salary || 0));
  const salaryType = input.salary_type || 'monthly';
  const status = input.status || 'active';
  const joinDate = input.join_date?.trim() || getTodayISODate();
  const now = new Date().toISOString();

  return transaction(() => {
    run(
      `INSERT INTO staff (name, role, phone, email, base_salary, salary_type, status, join_date, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        role,
        input.phone?.trim() || null,
        input.email?.trim() || null,
        baseSalary,
        salaryType,
        status,
        joinDate,
        input.notes?.trim() || null,
        now,
        now,
      ]
    );

    const row = queryOne<{ id: number }>('SELECT last_insert_rowid() as id');
    const id = row?.id ?? 0;

    const created = getStaffById(id);
    if (!created) {
      throw new Error('Failed to retrieve newly created staff record');
    }

    return created;
  });
}

/**
 * Update an existing staff member
 */
export function updateStaff(id: number, input: UpdateStaffInput): Staff {
  return transaction(() => {
    const existing = getStaffById(id);
    if (!existing) {
      throw new Error(`Staff member #${id} not found`);
    }

    const name = input.name !== undefined ? input.name.trim() : existing.name;
    if (!name) {
      throw new Error('Staff name cannot be empty');
    }

    const role = input.role !== undefined ? input.role.trim() : existing.role;
    const phone = input.phone !== undefined ? (input.phone ? input.phone.trim() : null) : existing.phone;
    const email = input.email !== undefined ? (input.email ? input.email.trim() : null) : existing.email;
    const baseSalary = input.base_salary !== undefined ? Math.max(0, Math.floor(input.base_salary)) : existing.base_salary;
    const salaryType = input.salary_type !== undefined ? input.salary_type : existing.salary_type;
    const status = input.status !== undefined ? input.status : existing.status;
    const joinDate = input.join_date !== undefined ? (input.join_date ? input.join_date.trim() : existing.join_date) : existing.join_date;
    const notes = input.notes !== undefined ? (input.notes ? input.notes.trim() : null) : existing.notes;
    const now = new Date().toISOString();

    run(
      `UPDATE staff
       SET name = ?, role = ?, phone = ?, email = ?, base_salary = ?, salary_type = ?, status = ?, join_date = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      [name, role, phone, email, baseSalary, salaryType, status, joinDate, notes, now, id]
    );

    const updated = getStaffById(id);
    if (!updated) {
      throw new Error(`Failed to load updated staff member #${id}`);
    }

    return updated;
  });
}

/**
 * Delete a staff member and their payment records
 */
export function deleteStaff(id: number): boolean {
  return transaction(() => {
    // Delete linked expenses from salary payments first
    const payments = query<{ expense_id: number | null }>(
      'SELECT expense_id FROM salary_payments WHERE staff_id = ? AND expense_id IS NOT NULL',
      [id]
    );

    for (const p of payments) {
      if (p.expense_id) {
        run('DELETE FROM expenses WHERE id = ?', [p.expense_id]);
      }
    }

    run('DELETE FROM salary_payments WHERE staff_id = ?', [id]);
    run('DELETE FROM staff WHERE id = ?', [id]);
    return true;
  });
}

/**
 * Record a salary disbursement and optionally sync to expenses
 */
export function recordSalaryPayment(input: RecordSalaryInput): SalaryPayment {
  const staff = getStaffById(input.staff_id);
  if (!staff) {
    throw new Error(`Staff member #${input.staff_id} does not exist`);
  }

  const amount = Math.floor(input.amount);
  if (isNaN(amount) || amount <= 0) {
    throw new Error('Base salary amount must be greater than zero');
  }

  const bonus = Math.max(0, Math.floor(input.bonus || 0));
  const deductions = Math.max(0, Math.floor(input.deductions || 0));
  const netPaid = Math.max(0, amount + bonus - deductions);

  if (netPaid <= 0) {
    throw new Error('Net salary payment must be greater than zero');
  }

  const paymentDate = input.payment_date?.trim() || getTodayISODate();
  const paymentPeriod = input.payment_period?.trim();
  if (!paymentPeriod) {
    throw new Error('Payment period (e.g. Month / Year) is required');
  }

  const paymentMethod = input.payment_method?.trim() || 'Cash';
  const reference = input.reference?.trim() || null;
  const note = input.note?.trim() || null;
  const now = new Date().toISOString();

  return transaction(() => {
    let expenseId: number | null = null;

    // Synchronize to overhead expenses if enabled (default true)
    if (input.syncWithExpenses !== false) {
      const expenseNote = `Salary disbursement for ${staff.name} (${staff.role}) - Period: ${paymentPeriod}${note ? ` · ${note}` : ''}`;
      run(
        `INSERT INTO expenses (category, amount, date, payment_method, note, receipt_reference, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'Salaries & Wages',
          netPaid,
          paymentDate,
          paymentMethod,
          expenseNote,
          reference || `PAY-${staff.id}-${Date.now().toString().slice(-4)}`,
          now,
          now,
        ]
      );

      const expRow = queryOne<{ id: number }>('SELECT last_insert_rowid() as id');
      expenseId = expRow?.id ?? null;
    }

    // Insert into salary_payments table
    run(
      `INSERT INTO salary_payments (staff_id, amount, bonus, deductions, net_paid, payment_date, payment_period, payment_method, reference, note, expense_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        staff.id,
        amount,
        bonus,
        deductions,
        netPaid,
        paymentDate,
        paymentPeriod,
        paymentMethod,
        reference,
        note,
        expenseId,
        now,
      ]
    );

    const paymentRow = queryOne<{ id: number }>('SELECT last_insert_rowid() as id');
    const paymentId = paymentRow?.id ?? 0;

    const payment = getSalaryPaymentById(paymentId);
    if (!payment) {
      throw new Error('Failed to retrieve newly recorded salary payment');
    }

    return payment;
  });
}

/**
 * Retrieve salary payments with optional filters
 */
export function getSalaryPayments(options?: {
  staffId?: number;
  startDate?: string;
  endDate?: string;
  search?: string;
}): SalaryPayment[] {
  let sql = `
    SELECT 
      sp.*,
      s.name as staff_name,
      s.role as staff_role
    FROM salary_payments sp
    JOIN staff s ON sp.staff_id = s.id
  `;

  const whereClauses: string[] = [];
  const params: (string | number)[] = [];

  if (options?.staffId) {
    whereClauses.push('sp.staff_id = ?');
    params.push(options.staffId);
  }

  if (options?.startDate) {
    whereClauses.push('sp.payment_date >= ?');
    params.push(options.startDate);
  }

  if (options?.endDate) {
    whereClauses.push('sp.payment_date <= ?');
    params.push(options.endDate);
  }

  if (options?.search && options.search.trim()) {
    whereClauses.push(
      '(s.name LIKE ? OR sp.payment_period LIKE ? OR sp.reference LIKE ? OR sp.note LIKE ?)'
    );
    const term = `%${options.search.trim()}%`;
    params.push(term, term, term, term);
  }

  if (whereClauses.length > 0) {
    sql += ' WHERE ' + whereClauses.join(' AND ');
  }

  sql += ' ORDER BY sp.payment_date DESC, sp.id DESC';

  return query<SalaryPayment>(sql, params);
}

/**
 * Get single salary payment by ID
 */
export function getSalaryPaymentById(id: number): SalaryPayment | null {
  return queryOne<SalaryPayment>(
    `SELECT 
       sp.*,
       s.name as staff_name,
       s.role as staff_role
     FROM salary_payments sp
     JOIN staff s ON sp.staff_id = s.id
     WHERE sp.id = ?`,
    [id]
  );
}

/**
 * Delete / void a salary payment record
 */
export function deleteSalaryPayment(id: number): boolean {
  return transaction(() => {
    const payment = getSalaryPaymentById(id);
    if (!payment) return false;

    // If synced with expenses, delete the linked expense
    if (payment.expense_id) {
      run('DELETE FROM expenses WHERE id = ?', [payment.expense_id]);
    }

    run('DELETE FROM salary_payments WHERE id = ?', [id]);
    return true;
  });
}

/**
 * Get aggregated summary metrics for staff and payroll
 */
export function getStaffSummary(): StaffSummary {
  const staffStats = queryOne<{ total: number; active: number; monthly_sum: number }>(
    `SELECT 
       COUNT(*) as total,
       COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) as active,
       COALESCE(SUM(CASE WHEN status = 'active' AND salary_type = 'monthly' THEN base_salary ELSE 0 END), 0) as monthly_sum
     FROM staff`
  );

  const today = new Date();
  const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const currentMonthPayments = queryOne<{ total_paid: number; count: number }>(
    `SELECT 
       COALESCE(SUM(net_paid), 0) as total_paid,
       COUNT(*) as count
     FROM salary_payments
     WHERE payment_date LIKE ?`,
    [`${currentYearMonth}%`]
  );

  return {
    total_staff: staffStats?.total ?? 0,
    active_staff: staffStats?.active ?? 0,
    monthly_payroll_commitment: staffStats?.monthly_sum ?? 0,
    total_salaries_paid_this_month: currentMonthPayments?.total_paid ?? 0,
    payments_count_this_month: currentMonthPayments?.count ?? 0,
  };
}

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Get detailed payroll status for a specific month/year.
 * Evaluates whether every active staff member has received their wage or is pending.
 */
export function getMonthlyPayrollSummary(
  yearParam?: number,
  monthParam?: number
): MonthlyPayrollSummary {
  const now = new Date();
  const year = yearParam ?? now.getFullYear();
  const month = monthParam ?? (now.getMonth() + 1); // 1-12
  const monthName = MONTH_NAMES[month - 1] || 'Current Month';
  const periodLabel = `${monthName} ${year}`;
  const datePrefix = `${year}-${String(month).padStart(2, '0')}`;
  const isCurrentMonth = year === now.getFullYear() && month === (now.getMonth() + 1);

  // Fetch all staff members
  const staffList = getAllStaff();
  const activeStaff = staffList.filter((s) => s.status === 'active');

  // Query all payments matching this period label or payment date prefix
  const payments = query<SalaryPayment & { staff_name: string; staff_role: string }>(
    `SELECT 
       sp.*,
       s.name as staff_name,
       s.role as staff_role
     FROM salary_payments sp
     JOIN staff s ON sp.staff_id = s.id
     WHERE sp.payment_period LIKE ? 
        OR sp.payment_date LIKE ?
     ORDER BY sp.payment_date DESC, sp.id DESC`,
    [`%${periodLabel}%`, `${datePrefix}%`]
  );

  // Map each active staff to their payment for this month if any
  const staffStatuses: StaffMonthlyPayrollStatus[] = activeStaff.map((staff) => {
    // Find payment for this staff
    const match = payments.find((p) => p.staff_id === staff.id);
    if (match) {
      return {
        staff_id: staff.id,
        staff_name: staff.name,
        staff_role: staff.role,
        salary_type: staff.salary_type,
        base_salary: staff.base_salary,
        status: staff.status,
        is_paid: true,
        payment: match,
        amount_paid: match.net_paid,
        payment_date: match.payment_date,
        payment_method: match.payment_method,
        payment_period: match.payment_period,
      };
    } else {
      return {
        staff_id: staff.id,
        staff_name: staff.name,
        staff_role: staff.role,
        salary_type: staff.salary_type,
        base_salary: staff.base_salary,
        status: staff.status,
        is_paid: false,
        amount_paid: 0,
      };
    }
  });

  const totalActive = activeStaff.length;
  const paidCount = staffStatuses.filter((s) => s.is_paid).length;
  const unpaidCount = totalActive - paidCount;
  const percentPaid = totalActive > 0 ? Math.round((paidCount / totalActive) * 100) : 0;
  const totalCommitment = activeStaff.reduce((sum, s) => sum + s.base_salary, 0);
  const totalPaid = staffStatuses.reduce((sum, s) => sum + (s.amount_paid || 0), 0);
  const totalPending = Math.max(0, totalCommitment - totalPaid);

  let overallStatus: 'fully_paid' | 'partially_paid' | 'unpaid' = 'unpaid';
  if (totalActive > 0 && paidCount === totalActive) {
    overallStatus = 'fully_paid';
  } else if (paidCount > 0) {
    overallStatus = 'partially_paid';
  }

  // Today's date payroll status
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayFormatted = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const todayPayments = queryOne<{ total_paid: number; count: number }>(
    `SELECT 
       COALESCE(SUM(net_paid), 0) as total_paid,
       COUNT(*) as count
     FROM salary_payments
     WHERE payment_date = ?`,
    [todayISO]
  );

  const todayCount = todayPayments?.count ?? 0;
  const todayTotal = todayPayments?.total_paid ?? 0;

  const todayStatus: TodayPayrollStatus = {
    date: todayISO,
    formatted: todayFormatted,
    is_paid: todayCount > 0,
    payments_count: todayCount,
    total_paid: todayTotal,
  };

  return {
    period_label: periodLabel,
    year,
    month,
    is_current_month: isCurrentMonth,
    total_active_staff: totalActive,
    paid_count: paidCount,
    unpaid_count: unpaidCount,
    percent_paid: percentPaid,
    total_commitment: totalCommitment,
    total_paid: totalPaid,
    total_pending: totalPending,
    overall_status: overallStatus,
    staff_statuses: staffStatuses,
    today_status: todayStatus,
  };
}
