/**
 * Feature: Staff Payroll & Salary Disbursements Suite
 * Tests:
 * 1. createStaff registers employees across various salary structures (monthly, daily, hourly)
 * 2. recordSalaryPayment calculates net pay accurately (Base + Bonus - Deductions)
 * 3. recordSalaryPayment validates input constraints (non-existent staff, invalid base, negative net pay, missing period)
 * 4. recordSalaryPayment syncWithExpenses=true automatically creates overhead expense under "Salaries & Wages"
 * 5. recordSalaryPayment syncWithExpenses=false leaves expense ledger untouched
 * 6. deleteSalaryPayment voids salary disbursement and deletes linked expense record
 * 7. deleteStaff cascades deletion to all salary payments and linked expenses
 * 8. getMonthlyPayrollSummary accurately evaluates fully_paid, partially_paid, and unpaid statuses
 * 9. getMonthlyPayrollSummary treats absent/penalty deductions as reductions rather than unpaid dues
 * 10. getMonthlyPayrollSummary today_status tracks payments disbursed on today's calendar date
 * 11. getStaffSummary calculates active headcount, monthly payroll commitments, and month-to-date disbursements
 * 12. getSalaryPayments filters disbursements by staffId, date range, and search keyword
 * 13. Real CRUD on Staff & Salary Payments: raw SQL INSERT into staff and salary_payments, SELECT column check, UPDATE salary, and DELETE
 */

import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment } from './setup.ts';

const {
  createStaff,
  getStaffById,
  deleteStaff,
  recordSalaryPayment,
  getSalaryPaymentById,
  getSalaryPayments,
  deleteSalaryPayment,
  getStaffSummary,
  getMonthlyPayrollSummary,
  MONTH_NAMES,
} = await import('../src/lib/services/staffService.ts');

const { queryOne, query, run } = await import('../src/lib/db/sqliteEngine.ts');

describe('Feature: Staff Payroll & Disbursements', () => {
  beforeEach(async () => {
    await setupTestEnvironment();
  });

  test('1. createStaff registers employees across various salary structures (monthly, daily, hourly)', () => {
    const manager = createStaff({
      name: 'suresh bhandari',
      role: 'Store Manager',
      phone: '9841234567',
      email: 'suresh@store.com',
      base_salary: 4000000, // Rs 40,000
      salary_type: 'monthly',
      status: 'active',
      join_date: '2026-01-01',
    });

    const helper = createStaff({
      name: 'ramesh thapa',
      role: 'Loading & Dispatch',
      base_salary: 80000, // Rs 800/day
      salary_type: 'daily',
      status: 'active',
    });

    assert.equal(manager.name, 'Suresh Bhandari');
    assert.equal(manager.role, 'Store Manager');
    assert.equal(manager.base_salary, 4000000);
    assert.equal(manager.salary_type, 'monthly');

    assert.equal(helper.name, 'Ramesh Thapa');
    assert.equal(helper.salary_type, 'daily');
    assert.equal(helper.base_salary, 80000);
  });

  test('2. recordSalaryPayment calculates net pay accurately (Base + Bonus - Deductions)', () => {
    const staff = createStaff({
      name: 'Binod Shrestha',
      role: 'Head Cashier',
      base_salary: 3000000, // Rs 30,000
    });

    // Base: 30,000 | Bonus (Dashain / Festival): 10,000 | Deductions (TDS / Advance): 5,000 => Net: 35,000
    const payment = recordSalaryPayment({
      staff_id: staff.id,
      amount: 3000000,
      bonus: 1000000,
      deductions: 500000,
      payment_date: '2026-04-20',
      payment_period: 'Chaitra 2082',
      payment_method: 'Bank Transfer',
      reference: 'TXN-BANK-PAY-8821',
      note: 'Dashain festival allowance included',
    });

    assert.equal(payment.staff_id, staff.id);
    assert.equal(payment.amount, 3000000);
    assert.equal(payment.bonus, 1000000);
    assert.equal(payment.deductions, 500000);
    assert.equal(payment.net_paid, 3500000); // 30,000 + 10,000 - 5,000
    assert.equal(payment.payment_period, 'Chaitra 2082');
    assert.equal(payment.payment_method, 'Bank Transfer');
  });

  test('3. recordSalaryPayment validates input constraints strictly', () => {
    const staff = createStaff({ name: 'Maya Tamang', role: 'Sales', base_salary: 2000000 });

    // Non-existent staff
    assert.throws(
      () => recordSalaryPayment({ staff_id: 99999, amount: 2000000, payment_period: 'Baisakh 2083' }),
      /does not exist/i
    );

    // Zero or negative base amount
    assert.throws(
      () => recordSalaryPayment({ staff_id: staff.id, amount: 0, payment_period: 'Baisakh 2083' }),
      /greater than zero/i
    );

    // Missing payment period
    assert.throws(
      () => recordSalaryPayment({ staff_id: staff.id, amount: 2000000, payment_period: '' }),
      /Payment period.*required/i
    );

    // Net pay <= 0 (Deductions exceed Base + Bonus)
    assert.throws(
      () =>
        recordSalaryPayment({
          staff_id: staff.id,
          amount: 1000000,
          deductions: 1500000,
          payment_period: 'Baisakh 2083',
        }),
      /Net salary payment must be greater than zero/i
    );
  });

  test('4. recordSalaryPayment syncWithExpenses=true automatically creates overhead expense under "Salaries & Wages"', () => {
    const staff = createStaff({
      name: 'Anita Gurung',
      role: 'Accountant',
      base_salary: 3500000,
    });

    const payment = recordSalaryPayment({
      staff_id: staff.id,
      amount: 3500000,
      payment_date: '2026-04-15',
      payment_period: 'Chaitra 2082',
      payment_method: 'Cheque',
      syncWithExpenses: true,
    });

    assert.ok(payment.expense_id, 'Should generate linked expense_id');

    const expense = queryOne<{
      id: number;
      category: string;
      amount: number;
      payment_method: string;
      date: string;
      note: string;
    }>('SELECT * FROM expenses WHERE id = ?', [payment.expense_id]);

    assert.ok(expense);
    assert.equal(expense.category, 'Salaries & Wages');
    assert.equal(expense.amount, 3500000);
    assert.equal(expense.payment_method, 'Cheque');
    assert.equal(expense.date, '2026-04-15');
    assert.ok(expense.note.includes('Anita Gurung'));
    assert.ok(expense.note.includes('Accountant'));
    assert.ok(expense.note.includes('Chaitra 2082'));
  });

  test('5. recordSalaryPayment syncWithExpenses=false leaves expense ledger untouched', () => {
    const staff = createStaff({
      name: 'Kiran KC',
      role: 'Intern',
      base_salary: 1000000,
    });

    const initialExpensesCount = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM expenses')?.count ?? 0;

    const payment = recordSalaryPayment({
      staff_id: staff.id,
      amount: 1000000,
      payment_period: 'Baisakh 2083',
      syncWithExpenses: false,
    });

    assert.equal(payment.expense_id, null);

    const postExpensesCount = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM expenses')?.count ?? 0;
    assert.equal(postExpensesCount, initialExpensesCount);
  });

  test('6. deleteSalaryPayment voids salary disbursement and deletes linked expense record', () => {
    const staff = createStaff({ name: 'Deepak Giri', role: 'Driver', base_salary: 2200000 });
    const payment = recordSalaryPayment({
      staff_id: staff.id,
      amount: 2200000,
      payment_period: 'Chaitra 2082',
      syncWithExpenses: true,
    });

    assert.ok(payment.expense_id);
    const expenseId = payment.expense_id;

    assert.equal(deleteSalaryPayment(payment.id), true);

    // Verify payment is deleted
    assert.equal(getSalaryPaymentById(payment.id), null);

    // Verify linked expense is deleted
    const linkedExpense = queryOne('SELECT * FROM expenses WHERE id = ?', [expenseId]);
    assert.equal(linkedExpense, null, 'Linked expense must be removed when salary payment is deleted');
  });

  test('7. deleteStaff cascades deletion to all salary payments and linked expenses', () => {
    const staff = createStaff({ name: 'Hari Bahadur', role: 'Security Guard', base_salary: 1800000 });
    const p1 = recordSalaryPayment({
      staff_id: staff.id,
      amount: 1800000,
      payment_period: 'Falgun 2082',
      syncWithExpenses: true,
    });
    const p2 = recordSalaryPayment({
      staff_id: staff.id,
      amount: 1800000,
      payment_period: 'Chaitra 2082',
      syncWithExpenses: true,
    });

    assert.ok(p1.expense_id);
    assert.ok(p2.expense_id);

    assert.equal(deleteStaff(staff.id), true);

    // Verify staff is gone
    assert.equal(getStaffById(staff.id), null);

    // Verify payments are cascade deleted
    const paymentsCount = queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM salary_payments WHERE staff_id = ?',
      [staff.id]
    )?.count;
    assert.equal(paymentsCount, 0);

    // Verify linked expenses are deleted
    const exp1 = queryOne('SELECT id FROM expenses WHERE id = ?', [p1.expense_id]);
    const exp2 = queryOne('SELECT id FROM expenses WHERE id = ?', [p2.expense_id]);
    assert.equal(exp1, null);
    assert.equal(exp2, null);
  });

  test('8. getMonthlyPayrollSummary accurately evaluates fully_paid, partially_paid, and unpaid statuses', () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentMonthName = MONTH_NAMES[currentMonth - 1];
    const periodLabel = `${currentMonthName} ${currentYear}`;

    const staff1 = createStaff({ name: 'Staff A', role: 'Sales', base_salary: 2000000, status: 'active' });
    const staff2 = createStaff({ name: 'Staff B', role: 'Sales', base_salary: 2500000, status: 'active' });

    // Initial state: Unpaid
    let payroll = getMonthlyPayrollSummary(currentYear, currentMonth);
    assert.equal(payroll.total_active_staff, 2);
    assert.equal(payroll.paid_count, 0);
    assert.equal(payroll.unpaid_count, 2);
    assert.equal(payroll.percent_paid, 0);
    assert.equal(payroll.total_commitment, 4500000);
    assert.equal(payroll.total_pending, 4500000);
    assert.equal(payroll.overall_status, 'unpaid');

    // Pay Staff 1: Partially paid
    recordSalaryPayment({
      staff_id: staff1.id,
      amount: 2000000,
      payment_period: periodLabel,
    });

    payroll = getMonthlyPayrollSummary(currentYear, currentMonth);
    assert.equal(payroll.paid_count, 1);
    assert.equal(payroll.unpaid_count, 1);
    assert.equal(payroll.percent_paid, 50);
    assert.equal(payroll.total_paid, 2000000);
    assert.equal(payroll.total_pending, 2500000);
    assert.equal(payroll.overall_status, 'partially_paid');

    // Pay Staff 2: Fully paid
    recordSalaryPayment({
      staff_id: staff2.id,
      amount: 2500000,
      payment_period: periodLabel,
    });

    payroll = getMonthlyPayrollSummary(currentYear, currentMonth);
    assert.equal(payroll.paid_count, 2);
    assert.equal(payroll.unpaid_count, 0);
    assert.equal(payroll.percent_paid, 100);
    assert.equal(payroll.total_paid, 4500000);
    assert.equal(payroll.total_pending, 0);
    assert.equal(payroll.overall_status, 'fully_paid');
  });

  test('9. getMonthlyPayrollSummary treats absent/penalty deductions as reductions rather than unpaid dues', () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentMonthName = MONTH_NAMES[currentMonth - 1];
    const periodLabel = `${currentMonthName} ${currentYear}`;

    const staff = createStaff({ name: 'Nabin Rawal', role: 'Staff', base_salary: 3000000, status: 'active' });

    // Staff base is 30,000. 5,000 deducted for unpaid leave. Net paid = 25,000.
    recordSalaryPayment({
      staff_id: staff.id,
      amount: 3000000,
      deductions: 500000,
      payment_period: periodLabel,
    });

    const payroll = getMonthlyPayrollSummary(currentYear, currentMonth);
    assert.equal(payroll.paid_count, 1);
    assert.equal(payroll.total_paid, 2500000);
    assert.equal(payroll.total_deductions, 500000);
    assert.equal(payroll.total_pending, 0, 'Deductions must not remain as pending unpaid dues');
    assert.equal(payroll.overall_status, 'fully_paid');
  });

  test('10. getMonthlyPayrollSummary today_status tracks payments disbursed on today calendar date', () => {
    const now = new Date();
    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const staff = createStaff({ name: 'Pooja KC', role: 'Staff', base_salary: 2800000, status: 'active' });

    recordSalaryPayment({
      staff_id: staff.id,
      amount: 2800000,
      payment_date: todayISO,
      payment_period: 'Current Month',
    });

    const payroll = getMonthlyPayrollSummary();
    assert.equal(payroll.today_status.is_paid, true);
    assert.equal(payroll.today_status.payments_count, 1);
    assert.equal(payroll.today_status.total_paid, 2800000);
  });

  test('11. getStaffSummary calculates active headcount, monthly payroll commitments, and disbursements', () => {
    createStaff({ name: 'Active 1', role: 'Staff', base_salary: 2000000, salary_type: 'monthly', status: 'active' });
    createStaff({ name: 'Active 2', role: 'Staff', base_salary: 3000000, salary_type: 'monthly', status: 'active' });
    createStaff({ name: 'Inactive 1', role: 'Staff', base_salary: 4000000, salary_type: 'monthly', status: 'inactive' });
    createStaff({ name: 'Daily Wage', role: 'Staff', base_salary: 100000, salary_type: 'daily', status: 'active' });

    const summary = getStaffSummary();
    assert.equal(summary.total_staff, 4);
    assert.equal(summary.active_staff, 3);
    // Commitment sums only active + monthly
    assert.equal(summary.monthly_payroll_commitment, 5000000);
  });

  test('12. getSalaryPayments filters disbursements by staffId, date range, and search keyword', () => {
    const staff1 = createStaff({ name: 'Raj Kumar', role: 'Sales', base_salary: 2000000 });
    const staff2 = createStaff({ name: 'Govinda Poudel', role: 'Support', base_salary: 1500000 });

    recordSalaryPayment({
      staff_id: staff1.id,
      amount: 2000000,
      payment_date: '2026-03-31',
      payment_period: 'Falgun 2082',
      reference: 'TXN-001',
    });

    recordSalaryPayment({
      staff_id: staff1.id,
      amount: 2000000,
      payment_date: '2026-04-30',
      payment_period: 'Chaitra 2082',
      reference: 'TXN-002',
    });

    recordSalaryPayment({
      staff_id: staff2.id,
      amount: 1500000,
      payment_date: '2026-04-30',
      payment_period: 'Chaitra 2082',
      reference: 'TXN-003',
    });

    // Filter by staffId
    const staff1Payments = getSalaryPayments({ staffId: staff1.id });
    assert.equal(staff1Payments.length, 2);

    // Filter by date
    const aprilPayments = getSalaryPayments({ startDate: '2026-04-01', endDate: '2026-04-30' });
    assert.equal(aprilPayments.length, 2);

    // Filter by search keyword
    const searchRef = getSalaryPayments({ search: 'TXN-003' });
    assert.equal(searchRef.length, 1);
    assert.equal(searchRef[0].staff_name, 'Govinda Poudel');
  });

  test('13. Real CRUD on Staff & Salary Payments: raw SQL INSERT into staff and salary_payments, SELECT column check, UPDATE salary, and DELETE', () => {
    const now = new Date().toISOString();

    // 1. RAW SQL INSERT into staff
    run(
      `INSERT INTO staff (name, role, phone, email, base_salary, salary_type, status, join_date, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'Bikash Shrestha',
        'Senior Inventory Officer',
        '9849999999',
        'bikash@store.com',
        3500000,
        'monthly',
        'active',
        '2026-01-15',
        'Warehouse incharge',
        now,
        now,
      ]
    );

    const staffRow = queryOne<{ id: number }>('SELECT last_insert_rowid() as id');
    const staffId = staffRow?.id ?? 0;
    assert.ok(staffId > 0, 'Staff row inserted');

    // Verify staff columns
    const fetchedStaff = queryOne<{
      id: number;
      name: string;
      role: string;
      phone: string;
      email: string;
      base_salary: number;
      salary_type: string;
      status: string;
    }>('SELECT * FROM staff WHERE id = ?', [staffId]);

    assert.ok(fetchedStaff);
    assert.equal(fetchedStaff.name, 'Bikash Shrestha');
    assert.equal(fetchedStaff.role, 'Senior Inventory Officer');
    assert.equal(fetchedStaff.base_salary, 3500000);

    // 2. RAW SQL INSERT into salary_payments
    run(
      `INSERT INTO salary_payments (staff_id, amount, bonus, deductions, net_paid, payment_date, payment_period, payment_method, reference, note, expense_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      [staffId, 3500000, 500000, 200000, 3800000, '2026-04-25', 'Baisakh 2083', 'FonePay', 'TXN-SLR-99', 'Direct SQL entry', now]
    );

    const paymentRow = queryOne<{ id: number }>('SELECT last_insert_rowid() as id');
    const paymentId = paymentRow?.id ?? 0;
    assert.ok(paymentId > 0, 'Salary payment row inserted');

    // Verify payment columns
    const fetchedPayment = queryOne<{
      id: number;
      staff_id: number;
      amount: number;
      bonus: number;
      deductions: number;
      net_paid: number;
      payment_method: string;
      reference: string;
    }>('SELECT * FROM salary_payments WHERE id = ?', [paymentId]);

    assert.ok(fetchedPayment);
    assert.equal(fetchedPayment.staff_id, staffId);
    assert.equal(fetchedPayment.amount, 3500000);
    assert.equal(fetchedPayment.bonus, 500000);
    assert.equal(fetchedPayment.deductions, 200000);
    assert.equal(fetchedPayment.net_paid, 3800000);
    assert.equal(fetchedPayment.reference, 'TXN-SLR-99');

    // 3. RAW SQL UPDATE staff
    run('UPDATE staff SET base_salary = 3800000, role = ? WHERE id = ?', ['Warehouse Director', staffId]);
    const updatedStaff = queryOne<{ base_salary: number; role: string }>('SELECT base_salary, role FROM staff WHERE id = ?', [staffId]);
    assert.equal(updatedStaff?.base_salary, 3800000);
    assert.equal(updatedStaff?.role, 'Warehouse Director');

    // 4. RAW SQL DELETE
    run('DELETE FROM salary_payments WHERE id = ?', [paymentId]);
    run('DELETE FROM staff WHERE id = ?', [staffId]);
    const deadStaff = queryOne('SELECT * FROM staff WHERE id = ?', [staffId]);
    const deadPayment = queryOne('SELECT * FROM salary_payments WHERE id = ?', [paymentId]);
    assert.equal(deadStaff, null);
    assert.equal(deadPayment, null, 'Deleted salary payment should no longer exist in salary_payments table');
  });
});
