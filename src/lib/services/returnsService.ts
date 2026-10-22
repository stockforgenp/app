/**
 * Returns & Credit/Debit Notes Management Service
 * Implements full audit trail for:
 * 1. Customer Sales Returns with Credit Notes (CN-XXXXX) & optional restocking or damaged write-off.
 * 2. Vendor Purchase Returns with Debit Notes (DN-XXXXX) & inventory outflow deduction.
 */

import {
  Sale,
  Purchase,
  SaleReturn,
  SaleReturnItem,
  PurchaseReturn,
  PurchaseReturnItem,
  ReturnReason,
  ReturnAction,
  ReturnRefundMethod,
} from '../../types/index.ts';
import { query, queryOne, run, transaction } from '../db/sqliteEngine.ts';
import { getProductById } from './productService.ts';

export interface ProcessSaleReturnItemInput {
  productId: number;
  quantity: number;
  unitPrice: number; // in minor units (paisa)
  batchId?: number | null;
  batchNumber?: string | null;
  action?: ReturnAction; // 'RESTOCK' or 'DAMAGED'
}

export interface ProcessSaleReturnInput {
  saleId?: number | null;
  billNumber?: string | null;
  customerId?: number | null;
  customerName?: string | null;
  items: ProcessSaleReturnItemInput[];
  refundMethod?: ReturnRefundMethod; // 'CASH' | 'CREDIT_NOTE' | 'BANK'
  reason?: ReturnReason;
  notes?: string;
  createdAt?: string;
}

export interface ProcessPurchaseReturnItemInput {
  productId: number;
  quantity: number;
  costPrice: number; // in minor units (paisa)
  batchId?: number | null;
  batchNumber?: string | null;
}

export interface ProcessPurchaseReturnInput {
  purchaseId?: number | null;
  billNumber?: string | null;
  vendorId?: number | null;
  vendorName?: string | null;
  items: ProcessPurchaseReturnItemInput[];
  refundMethod?: 'CASH' | 'VENDOR_CREDIT' | 'BANK';
  reason?: ReturnReason;
  notes?: string;
  createdAt?: string;
}

/**
 * Processes a Sale Return (generates Credit Note CN-XXXXX)
 */
export function processSaleReturn(input: ProcessSaleReturnInput): {
  returnRecord: SaleReturn;
  items: SaleReturnItem[];
} {
  if (!input.items || input.items.length === 0) {
    throw new Error('At least one item is required to process a sale return.');
  }

  const now = input.createdAt || new Date().toISOString();
  const refundMethod = input.refundMethod || 'CASH';
  const reason = input.reason || 'CUSTOMER_CANCELLED';

  return transaction(() => {
    // Generate sequential Credit Note number
    const lastRecord = queryOne<{ id: number }>('SELECT id FROM sale_returns ORDER BY id DESC LIMIT 1');
    const nextId = (lastRecord?.id ?? 0) + 1;
    const returnNumber = `CN-${nextId.toString().padStart(5, '0')}`;

    // Resolve customer info from sale if not explicitly passed
    let resolvedCustomerId = input.customerId || null;
    let resolvedCustomerName = input.customerName || null;
    let origSale: Sale | null = null;
    if (input.saleId) {
      origSale = queryOne<Sale>('SELECT * FROM sales WHERE id = ?', [input.saleId]);
      if (origSale) {
        if (!resolvedCustomerId && origSale.customer_id) resolvedCustomerId = origSale.customer_id;
        if (!resolvedCustomerName && origSale.customer_name) resolvedCustomerName = origSale.customer_name;
      }
    }

    // Calculate total refund
    let totalRefund = 0;
    for (const it of input.items) {
      const q = Math.max(1, Math.floor(it.quantity));
      totalRefund += q * it.unitPrice;
    }

    // Insert sale_returns
    run(
      `INSERT INTO sale_returns (
        return_number, sale_id, bill_number, customer_id, customer_name,
        total_refund, refund_method, reason, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        returnNumber,
        input.saleId || null,
        input.billNumber || null,
        resolvedCustomerId,
        resolvedCustomerName,
        totalRefund,
        refundMethod,
        reason,
        input.notes || null,
        now,
      ]
    );

    const insertedId = queryOne<{ id: number }>('SELECT last_insert_rowid() as id');
    const returnId = insertedId?.id ?? 0;

    const savedItems: SaleReturnItem[] = [];

    for (const it of input.items) {
      const prod = getProductById(it.productId);
      if (!prod) {
        throw new Error(`Product #${it.productId} not found.`);
      }

      const q = Math.max(1, Math.floor(it.quantity));
      const lineTotal = q * it.unitPrice;
      const action: ReturnAction = it.action || 'RESTOCK';

      run(
        `INSERT INTO sale_return_items (
          return_id, product_id, product_name, quantity, unit_price, total,
          batch_id, batch_number, action, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          returnId,
          prod.id,
          prod.name,
          q,
          it.unitPrice,
          lineTotal,
          it.batchId || null,
          it.batchNumber || null,
          action,
          now,
        ]
      );

      // If RESTOCK action, add stock back to product and record movement
      if (action === 'RESTOCK') {
        run('UPDATE products SET current_stock = current_stock + ?, updated_at = ? WHERE id = ?', [
          q,
          now,
          prod.id,
        ]);

        run(
          `INSERT INTO stock_movements (
            product_id, type, quantity, reason, created_at
          ) VALUES (?, ?, ?, ?, ?)`,
          [
            prod.id,
            'RESTOCK',
            q,
            `Sale Return #${returnNumber} (${input.billNumber || 'Walk-in'})`,
            now,
          ]
        );

        // If batch was specified, restore batch stock
        if (it.batchId) {
          run('UPDATE product_batches SET quantity = quantity + ? WHERE id = ?', [q, it.batchId]);
        }
      }

      savedItems.push({
        id: queryOne<{ id: number }>('SELECT last_insert_rowid() as id')?.id ?? 0,
        return_id: returnId,
        product_id: prod.id,
        product_name: prod.name,
        quantity: q,
        unit_price: it.unitPrice,
        total: lineTotal,
        batch_id: it.batchId || null,
        batch_number: it.batchNumber || null,
        action,
        created_at: now,
      });
    }

    // If sale_id exists, update sales status and adjust due_amount for credit returns
    if (input.saleId) {
      const origTotal = origSale ? (origSale.grand_total ?? origSale.total) : 0;
      const priorReturns = queryOne<{ total: number }>(
        'SELECT COALESCE(SUM(total_refund), 0) as total FROM sale_returns WHERE sale_id = ? AND id != ?',
        [input.saleId, returnId]
      );
      const totalReturnedOnSale = (priorReturns?.total ?? 0) + totalRefund;
      const isFullReturn = origTotal > 0 && totalReturnedOnSale >= origTotal;
      const newStatus = isFullReturn ? 'RETURNED' : 'PARTIAL_RETURN';

      if (isFullReturn) {
        run('UPDATE sales SET status = ?, due_amount = 0, returned_at = ? WHERE id = ?', [
          'RETURNED',
          now,
          input.saleId,
        ]);
      } else {
        let updatedDue = origSale?.due_amount || 0;
        if (refundMethod === 'CREDIT_NOTE') {
          const dueReduction = Math.min(updatedDue, totalRefund);
          updatedDue = Math.max(0, updatedDue - dueReduction);
        }
        run('UPDATE sales SET status = ?, due_amount = ?, returned_at = ? WHERE id = ?', [
          'PARTIAL_RETURN',
          updatedDue,
          now,
          input.saleId,
        ]);
      }
    }

    const createdRecord = queryOne<SaleReturn>('SELECT * FROM sale_returns WHERE id = ?', [returnId]);
    if (!createdRecord) {
      throw new Error('Failed to retrieve newly created sale return');
    }

    return {
      returnRecord: createdRecord,
      items: savedItems,
    };
  });
}

/**
 * Processes a Purchase Return (generates Debit Note DN-XXXXX)
 */
export function processPurchaseReturn(input: ProcessPurchaseReturnInput): {
  returnRecord: PurchaseReturn;
  items: PurchaseReturnItem[];
} {
  if (!input.items || input.items.length === 0) {
    throw new Error('At least one item is required to process a purchase return.');
  }

  const now = input.createdAt || new Date().toISOString();
  const refundMethod = input.refundMethod || 'VENDOR_CREDIT';
  const reason = input.reason || 'DEFECTIVE';

  return transaction(() => {
    // Generate sequential Debit Note number
    const lastRecord = queryOne<{ id: number }>('SELECT id FROM purchase_returns ORDER BY id DESC LIMIT 1');
    const nextId = (lastRecord?.id ?? 0) + 1;
    const returnNumber = `DN-${nextId.toString().padStart(5, '0')}`;

    // Resolve vendor info from purchase if not explicitly passed
    let resolvedVendorId = input.vendorId || null;
    let resolvedVendorName = input.vendorName || null;
    let origPur: Purchase | null = null;
    if (input.purchaseId) {
      origPur = queryOne<Purchase>('SELECT * FROM purchases WHERE id = ?', [input.purchaseId]);
      if (origPur) {
        if (!resolvedVendorId && origPur.vendor_id) resolvedVendorId = origPur.vendor_id;
        if (!resolvedVendorName && origPur.vendor_name) resolvedVendorName = origPur.vendor_name;
      }
    }

    // Calculate total refund
    let totalRefund = 0;
    for (const it of input.items) {
      const q = Math.max(1, Math.floor(it.quantity));
      totalRefund += q * it.costPrice;
    }

    // Insert purchase_returns
    run(
      `INSERT INTO purchase_returns (
        return_number, purchase_id, bill_number, vendor_id, vendor_name,
        total_refund, refund_method, reason, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        returnNumber,
        input.purchaseId || null,
        input.billNumber || null,
        resolvedVendorId,
        resolvedVendorName,
        totalRefund,
        refundMethod,
        reason,
        input.notes || null,
        now,
      ]
    );

    const insertedId = queryOne<{ id: number }>('SELECT last_insert_rowid() as id');
    const returnId = insertedId?.id ?? 0;

    const savedItems: PurchaseReturnItem[] = [];

    for (const it of input.items) {
      const prod = getProductById(it.productId);
      if (!prod) {
        throw new Error(`Product #${it.productId} not found.`);
      }

      const q = Math.max(1, Math.floor(it.quantity));
      const lineTotal = q * it.costPrice;

      run(
        `INSERT INTO purchase_return_items (
          return_id, product_id, product_name, quantity, cost_price, total,
          batch_id, batch_number, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          returnId,
          prod.id,
          prod.name,
          q,
          it.costPrice,
          lineTotal,
          it.batchId || null,
          it.batchNumber || null,
          now,
        ]
      );

      // Inventory reduction & stock movement
      run('UPDATE products SET current_stock = current_stock - ?, updated_at = ? WHERE id = ?', [
        q,
        now,
        prod.id,
      ]);

      run(
        `INSERT INTO stock_movements (
          product_id, type, quantity, reason, created_at
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          prod.id,
          'ADJUSTMENT',
          -q,
          `Purchase Return #${returnNumber} (${input.billNumber || 'Vendor Return'})`,
          now,
        ]
      );

      // If batch was specified, reduce batch quantity
      if (it.batchId) {
        run('UPDATE product_batches SET quantity = MAX(0, quantity - ?) WHERE id = ?', [q, it.batchId]);
      }

      savedItems.push({
        id: queryOne<{ id: number }>('SELECT last_insert_rowid() as id')?.id ?? 0,
        return_id: returnId,
        product_id: prod.id,
        product_name: prod.name,
        quantity: q,
        cost_price: it.costPrice,
        total: lineTotal,
        batch_id: it.batchId || null,
        batch_number: it.batchNumber || null,
        created_at: now,
      });
    }

    // If purchase_id exists, update status and adjust due_amount for credit returns
    if (input.purchaseId) {
      const origTotal = origPur ? (origPur.grand_total ?? origPur.total) : 0;
      const priorReturns = queryOne<{ total: number }>(
        'SELECT COALESCE(SUM(total_refund), 0) as total FROM purchase_returns WHERE purchase_id = ? AND id != ?',
        [input.purchaseId, returnId]
      );
      const totalReturnedOnPur = (priorReturns?.total ?? 0) + totalRefund;
      const isFullReturn = origTotal > 0 && totalReturnedOnPur >= origTotal;
      const newStatus = isFullReturn ? 'RETURNED' : 'PARTIAL_RETURN';

      if (isFullReturn) {
        run('UPDATE purchases SET status = ?, due_amount = 0, returned_at = ? WHERE id = ?', [
          'RETURNED',
          now,
          input.purchaseId,
        ]);
      } else {
        let updatedDue = origPur?.due_amount || 0;
        if (refundMethod === 'VENDOR_CREDIT') {
          const dueReduction = Math.min(updatedDue, totalRefund);
          updatedDue = Math.max(0, updatedDue - dueReduction);
        }
        run('UPDATE purchases SET status = ?, due_amount = ?, returned_at = ? WHERE id = ?', [
          'PARTIAL_RETURN',
          updatedDue,
          now,
          input.purchaseId,
        ]);
      }
    }

    const createdRecord = queryOne<PurchaseReturn>('SELECT * FROM purchase_returns WHERE id = ?', [
      returnId,
    ]);
    if (!createdRecord) {
      throw new Error('Failed to retrieve newly created purchase return');
    }

    return {
      returnRecord: createdRecord,
      items: savedItems,
    };
  });
}

/**
 * Query functions
 */
export function getAllSaleReturns(): SaleReturn[] {
  return query<SaleReturn>('SELECT * FROM sale_returns ORDER BY id DESC');
}

export function getSaleReturnItems(returnId: number): SaleReturnItem[] {
  return query<SaleReturnItem>('SELECT * FROM sale_return_items WHERE return_id = ? ORDER BY id ASC', [
    returnId,
  ]);
}

export function getAllPurchaseReturns(): PurchaseReturn[] {
  return query<PurchaseReturn>('SELECT * FROM purchase_returns ORDER BY id DESC');
}

export function getPurchaseReturnItems(returnId: number): PurchaseReturnItem[] {
  return query<PurchaseReturnItem>(
    'SELECT * FROM purchase_return_items WHERE return_id = ? ORDER BY id ASC',
    [returnId]
  );
}

