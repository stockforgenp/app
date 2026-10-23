/**
 * Stock Write-Off, Spoilage & Quarantine Management Service
 * Handles disposal of expired, damaged, spoiled, lost, or dead stock
 * with scrap vouchers (WO-XXXXX), inventory deduction, and optional financial loss posting.
 */

import {
  StockWriteOff,
  CreateWriteOffInput,
  WriteOffReason,
  ProductBatch,
} from '../../types/index.ts';
import { query, queryOne, run, transaction } from '../db/sqliteEngine.ts';
import { getProductById } from './productService.ts';
import { getBatchById } from './batchService.ts';

export interface WriteOffSummary {
  totalLossAmount: number; // in minor units
  totalUnitsWrittenOff: number;
  totalVouchersCount: number;
  breakdownByReason: {
    reason: WriteOffReason;
    amount: number;
    count: number;
  }[];
}

export interface ExpiredCandidateItem {
  batchId: number;
  productId: number;
  productName: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  costPrice: number;
  totalLossValue: number;
}

/**
 * Creates a stock write-off record (Scrap / Disposal Voucher WO-XXXXX)
 */
export function createStockWriteOff(input: CreateWriteOffInput): StockWriteOff {
  const prod = getProductById(input.productId);
  if (!prod) {
    throw new Error(`Product #${input.productId} not found.`);
  }

  const q = Math.max(0.01, input.quantity);
  const now = input.createdAt || new Date().toISOString();
  const reason = input.reason || 'EXPIRED';
  const action = input.action || 'DISPOSAL';

  // Determine unit cost
  let unitCost = input.unitCost;
  if (unitCost === undefined || unitCost === null) {
    if (input.batchId) {
      const b = getBatchById(input.batchId);
      unitCost = b?.cost_price ?? prod.cost_price;
    } else {
      unitCost = prod.cost_price;
    }
  }

  const totalLoss = Math.round(q * unitCost);

  return transaction(() => {
    // Generate sequential voucher number
    const lastRecord = queryOne<{ id: number }>('SELECT id FROM stock_write_offs ORDER BY id DESC LIMIT 1');
    const nextId = (lastRecord?.id ?? 0) + 1;
    const voucherNumber = `WO-${nextId.toString().padStart(5, '0')}`;

    // 1. Insert stock_write_offs record
    run(
      `INSERT INTO stock_write_offs (
        voucher_number, product_id, product_name, quantity, unit_cost,
        total_loss, batch_id, batch_number, reason, action, approved_by,
        notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        voucherNumber,
        prod.id,
        prod.name,
        q,
        unitCost,
        totalLoss,
        input.batchId || null,
        input.batchNumber || null,
        reason,
        action,
        input.approvedBy?.trim() || null,
        input.notes?.trim() || null,
        now,
      ]
    );

    const insertedId = queryOne<{ id: number }>('SELECT last_insert_rowid() as id');
    const writeOffId = insertedId?.id ?? 0;

    // 2. Deduct physical stock from products
    run('UPDATE products SET current_stock = MAX(0, current_stock - ?), updated_at = ? WHERE id = ?', [
      q,
      now,
      prod.id,
    ]);

    // 3. Deduct from batch if specified
    if (input.batchId) {
      run('UPDATE product_batches SET quantity = MAX(0, quantity - ?) WHERE id = ?', [
        q,
        input.batchId,
      ]);
    }

    // 4. Record stock movement
    run(
      `INSERT INTO stock_movements (
        product_id, type, quantity, note, created_at
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        prod.id,
        'ADJUSTMENT',
        -q,
        `Write-off #${voucherNumber} (${reason}: ${action})`,
        now,
      ]
    );

    // 5. If recordAsExpense is requested, record in expenses table under 'Inventory Loss & Spoilage'
    if (input.recordAsExpense && totalLoss > 0) {
      const expDate = now.slice(0, 10);
      run(
        `INSERT INTO expenses (
          category, amount, date, payment_method, note, receipt_reference, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'Inventory Loss / Spoilage',
          totalLoss,
          expDate,
          'Non-Cash Loss',
          `Stock write-off for ${q} ${prod.unit || 'pcs'} of ${prod.name} (${reason})`,
          voucherNumber,
          now,
          now,
        ]
      );
    }

    const created = queryOne<StockWriteOff>('SELECT * FROM stock_write_offs WHERE id = ?', [writeOffId]);
    if (!created) {
      throw new Error('Failed to retrieve newly created stock write-off');
    }
    return created;
  });
}

/**
 * Retrieves all stock write-offs.
 */
export function getAllStockWriteOffs(): StockWriteOff[] {
  return query<StockWriteOff>('SELECT * FROM stock_write_offs ORDER BY id DESC');
}

/**
 * Returns write-off summary KPI stats and loss breakdown.
 */
export function getWriteOffSummary(): WriteOffSummary {
  const rows = query<StockWriteOff>('SELECT * FROM stock_write_offs');

  let totalLossAmount = 0;
  let totalUnitsWrittenOff = 0;
  const reasonMap: Record<WriteOffReason, { amount: number; count: number }> = {
    EXPIRED: { amount: 0, count: 0 },
    DAMAGED: { amount: 0, count: 0 },
    SPOILED_LEAKED: { amount: 0, count: 0 },
    LOST_STOLEN: { amount: 0, count: 0 },
    DEFECTIVE: { amount: 0, count: 0 },
    DEAD_STOCK: { amount: 0, count: 0 },
  };

  for (const r of rows) {
    totalLossAmount += r.total_loss;
    totalUnitsWrittenOff += r.quantity;
    if (reasonMap[r.reason]) {
      reasonMap[r.reason].amount += r.total_loss;
      reasonMap[r.reason].count += 1;
    }
  }

  const breakdownByReason = (Object.keys(reasonMap) as WriteOffReason[]).map((reason) => ({
    reason,
    amount: reasonMap[reason].amount,
    count: reasonMap[reason].count,
  }));

  return {
    totalLossAmount,
    totalUnitsWrittenOff,
    totalVouchersCount: rows.length,
    breakdownByReason,
  };
}

/**
 * Returns all active batches that have passed their expiry date with remaining stock.
 */
export function getExpiredBatchCandidates(): ExpiredCandidateItem[] {
  const today = new Date().toISOString().slice(0, 10);
  const rows = query<{
    id: number;
    product_id: number;
    product_name: string;
    batch_number: string;
    expiry_date: string;
    quantity: number;
    cost_price: number;
  }>(
    `SELECT b.id, b.product_id, p.name as product_name, b.batch_number, b.expiry_date, b.quantity, b.cost_price
     FROM product_batches b
     JOIN products p ON p.id = b.product_id
     WHERE b.expiry_date < ? AND b.quantity > 0
     ORDER BY b.expiry_date ASC`,
    [today]
  );

  return rows.map((r) => ({
    batchId: r.id,
    productId: r.product_id,
    productName: r.product_name,
    batchNumber: r.batch_number,
    expiryDate: r.expiry_date,
    quantity: r.quantity,
    costPrice: r.cost_price,
    totalLossValue: Math.round(r.quantity * r.cost_price),
  }));
}
