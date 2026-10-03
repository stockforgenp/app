/**
 * Initial sample seed data for first launch
 */
import { Database } from 'sql.js';

export function seedInitialData(db: Database) {
  // Check if products already exist
  const res = db.exec('SELECT COUNT(*) as count FROM products');
  if (res.length > 0 && res[0].values[0][0] as number > 0) {
    return;
  }

  const now = new Date();
  const todayISO = now.toISOString();
  
  // Sample products (amounts in minor units / cents / paisa)
  const initialProducts = [
    { name: 'Coca Cola 500ml', sku: 'BEV-CC-500', unit: 'bottle', cost: 4500, selling: 6000, stock: 100 },
    { name: 'Pepsi 500ml', sku: 'BEV-PEP-500', unit: 'bottle', cost: 4200, selling: 5500, stock: 85 },
    { name: 'Classic Potato Chips 50g', sku: 'SNK-CHP-050', unit: 'pkt', cost: 2000, selling: 3000, stock: 60 },
    { name: 'Natural Mineral Water 1L', sku: 'BEV-WAT-1000', unit: 'bottle', cost: 1800, selling: 2500, stock: 150 },
    { name: 'Instant Masala Noodles 75g', sku: 'SNK-NOD-075', unit: 'pkt', cost: 2800, selling: 4000, stock: 45 },
    { name: 'Dark Chocolate Bar 40g', sku: 'SNK-CHO-040', unit: 'pcs', cost: 5000, selling: 7000, stock: 7 }, // Low stock
    { name: 'Premium Green Tea 25s', sku: 'BEV-TEA-025', unit: 'box', cost: 12000, selling: 16000, stock: 5 }, // Low stock
    { name: 'Basmati Rice 1kg', sku: 'GRN-RIC-001', unit: 'kg', cost: 11000, selling: 14500, stock: 32 },
  ];

  for (const p of initialProducts) {
    db.run(
      `INSERT INTO products (name, sku, unit, cost_price, selling_price, current_stock, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.name, p.sku, p.unit, p.cost, p.selling, p.stock, todayISO, todayISO]
    );

    // Get product ID
    const idRes = db.exec('SELECT last_insert_rowid()');
    const productId = idRes[0].values[0][0] as number;

    // Record initial restock movement
    db.run(
      `INSERT INTO stock_movements (product_id, type, quantity, reference_id, note, created_at)
       VALUES (?, 'RESTOCK', ?, NULL, 'Initial opening inventory setup', ?)`,
      [productId, p.stock, todayISO]
    );
  }

  // Insert default settings
  db.run(`INSERT OR IGNORE INTO app_settings (key, value) VALUES ('currency_symbol', 'Rs.')`);
  db.run(`INSERT OR IGNORE INTO app_settings (key, value) VALUES ('low_stock_threshold', '10')`);
  db.run(`INSERT OR IGNORE INTO app_settings (key, value) VALUES ('allow_negative_stock', 'false')`);

  // Create a realistic sample sale demonstrating the exact calculation from section 5 & 8
  // Sale #1:
  // Coca Cola: 5 × Rs. 60 = Rs. 300, Pepsi: 2 × Rs. 55 = Rs. 110, Chips: 3 × Rs. 30 = Rs. 90
  // Gross Subtotal: Rs. 500, Discount on items: Rs. 30 (Chips: Rs. 30 discount -> Rs. 60 net)
  // Total: Rs. 470
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  
  db.run(
    `INSERT INTO sales (customer_name, customer_phone, subtotal, discount, total, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ['Sarah Jenkins', '+1 (555) 234-5678', 50000, 3000, 47000, yesterday]
  );
  
  const saleIdRes = db.exec('SELECT last_insert_rowid()');
  const saleId = saleIdRes[0].values[0][0] as number;

  // Sale Items
  // 1. Coca Cola (5 x 60 = 300, cost 45, discount 0)
  db.run(
    `INSERT INTO sale_items (sale_id, product_id, quantity, cost_price, selling_price, discount, total)
     VALUES (?, 1, 5, 4500, 6000, 0, 30000)`,
    [saleId]
  );
  db.run(
    `INSERT INTO stock_movements (product_id, type, quantity, reference_id, note, created_at)
     VALUES (1, 'SALE', -5, ?, 'Completed Sale #${saleId}', ?)`,
    [saleId, yesterday]
  );

  // 2. Pepsi (2 x 55 = 110, cost 42, discount 0)
  db.run(
    `INSERT INTO sale_items (sale_id, product_id, quantity, cost_price, selling_price, discount, total)
     VALUES (?, 2, 2, 4200, 5500, 0, 11000)`,
    [saleId]
  );
  db.run(
    `INSERT INTO stock_movements (product_id, type, quantity, reference_id, note, created_at)
     VALUES (2, 'SALE', -2, ?, 'Completed Sale #${saleId}', ?)`,
    [saleId, yesterday]
  );

  // 3. Chips (3 x 30 = 90, cost 20, discount 30 = net 60)
  db.run(
    `INSERT INTO sale_items (sale_id, product_id, quantity, cost_price, selling_price, discount, total)
     VALUES (?, 3, 3, 2000, 3000, 3000, 6000)`,
    [saleId]
  );
  db.run(
    `INSERT INTO stock_movements (product_id, type, quantity, reference_id, note, created_at)
     VALUES (3, 'SALE', -3, ?, 'Completed Sale #${saleId}', ?)`,
    [saleId, yesterday]
  );

  // Sample initial expenses
  const sampleExpenses = [
    {
      category: 'Rent & Lease',
      amount: 1500000, // Rs. 15,000
      date: yesterday.split('T')[0],
      payment_method: 'Bank Transfer',
      note: 'Monthly retail shop lease',
      receipt_reference: 'LEASE-2026-09',
    },
    {
      category: 'Utilities (Electricity, Water)',
      amount: 350000, // Rs. 3,500
      date: yesterday.split('T')[0],
      payment_method: 'Digital Wallet',
      note: 'Electricity bill payment for commercial meter',
      receipt_reference: 'UTIL-ELEC-8812',
    },
    {
      category: 'Packaging & Bags',
      amount: 180000, // Rs. 1,800
      date: todayISO.split('T')[0],
      payment_method: 'Cash',
      note: '500x Recyclable paper shopping bags',
      receipt_reference: 'SUP-BAG-402',
    },
    {
      category: 'Internet & Software',
      amount: 120000, // Rs. 1,200
      date: todayISO.split('T')[0],
      payment_method: 'Card',
      note: 'High-speed broadband fiber for POS system',
      receipt_reference: 'INV-FIBER-91',
    },
  ];

  for (const exp of sampleExpenses) {
    db.run(
      `INSERT INTO expenses (category, amount, date, payment_method, note, receipt_reference, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        exp.category,
        exp.amount,
        exp.date,
        exp.payment_method,
        exp.note,
        exp.receipt_reference,
        todayISO,
        todayISO,
      ]
    );
  }

  // Seed sample staff members if table is empty
  try {
    const staffCheck = db.exec("SELECT COUNT(*) as count FROM staff");
    if (staffCheck.length > 0 && (staffCheck[0].values[0][0] as number) === 0) {
      const sampleStaff = [
        {
          name: 'Asif Khan',
          role: 'Store Manager',
          phone: '+92 300 5551234',
          email: 'asif.khan@example.com',
          base_salary: 4500000,
          salary_type: 'monthly',
          status: 'active',
          join_date: '2025-01-15',
          notes: 'Full store operations and key holder',
        },
        {
          name: 'Bilal Ahmed',
          role: 'Cashier',
          phone: '+92 321 4445678',
          email: 'bilal.ahmed@example.com',
          base_salary: 2800000,
          salary_type: 'monthly',
          status: 'active',
          join_date: '2025-04-01',
          notes: 'Morning shift counter POS cashier',
        },
        {
          name: 'Hamza Tariq',
          role: 'Sales Associate',
          phone: '+92 333 7778901',
          email: 'hamza.t@example.com',
          base_salary: 2500000,
          salary_type: 'monthly',
          status: 'active',
          join_date: '2025-08-10',
          notes: 'Customer assistance & shelf restocking',
        },
      ];

      for (const s of sampleStaff) {
        db.run(
          `INSERT INTO staff (name, role, phone, email, base_salary, salary_type, status, join_date, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            s.name,
            s.role,
            s.phone,
            s.email,
            s.base_salary,
            s.salary_type,
            s.status,
            s.join_date,
            s.notes,
            todayISO,
            todayISO,
          ]
        );
      }

      const firstStaff = db.exec("SELECT id, name FROM staff LIMIT 1");
      if (firstStaff.length > 0 && firstStaff[0].values.length > 0) {
        const staffId = firstStaff[0].values[0][0] as number;
        db.run(
          `INSERT INTO salary_payments (staff_id, amount, bonus, deductions, net_paid, payment_date, payment_period, payment_method, reference, note, expense_id, created_at)
           VALUES (?, 4500000, 200000, 0, 4700000, ?, 'Previous Month', 'Bank Transfer', 'TXN-SAL-0091', 'Base salary plus festival bonus', NULL, ?)`,
          [staffId, todayISO.split('T')[0], todayISO]
        );
      }
    }
  } catch (e) {
    console.error('Error seeding staff:', e);
  }
}

/**
 * Clear all sample/test data to start a registered shop with a completely clean slate
 */
export function clearAllTestData(db: Database) {
  try {
    db.run('DELETE FROM sale_items;');
    db.run('DELETE FROM stock_movements;');
    db.run('DELETE FROM salary_payments;');
    db.run('DELETE FROM sales;');
    db.run('DELETE FROM products;');
    db.run('DELETE FROM expenses;');
    db.run('DELETE FROM staff;');
    // Reset sqlite autoincrement sequences
    db.run("DELETE FROM sqlite_sequence WHERE name IN ('products', 'sales', 'sale_items', 'stock_movements', 'expenses', 'staff', 'salary_payments');");
  } catch (err) {
    console.error('Error clearing test data:', err);
  }
}
