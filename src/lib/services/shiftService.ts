/**
 * Shift & Cash Drawer Management Service
 * Supports opening float, live counter sales tracking,
 * physically counted closing cash, cash over/short variance, and Z-report reconciliation.
 */

import {
  ShiftSession,
  OpenShiftInput,
  CloseShiftInput,
} from "../../types/index.ts";
import { query, queryOne, run, transaction } from "../db/sqliteEngine.ts";

export interface ShiftLiveMetrics {
  openingFloat: number;
  cashSales: number;
  onlineSales: number;
  creditSales: number;
  cashRefunds: number;
  cashExpenses: number;
  expectedDrawerCash: number;
  totalTransactionsCount: number;
}

/**
 * Returns the currently active (OPEN) shift, or null if counter is closed.
 */
export function getCurrentOpenShift(): ShiftSession | null {
  return queryOne<ShiftSession>(
    "SELECT * FROM shift_sessions WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1",
  );
}

/**
 * Opens a new cashier shift with an opening cash float.
 */
export function openShift(input: OpenShiftInput): ShiftSession {
  const current = getCurrentOpenShift();
  if (current) {
    throw new Error(
      `A shift is already open by ${current.cashier_name} (Shift #${current.id}). Please close it first.`,
    );
  }

  const now = input.openedAt || new Date().toISOString();
  const openingFloat = Math.max(0, Math.floor(input.openingFloat));
  const cashier = input.cashierName.trim() || "Cashier";

  return transaction(() => {
    run(
      `INSERT INTO shift_sessions (
        cashier_name, staff_id, opening_float, status, notes, opened_at, created_at
      ) VALUES (?, ?, ?, 'OPEN', ?, ?, ?)`,
      [
        cashier,
        input.staffId || null,
        openingFloat,
        input.notes || null,
        now,
        now,
      ],
    );

    const insertedId = queryOne<{ id: number }>(
      "SELECT last_insert_rowid() as id",
    );
    const shift = queryOne<ShiftSession>(
      "SELECT * FROM shift_sessions WHERE id = ?",
      [insertedId?.id ?? 0],
    );
    if (!shift) {
      throw new Error("Failed to retrieve newly opened shift session");
    }
    return shift;
  });
}

/**
 * Computes live metrics for a shift based on transactions since it opened.
 */
export function getShiftLiveMetrics(shiftId: number): ShiftLiveMetrics {
  const shift = queryOne<ShiftSession>(
    "SELECT * FROM shift_sessions WHERE id = ?",
    [shiftId],
  );
  if (!shift) {
    throw new Error(`Shift #${shiftId} not found.`);
  }

  const openedAt = shift.opened_at;
  const closedAt = shift.closed_at || new Date().toISOString();

  // Aggregate Sales
  const salesRows = query<{
    grand_total: number;
    paid_amount: number | null;
    due_amount: number | null;
    payment_method: string | null;
  }>(
    "SELECT grand_total, paid_amount, due_amount, payment_method FROM sales WHERE created_at >= ? AND created_at <= ?",
    [openedAt, closedAt],
  );

  let cashSales = 0;
  let onlineSales = 0;
  let creditSales = 0;

  for (const s of salesRows) {
    const paid =
      s.paid_amount !== null && s.paid_amount !== undefined
        ? s.paid_amount
        : s.grand_total;
    const due = s.due_amount || 0;
    const method = (s.payment_method || 'Cash').toLowerCase().trim();
    if (method === 'cash') {
      cashSales += paid;
    } else {
      onlineSales += paid;
    }
    creditSales += due;
  }

  // Aggregate Customer Payments received in cash during this shift
  const customerPaymentsRow = queryOne<{ total_received: number }>(
    "SELECT COALESCE(SUM(amount), 0) as total_received FROM customer_payments WHERE payment_date >= ? AND payment_date <= ? AND (payment_method IS NULL OR LOWER(payment_method) = 'cash')",
    [openedAt, closedAt],
  );
  const cashDuesCollected = customerPaymentsRow?.total_received || 0;

  // Aggregate Sale Returns (Cash Refunds)
  const returnsRow = queryOne<{ total_refunds: number }>(
    "SELECT COALESCE(SUM(total_refund), 0) as total_refunds FROM sale_returns WHERE created_at >= ? AND created_at <= ? AND refund_method = 'CASH'",
    [openedAt, closedAt],
  );
  const cashRefunds = returnsRow?.total_refunds || 0;

  // Aggregate Expenses paid in cash
  const expensesRow = queryOne<{ total_expenses: number }>(
    "SELECT COALESCE(SUM(amount), 0) as total_expenses FROM expenses WHERE (date >= ? AND date <= ? OR created_at >= ? AND created_at <= ?) AND (payment_method IS NULL OR LOWER(payment_method) = 'cash')",
    [openedAt, closedAt, openedAt, closedAt],
  );
  const cashExpenses = expensesRow?.total_expenses || 0;

  const expectedDrawerCash =
    shift.opening_float + cashSales + cashDuesCollected - cashRefunds - cashExpenses;

  return {
    openingFloat: shift.opening_float,
    cashSales,
    onlineSales,
    creditSales,
    cashRefunds,
    cashExpenses,
    expectedDrawerCash,
    totalTransactionsCount: salesRows.length,
  };
}

/**
 * Closes an open shift, computes over/short variance, and finalizes audit snapshot.
 */
export function closeShift(input: CloseShiftInput): ShiftSession {
  const shift = queryOne<ShiftSession>(
    "SELECT * FROM shift_sessions WHERE id = ?",
    [input.shiftId],
  );
  if (!shift) {
    throw new Error(`Shift #${input.shiftId} not found.`);
  }
  if (shift.status === "CLOSED") {
    throw new Error(`Shift #${input.shiftId} is already closed.`);
  }

  const now = input.closedAt || new Date().toISOString();
  const metrics = getShiftLiveMetrics(shift.id);
  const counted = Math.max(0, Math.floor(input.closingCash));
  const variance = counted - metrics.expectedDrawerCash;

  return transaction(() => {
    run(
      `UPDATE shift_sessions SET
        closing_cash = ?,
        system_cash = ?,
        cash_sales = ?,
        online_sales = ?,
        credit_sales = ?,
        cash_refunds = ?,
        cash_expenses = ?,
        variance = ?,
        status = 'CLOSED',
        notes = ?,
        closed_at = ?
      WHERE id = ?`,
      [
        counted,
        metrics.expectedDrawerCash,
        metrics.cashSales,
        metrics.onlineSales,
        metrics.creditSales,
        metrics.cashRefunds,
        metrics.cashExpenses,
        variance,
        input.notes || shift.notes || null,
        now,
        shift.id,
      ],
    );

    const closed = queryOne<ShiftSession>(
      "SELECT * FROM shift_sessions WHERE id = ?",
      [shift.id],
    );
    if (!closed) {
      throw new Error("Failed to retrieve closed shift");
    }
    return closed;
  });
}

/**
 * Retrieves all shifts in descending order.
 */
export function getAllShifts(): ShiftSession[] {
  return query<ShiftSession>("SELECT * FROM shift_sessions ORDER BY id DESC");
}

/**
 * Retrieves a single shift by ID.
 */
export function getShiftById(id: number): ShiftSession | null {
  return queryOne<ShiftSession>("SELECT * FROM shift_sessions WHERE id = ?", [
    id,
  ]);
}
