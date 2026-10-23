import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupTestEnvironment } from "./setup.ts";

// Dynamically import services after setup has registered the wasm loader
const {
  createStaff,
  updateStaff,
  deleteStaff,
  getAllStaff,
  getStaffById,
  recordSalaryPayment,
  getSalaryPayments,
  getSalaryPaymentById,
  deleteSalaryPayment,
  getStaffSummary,
  getMonthlyPayrollSummary,
  getStaffCount,
} = await import("../src/lib/services/staffService.ts");

const { query, queryOne } = await import("../src/lib/db/sqliteEngine.ts");

beforeEach(async () => {
  await setupTestEnvironment();
});

test("Staff: createStaff registers staff member with capitalization and defaults", () => {
  const staff = createStaff({
    name: "ram bahadur thapa",
    role: "store manager",
    phone: "9841000001",
    email: "ram@example.com",
    base_salary: 35000,
    salary_type: "monthly",
    status: "active",
    join_date: "2026-01-15",
    notes: "Lead store inventory manager",
  });

  assert.ok(staff.id > 0);
  assert.equal(staff.name, "Ram Bahadur Thapa");
  assert.equal(staff.role, "Store Manager");
  assert.equal(staff.phone, "9841000001");
  assert.equal(staff.email, "ram@example.com");
  assert.equal(staff.base_salary, 35000);
  assert.equal(staff.salary_type, "monthly");
  assert.equal(staff.status, "active");
  assert.equal(staff.join_date, "2026-01-15");
  assert.equal(staff.notes, "Lead store inventory manager");
  assert.equal(staff.total_paid, 0);
  assert.equal(staff.last_payment_date, null);

  assert.equal(getStaffCount(), 1);

  // Validation: empty name throws
  assert.throws(
    () => {
      createStaff({
        name: "   ",
        role: "Cashier",
        base_salary: 20000,
      });
    },
    { message: /Staff member name is required/i },
  );
});

test("Staff: getAllStaff and getStaffById support filtering and search", () => {
  const s1 = createStaff({
    name: "Sita Sharma",
    role: "Senior Accountant",
    phone: "9800000001",
    email: "sita@example.com",
    base_salary: 40000,
    status: "active",
  });

  const s2 = createStaff({
    name: "Hari Prasad",
    role: "Security Guard",
    phone: "9800000002",
    base_salary: 20000,
    status: "inactive",
  });

  const s3 = createStaff({
    name: "Gita Devi",
    role: "Cashier",
    phone: "9800000003",
    base_salary: 25000,
    status: "active",
  });

  // Fetch all staff
  const all = getAllStaff();
  assert.equal(all.length, 3);

  // Filter by active status
  const activeStaff = getAllStaff({ status: "active" });
  assert.equal(activeStaff.length, 2);
  assert.ok(activeStaff.some((s) => s.id === s1.id));
  assert.ok(activeStaff.some((s) => s.id === s3.id));

  // Filter by inactive status
  const inactiveStaff = getAllStaff({ status: "inactive" });
  assert.equal(inactiveStaff.length, 1);
  assert.equal(inactiveStaff[0].id, s2.id);

  // Search by name
  const searchedByName = getAllStaff({ search: "sharma" });
  assert.equal(searchedByName.length, 1);
  assert.equal(searchedByName[0].name, "Sita Sharma");

  // Search by role
  const searchedByRole = getAllStaff({ search: "guard" });
  assert.equal(searchedByRole.length, 1);
  assert.equal(searchedByRole[0].name, "Hari Prasad");

  // getStaffById
  const fetched = getStaffById(s1.id);
  assert.ok(fetched);
  assert.equal(fetched.id, s1.id);
  assert.equal(fetched.name, "Sita Sharma");

  // Non-existent ID returns null
  assert.equal(getStaffById(9999), null);
});

test("Staff: updateStaff updates employee profile details", () => {
  const staff = createStaff({
    name: "Bikash Adhikari",
    role: "Sales Associate",
    base_salary: 22000,
    status: "active",
  });

  const updated = updateStaff(staff.id, {
    name: "Bikash K. Adhikari",
    role: "Senior Sales Associate",
    phone: "9851099999",
    email: "bikash@example.com",
    base_salary: 28000,
    status: "active",
    notes: "Promoted after annual review",
  });

  assert.equal(updated.name, "Bikash K. Adhikari");
  assert.equal(updated.role, "Senior Sales Associate");
  assert.equal(updated.phone, "9851099999");
  assert.equal(updated.email, "bikash@example.com");
  assert.equal(updated.base_salary, 28000);
  assert.equal(updated.notes, "Promoted after annual review");

  // Empty name validation
  assert.throws(
    () => {
      updateStaff(staff.id, { name: "   " });
    },
    { message: /Staff name cannot be empty/i },
  );

  // Non-existent ID throws
  assert.throws(
    () => {
      updateStaff(9999, { name: "Ghost" });
    },
    { message: /not found/i },
  );
});

test("Staff: recordSalaryPayment calculates net pay and links to expenses table", () => {
  const staff = createStaff({
    name: "Laxman Gurung",
    role: "Inventory Dispatcher",
    base_salary: 30000,
  });

  const payment = recordSalaryPayment({
    staff_id: staff.id,
    amount: 30000,
    bonus: 3000,
    deductions: 1500,
    payment_period: "Baishakh 2083",
    payment_date: "2026-04-30",
    payment_method: "Bank Transfer",
    reference: "TXN-SAL-001",
    note: "Includes Dashain advance deduction",
    syncWithExpenses: true,
  });

  assert.ok(payment.id > 0);
  assert.equal(payment.staff_id, staff.id);
  assert.equal(payment.amount, 30000);
  assert.equal(payment.bonus, 3000);
  assert.equal(payment.deductions, 1500);
  // Net paid = 30000 + 3000 - 1500 = 31500
  assert.equal(payment.net_paid, 31500);
  assert.equal(payment.payment_period, "Baishakh 2083");
  assert.equal(payment.payment_method, "Bank Transfer");
  assert.equal(payment.reference, "TXN-SAL-001");
  assert.ok(payment.expense_id !== null && payment.expense_id > 0);

  // Verify the overhead expense record in expenses table
  const expense = queryOne<{
    category: string;
    amount: number;
    payment_method: string;
    note: string;
  }>("SELECT category, amount, payment_method, note FROM expenses WHERE id = ?", [
    payment.expense_id,
  ]);
  assert.ok(expense);
  assert.equal(expense.category, "Salaries & Wages");
  assert.equal(expense.amount, 31500);
  assert.equal(expense.payment_method, "Bank Transfer");
  assert.ok(expense.note.includes("Laxman Gurung"));

  // Verify staff aggregated total_paid
  const updatedStaff = getStaffById(staff.id);
  assert.ok(updatedStaff);
  assert.equal(updatedStaff.total_paid, 31500);
  assert.equal(updatedStaff.last_payment_date, "2026-04-30");
});

test("Staff: recordSalaryPayment with syncWithExpenses=false skips expenses entry", () => {
  const staff = createStaff({
    name: "Sunil Shrestha",
    role: "Driver",
    base_salary: 20000,
  });

  const payment = recordSalaryPayment({
    staff_id: staff.id,
    amount: 20000,
    bonus: 0,
    deductions: 0,
    payment_period: "Jestha 2083",
    payment_date: "2026-05-30",
    syncWithExpenses: false,
  });

  assert.equal(payment.net_paid, 20000);
  assert.equal(payment.expense_id, null);

  const expenseCount = queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM expenses",
  );
  assert.equal(expenseCount?.count, 0);
});

test("Staff: recordSalaryPayment validates inputs strictly", () => {
  const staff = createStaff({
    name: "Anil Karki",
    role: "Loader",
    base_salary: 18000,
  });

  // Missing staff ID
  assert.throws(
    () => {
      recordSalaryPayment({
        staff_id: 9999,
        amount: 18000,
        payment_period: "Chaitra 2082",
      });
    },
    { message: /does not exist/i },
  );

  // Amount <= 0
  assert.throws(
    () => {
      recordSalaryPayment({
        staff_id: staff.id,
        amount: 0,
        payment_period: "Chaitra 2082",
      });
    },
    { message: /greater than zero/i },
  );

  // Deductions exceed total amount + bonus
  assert.throws(
    () => {
      recordSalaryPayment({
        staff_id: staff.id,
        amount: 10000,
        bonus: 0,
        deductions: 12000,
        payment_period: "Chaitra 2082",
      });
    },
    { message: /Net salary payment must be greater than zero/i },
  );

  // Missing payment period
  assert.throws(
    () => {
      recordSalaryPayment({
        staff_id: staff.id,
        amount: 18000,
        payment_period: "",
      });
    },
    { message: /Payment period .* is required/i },
  );
});

test("Staff: deleteSalaryPayment voids payment and linked expense record", () => {
  const staff = createStaff({
    name: "Kamal Magar",
    role: "Office Assistant",
    base_salary: 18000,
  });

  const payment = recordSalaryPayment({
    staff_id: staff.id,
    amount: 18000,
    payment_period: "Baisakh 2083",
    syncWithExpenses: true,
  });

  assert.ok(payment.expense_id);
  assert.ok(getSalaryPaymentById(payment.id));

  // Verify deletion
  const deleted = deleteSalaryPayment(payment.id);
  assert.equal(deleted, true);

  // Payment is deleted
  assert.equal(getSalaryPaymentById(payment.id), null);

  // Linked expense is deleted
  const exp = queryOne("SELECT * FROM expenses WHERE id = ?", [payment.expense_id]);
  assert.equal(exp, null);

  // Deleting again returns false
  assert.equal(deleteSalaryPayment(payment.id), false);
});

test("Staff: deleteStaff cascades deletion to payments and expenses", () => {
  const staff = createStaff({
    name: "Ramesh Bogati",
    role: "Security",
    base_salary: 21000,
  });

  const p1 = recordSalaryPayment({
    staff_id: staff.id,
    amount: 21000,
    payment_period: "Month 1",
    syncWithExpenses: true,
  });

  const p2 = recordSalaryPayment({
    staff_id: staff.id,
    amount: 21000,
    payment_period: "Month 2",
    syncWithExpenses: true,
  });

  assert.equal(query("SELECT * FROM salary_payments WHERE staff_id = ?", [staff.id]).length, 2);
  assert.equal(query("SELECT * FROM expenses WHERE category = 'Salaries & Wages'").length, 2);

  // Delete staff
  const res = deleteStaff(staff.id);
  assert.equal(res, true);

  // Verify staff deleted
  assert.equal(getStaffById(staff.id), null);
  // Verify payments deleted
  assert.equal(query("SELECT * FROM salary_payments WHERE staff_id = ?", [staff.id]).length, 0);
  // Verify expenses deleted
  assert.equal(query("SELECT * FROM expenses WHERE id IN (?, ?)", [p1.expense_id, p2.expense_id]).length, 0);
});

test("Staff: getSalaryPayments filters by staff, date range, and keyword search", () => {
  const s1 = createStaff({ name: "Sarita KC", role: "Cashier", base_salary: 25000 });
  const s2 = createStaff({ name: "Binod Rai", role: "Driver", base_salary: 22000 });

  recordSalaryPayment({
    staff_id: s1.id,
    amount: 25000,
    payment_period: "January 2026",
    payment_date: "2026-01-31",
    reference: "REF-JAN-01",
    syncWithExpenses: false,
  });

  recordSalaryPayment({
    staff_id: s1.id,
    amount: 25000,
    payment_period: "February 2026",
    payment_date: "2026-02-28",
    reference: "REF-FEB-01",
    syncWithExpenses: false,
  });

  recordSalaryPayment({
    staff_id: s2.id,
    amount: 22000,
    payment_period: "January 2026",
    payment_date: "2026-01-31",
    reference: "REF-JAN-02",
    syncWithExpenses: false,
  });

  // All payments
  assert.equal(getSalaryPayments().length, 3);

  // Filter by staffId
  const s1Payments = getSalaryPayments({ staffId: s1.id });
  assert.equal(s1Payments.length, 2);
  assert.ok(s1Payments.every((p) => p.staff_id === s1.id));

  // Filter by date range (February only)
  const febPayments = getSalaryPayments({
    startDate: "2026-02-01",
    endDate: "2026-02-28",
  });
  assert.equal(febPayments.length, 1);
  assert.equal(febPayments[0].reference, "REF-FEB-01");

  // Search keyword (matches period or staff name)
  const searchBinod = getSalaryPayments({ search: "binod" });
  assert.equal(searchBinod.length, 1);
  assert.equal(searchBinod[0].staff_name, "Binod Rai");

  const searchFeb = getSalaryPayments({ search: "February" });
  assert.equal(searchFeb.length, 1);
  assert.equal(searchFeb[0].payment_period, "February 2026");
});

test("Staff: getStaffSummary calculates staff headcount and monthly payroll commitments", () => {
  createStaff({ name: "Staff One", role: "Clerk", base_salary: 30000, status: "active", salary_type: "monthly" });
  createStaff({ name: "Staff Two", role: "Cashier", base_salary: 20000, status: "active", salary_type: "monthly" });
  createStaff({ name: "Staff Inactive", role: "Security", base_salary: 25000, status: "inactive", salary_type: "monthly" });
  createStaff({ name: "Staff Daily", role: "Helper", base_salary: 500, status: "active", salary_type: "daily" });

  const summary = getStaffSummary();
  assert.equal(summary.total_staff, 4);
  assert.equal(summary.active_staff, 3);
  // Only active with monthly salary_type: 30000 + 20000 = 50000
  assert.equal(summary.monthly_payroll_commitment, 50000);
});

test("Staff: getMonthlyPayrollSummary tracks paid vs pending staff members accurately", () => {
  const s1 = createStaff({ name: "Deepak Lama", role: "Salesman", base_salary: 30000, status: "active" });
  const s2 = createStaff({ name: "Pooja Subedi", role: "Accountant", base_salary: 25000, status: "active" });

  // Period: June 2026 (year=2026, month=6)
  // Initially, both are pending
  const initialSummary = getMonthlyPayrollSummary(2026, 6);
  assert.equal(initialSummary.period_label, "June 2026");
  assert.equal(initialSummary.total_active_staff, 2);
  assert.equal(initialSummary.paid_count, 0);
  assert.equal(initialSummary.unpaid_count, 2);
  assert.equal(initialSummary.percent_paid, 0);
  assert.equal(initialSummary.total_commitment, 55000);
  assert.equal(initialSummary.total_paid, 0);
  assert.equal(initialSummary.total_pending, 55000);
  assert.equal(initialSummary.overall_status, "unpaid");

  // Disburse salary to s1 with bonus and deduction
  recordSalaryPayment({
    staff_id: s1.id,
    amount: 30000,
    bonus: 2000,
    deductions: 1000,
    payment_period: "June 2026",
    payment_date: "2026-06-28",
    syncWithExpenses: false,
  });

  const partialSummary = getMonthlyPayrollSummary(2026, 6);
  assert.equal(partialSummary.paid_count, 1);
  assert.equal(partialSummary.unpaid_count, 1);
  assert.equal(partialSummary.percent_paid, 50);
  assert.equal(partialSummary.total_paid, 31000); // 30000 + 2000 - 1000
  assert.equal(partialSummary.total_bonus, 2000);
  assert.equal(partialSummary.total_deductions, 1000);
  assert.equal(partialSummary.total_pending, 25000); // Only s2's 25000 is pending
  assert.equal(partialSummary.overall_status, "partially_paid");

  // Disburse salary to s2
  recordSalaryPayment({
    staff_id: s2.id,
    amount: 25000,
    payment_period: "June 2026",
    payment_date: "2026-06-29",
    syncWithExpenses: false,
  });

  const fullSummary = getMonthlyPayrollSummary(2026, 6);
  assert.equal(fullSummary.paid_count, 2);
  assert.equal(fullSummary.unpaid_count, 0);
  assert.equal(fullSummary.percent_paid, 100);
  assert.equal(fullSummary.total_pending, 0);
  assert.equal(fullSummary.overall_status, "fully_paid");
});
