/**
 * Feature: Multi-UOM Product Packagings & Multipliers Suite
 * Tests:
 * 1. createPackaging creates conversion rules (e.g. 1 Carton = 24 pcs, 1 Sack = 25 kg)
 * 2. getProductPackagings retrieves all packaging options for a product ordered by multiplier ASC
 * 3. getAllPackagings retrieves all system-wide packaging units
 * 4. getPackagingById retrieves specific packaging by ID
 * 5. deletePackaging removes packaging configuration
 * 6. Real CRUD on Product Packagings: raw SQL INSERT into product_packagings, direct SELECT, UPDATE, and DELETE
 */

import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment } from './setup.ts';

const {
  createPackaging,
  getProductPackagings,
  getAllPackagings,
  getPackagingById,
  deletePackaging,
} = await import('../src/lib/services/packagingService.ts');

const {
  createProduct,
} = await import('../src/lib/services/productService.ts');

const { queryOne, query, run } = await import('../src/lib/db/sqliteEngine.ts');

describe('Feature: Multi-UOM Product Packagings', () => {
  beforeEach(async () => {
    await setupTestEnvironment();
  });

  test('1. createPackaging creates conversion rules with multiplier, wholesale price, and barcode', () => {
    const prod = createProduct({
      name: 'Wai Wai Noodles 75g',
      unit: 'packet',
      cost_price: 2000, // Rs 20
      selling_price: 2500, // Rs 25
      current_stock: 240,
    });

    const box = createPackaging({
      productId: prod.id,
      packageName: 'Carton Box',
      packageUnit: 'box',
      multiplier: 30, // 1 Carton = 30 packets
      sellingPrice: 70000, // Wholesale Rs 700 (discounted from 30 * 25 = 750)
      barcode: '8901234567890',
    });

    assert.ok(box.id > 0);
    assert.equal(box.product_id, prod.id);
    assert.equal(box.package_name, 'Carton Box');
    assert.equal(box.package_unit, 'box');
    assert.equal(box.multiplier, 30);
    assert.equal(box.selling_price, 70000);
    assert.equal(box.barcode, '8901234567890');
  });

  test('2. getProductPackagings retrieves all packaging options for a product ordered by multiplier ASC', () => {
    const prod = createProduct({ name: 'Choco Biscuits', unit: 'pcs', cost_price: 1000, selling_price: 1500, current_stock: 500 });

    createPackaging({ productId: prod.id, packageName: 'Master Carton', packageUnit: 'ctn', multiplier: 48 });
    createPackaging({ productId: prod.id, packageName: 'Inner Pack', packageUnit: 'pack', multiplier: 6 });
    createPackaging({ productId: prod.id, packageName: 'Middle Box', packageUnit: 'box', multiplier: 12 });

    const packagings = getProductPackagings(prod.id);
    assert.equal(packagings.length, 3);
    assert.equal(packagings[0].multiplier, 6);
    assert.equal(packagings[1].multiplier, 12);
    assert.equal(packagings[2].multiplier, 48);
  });

  test('3. getAllPackagings retrieves all system-wide packaging units', () => {
    const p1 = createProduct({ name: 'Item 1', cost_price: 100, selling_price: 150, current_stock: 10 });
    const p2 = createProduct({ name: 'Item 2', cost_price: 200, selling_price: 300, current_stock: 10 });

    createPackaging({ productId: p1.id, packageName: 'Pack A', packageUnit: 'pack', multiplier: 5 });
    createPackaging({ productId: p2.id, packageName: 'Pack B', packageUnit: 'pack', multiplier: 10 });

    const all = getAllPackagings();
    assert.equal(all.length, 2);
  });

  test('4. getPackagingById retrieves specific packaging by ID', () => {
    const prod = createProduct({ name: 'Sugar', unit: 'kg', cost_price: 9000, selling_price: 11000, current_stock: 500 });
    const pkg = createPackaging({ productId: prod.id, packageName: '50kg Sack', packageUnit: 'sack', multiplier: 50 });

    const found = getPackagingById(pkg.id);
    assert.ok(found);
    assert.equal(found.id, pkg.id);
    assert.equal(found.package_name, '50kg Sack');

    assert.equal(getPackagingById(99999), null);
  });

  test('5. deletePackaging removes packaging configuration', () => {
    const prod = createProduct({ name: 'Coffee', cost_price: 1000, selling_price: 1500, current_stock: 10 });
    const pkg = createPackaging({ productId: prod.id, packageName: 'Strip of 10', packageUnit: 'strip', multiplier: 10 });

    deletePackaging(pkg.id);
    assert.equal(getPackagingById(pkg.id), null);
  });

  test('6. Real CRUD on Product Packagings: raw SQL INSERT into product_packagings, direct SELECT, UPDATE, and DELETE', () => {
    const prod = createProduct({ name: 'Direct SQL Product', cost_price: 500, selling_price: 800, current_stock: 50 });
    const now = new Date().toISOString();

    // 1. RAW SQL INSERT
    run(
      `INSERT INTO product_packagings (
        product_id, package_name, package_unit, multiplier, selling_price, barcode, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [prod.id, 'Raw Crate', 'crate', 24, 18000, 'CRATE-BAR-01', now, now]
    );

    const row = queryOne<{ id: number }>('SELECT last_insert_rowid() as id');
    const insertedId = row?.id ?? 0;
    assert.ok(insertedId > 0);

    // 2. RAW SQL SELECT
    const dbRow = queryOne<{
      id: number;
      product_id: number;
      package_name: string;
      package_unit: string;
      multiplier: number;
      selling_price: number;
      barcode: string;
    }>('SELECT * FROM product_packagings WHERE id = ?', [insertedId]);

    assert.ok(dbRow);
    assert.equal(dbRow.product_id, prod.id);
    assert.equal(dbRow.package_name, 'Raw Crate');
    assert.equal(dbRow.multiplier, 24);
    assert.equal(dbRow.selling_price, 18000);
    assert.equal(dbRow.barcode, 'CRATE-BAR-01');

    // 3. RAW SQL UPDATE
    run('UPDATE product_packagings SET multiplier = 20, selling_price = 15000 WHERE id = ?', [insertedId]);
    const updated = queryOne<{ multiplier: number; selling_price: number }>(
      'SELECT multiplier, selling_price FROM product_packagings WHERE id = ?',
      [insertedId]
    );
    assert.equal(updated?.multiplier, 20);
    assert.equal(updated?.selling_price, 15000);

    // 4. RAW SQL DELETE
    run('DELETE FROM product_packagings WHERE id = ?', [insertedId]);
    assert.equal(queryOne('SELECT * FROM product_packagings WHERE id = ?', [insertedId]), null);
  });
});

