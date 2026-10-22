/**
 * SQLite Database Schema Definition
 */

export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS shops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone TEXT,
  shop_type TEXT NOT NULL DEFAULT 'General Retail',
  address TEXT,
  currency_symbol TEXT DEFAULT 'Rs.',
  is_active INTEGER DEFAULT 1,
  subscription_status TEXT NOT NULL DEFAULT 'active',
  subscription_plan TEXT NOT NULL DEFAULT 'Standard',
  subscribed_date TEXT,
  subscription_duration_days INTEGER DEFAULT 365,
  subscription_expiry_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  pan_vat TEXT,
  address TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  pan_vat TEXT,
  address TEXT,
  notes TEXT,
  customer_type TEXT NOT NULL DEFAULT 'RETAIL',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sku TEXT,
  unit TEXT DEFAULT 'pcs',
  cost_price INTEGER NOT NULL,
  selling_price INTEGER NOT NULL,
  wholesale_price INTEGER DEFAULT NULL,
  wholesale_min_qty INTEGER DEFAULT NULL,
  current_stock INTEGER NOT NULL DEFAULT 0,
  min_stock_alert INTEGER DEFAULT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_number TEXT,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_pan_vat TEXT,
  customer_address TEXT,
  subtotal INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  taxable_amount INTEGER,
  vat_rate REAL DEFAULT 13.0,
  vat_amount INTEGER NOT NULL DEFAULT 0,
  grand_total INTEGER,
  total INTEGER NOT NULL,
  paid_amount INTEGER DEFAULT NULL,
  due_amount INTEGER DEFAULT 0,
  payment_method TEXT DEFAULT 'Cash',
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  returned_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_number TEXT NOT NULL,
  mfg_date TEXT,
  expiry_date TEXT NOT NULL,
  cost_price INTEGER NOT NULL,
  selling_price INTEGER,
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_packagings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  package_name TEXT NOT NULL,
  package_unit TEXT NOT NULL,
  multiplier REAL NOT NULL,
  selling_price INTEGER,
  barcode TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  batch_id INTEGER REFERENCES product_batches(id) ON DELETE SET NULL,
  batch_number TEXT,
  expiry_date TEXT,
  pricing_tier TEXT DEFAULT 'RETAIL',
  packaging_id INTEGER REFERENCES product_packagings(id) ON DELETE SET NULL,
  package_multiplier REAL DEFAULT 1,
  packaging_name TEXT,
  quantity INTEGER NOT NULL,
  cost_price INTEGER NOT NULL,
  selling_price INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_number TEXT,
  invoice_number TEXT,
  vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
  vendor_name TEXT,
  vendor_phone TEXT,
  vendor_email TEXT,
  vendor_pan_vat TEXT,
  vendor_address TEXT,
  subtotal INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  taxable_amount INTEGER,
  vat_rate REAL DEFAULT 13.0,
  vat_amount INTEGER NOT NULL DEFAULT 0,
  grand_total INTEGER,
  total INTEGER NOT NULL,
  paid_amount INTEGER DEFAULT NULL,
  due_amount INTEGER DEFAULT 0,
  payment_method TEXT DEFAULT 'Cash',
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  returned_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  product_name TEXT,
  product_sku TEXT,
  batch_id INTEGER REFERENCES product_batches(id) ON DELETE SET NULL,
  batch_number TEXT,
  expiry_date TEXT,
  mfg_date TEXT,
  packaging_id INTEGER REFERENCES product_packagings(id) ON DELETE SET NULL,
  package_multiplier REAL DEFAULT 1,
  packaging_name TEXT,
  quantity INTEGER NOT NULL,
  cost_price INTEGER NOT NULL,
  selling_price INTEGER,
  discount INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL
);

-- Alias view for purchase_products as requested
CREATE VIEW IF NOT EXISTS purchase_products AS SELECT * FROM purchase_items;

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  reference_id INTEGER,
  vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
  vendor_name TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  amount INTEGER NOT NULL,
  date TEXT NOT NULL,
  payment_method TEXT,
  note TEXT,
  receipt_reference TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);


CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  base_salary INTEGER NOT NULL DEFAULT 0,
  salary_type TEXT NOT NULL DEFAULT 'monthly',
  status TEXT NOT NULL DEFAULT 'active',
  join_date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS salary_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  bonus INTEGER NOT NULL DEFAULT 0,
  deductions INTEGER NOT NULL DEFAULT 0,
  net_paid INTEGER NOT NULL,
  payment_date TEXT NOT NULL,
  payment_period TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  reference TEXT,
  note TEXT,
  expense_id INTEGER REFERENCES expenses(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL,
  payment_method TEXT DEFAULT 'Cash',
  payment_date TEXT NOT NULL,
  receipt_number TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vendor_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL,
  payment_method TEXT DEFAULT 'Cash',
  payment_date TEXT NOT NULL,
  receipt_number TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customer_payments_customer_id ON customer_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_sale_id ON customer_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_date ON customer_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_vendor_payments_vendor_id ON vendor_payments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payments_purchase_id ON vendor_payments(purchase_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payments_date ON vendor_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_bill_number ON sales(bill_number);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_staff_status ON staff(status);
CREATE INDEX IF NOT EXISTS idx_salary_payments_staff_id ON salary_payments(staff_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_date ON salary_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_salary_payments_period ON salary_payments(payment_period);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shops_email ON shops(email);
CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(name);
CREATE INDEX IF NOT EXISTS idx_vendors_pan_vat ON vendors(pan_vat);
CREATE INDEX IF NOT EXISTS idx_vendors_phone ON vendors(phone);
CREATE INDEX IF NOT EXISTS idx_stock_movements_vendor_id ON stock_movements(vendor_id);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_pan_vat ON customers(pan_vat);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_purchases_vendor_id ON purchases(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchases_bill_number ON purchases(bill_number);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product_id ON purchase_items(product_id);
CREATE INDEX IF NOT EXISTS idx_batches_product_id ON product_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON product_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_sale_items_batch_id ON sale_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_batch_id ON purchase_items(batch_id);

CREATE TABLE IF NOT EXISTS sale_returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_number TEXT NOT NULL UNIQUE,
  sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  bill_number TEXT,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  total_refund INTEGER NOT NULL,
  refund_method TEXT NOT NULL DEFAULT 'CASH',
  reason TEXT NOT NULL DEFAULT 'CUSTOMER_CANCELLED',
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sale_return_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id INTEGER NOT NULL REFERENCES sale_returns(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  total INTEGER NOT NULL,
  batch_id INTEGER REFERENCES product_batches(id),
  batch_number TEXT,
  action TEXT NOT NULL DEFAULT 'RESTOCK',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_number TEXT NOT NULL UNIQUE,
  purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL,
  bill_number TEXT,
  vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
  vendor_name TEXT,
  total_refund INTEGER NOT NULL,
  refund_method TEXT NOT NULL DEFAULT 'VENDOR_CREDIT',
  reason TEXT NOT NULL DEFAULT 'DEFECTIVE',
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_return_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id INTEGER NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  cost_price INTEGER NOT NULL,
  total INTEGER NOT NULL,
  batch_id INTEGER REFERENCES product_batches(id),
  batch_number TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sale_returns_sale_id ON sale_returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_returns_customer_id ON sale_returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_sale_return_items_return_id ON sale_return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_purchase_id ON purchase_returns(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_vendor_id ON purchase_returns(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_return_id ON purchase_return_items(return_id);

CREATE TABLE IF NOT EXISTS shift_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cashier_name TEXT NOT NULL,
  staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  opening_float INTEGER NOT NULL DEFAULT 0,
  closing_cash INTEGER,
  system_cash INTEGER,
  cash_sales INTEGER NOT NULL DEFAULT 0,
  online_sales INTEGER NOT NULL DEFAULT 0,
  credit_sales INTEGER NOT NULL DEFAULT 0,
  cash_refunds INTEGER NOT NULL DEFAULT 0,
  cash_expenses INTEGER NOT NULL DEFAULT 0,
  variance INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'OPEN',
  notes TEXT,
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shift_sessions_status ON shift_sessions(status);
CREATE INDEX IF NOT EXISTS idx_shift_sessions_opened_at ON shift_sessions(opened_at);

CREATE TABLE IF NOT EXISTS stock_write_offs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_number TEXT NOT NULL UNIQUE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_cost INTEGER NOT NULL,
  total_loss INTEGER NOT NULL,
  batch_id INTEGER REFERENCES product_batches(id) ON DELETE SET NULL,
  batch_number TEXT,
  reason TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'DISPOSAL',
  approved_by TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_write_offs_product_id ON stock_write_offs(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_write_offs_reason ON stock_write_offs(reason);
CREATE INDEX IF NOT EXISTS idx_stock_write_offs_created_at ON stock_write_offs(created_at);
`;
