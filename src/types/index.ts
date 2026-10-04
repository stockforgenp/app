/**
 * Core type definitions for StockForge Inventory & Sales Management
 */

export interface Product {
  id: number;
  name: string;
  sku: string | null;
  unit?: string | null; // e.g. 'pcs', 'kg', 'ltr', 'g', 'ml', 'box', 'packet', 'dozen', 'm'
  cost_price: number; // Stored in minor units (e.g. paisa/cents) or standard currency units
  selling_price: number; // Default selling price
  current_stock: number;
  min_stock_alert?: number | null; // Specific minimum alert threshold (defaults to app low_stock_threshold if null)
  vendor_id?: number | null;
  vendor_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LowStockAlertItem {
  productId: number;
  productName: string;
  productSku: string | null;
  productUnit?: string | null;
  previousStock: number;
  remainingStock: number;
  threshold: number;
  quantitySold: number;
}

export type StockMovementType = 'RESTOCK' | 'PURCHASE' | 'SALE' | 'ADJUSTMENT' | 'RETURN';

export interface StockMovement {
  id: number;
  product_id: number;
  product_name?: string;
  product_sku?: string | null;
  product_unit?: string | null;
  type: StockMovementType;
  quantity: number; // Positive for additions, negative for reductions
  reference_id: number | null; // e.g. sale_id
  vendor_id?: number | null;
  vendor_name?: string | null;
  note: string | null;
  created_at: string;
}

export interface Sale {
  id: number;
  bill_number?: string | null;
  customer_id?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_pan_vat?: string | null;
  customer_address?: string | null;
  subtotal: number;
  discount: number;
  taxable_amount?: number;
  vat_rate?: number;
  vat_amount?: number;
  grand_total?: number;
  total: number;
  cost_total?: number;
  gross_profit?: number;
  item_count?: number;
  created_at: string;
  lowStockAlerts?: LowStockAlertItem[];
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number;
  product_name?: string;
  product_sku?: string | null;
  product_unit?: string | null;
  quantity: number;
  cost_price: number; // Snapshot of cost price at time of sale
  selling_price: number; // Actual selling price for this sale
  discount: number; // Monetary discount applied to this line item
  total: number; // Net total: (quantity * selling_price) - discount
  cost_amount?: number; // quantity * cost_price
  gross_profit?: number; // total - cost_amount
}

export interface CartItem {
  product: Product;
  quantity: number;
  actual_selling_price: number;
  discount: number; // Monetary discount
}

export interface ProcessSaleItemInput {
  productId: number;
  quantity: number;
  actualSellingPrice: number; // in minor units
  discount: number; // in minor units
}

export interface ProcessSaleCustomerInfo {
  customerId?: number | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerPanVat?: string | null;
  customerAddress?: string | null;
  customerInput?: {
    name: string;
    phone?: string;
    email?: string;
    pan_vat?: string;
    address?: string;
    notes?: string;
  };
}

export interface Purchase {
  id: number;
  bill_number?: string | null;
  invoice_number?: string | null;
  vendor_id?: number | null;
  vendor_name?: string | null;
  vendor_phone?: string | null;
  vendor_email?: string | null;
  vendor_pan_vat?: string | null;
  vendor_address?: string | null;
  subtotal: number;
  discount: number;
  taxable_amount?: number;
  vat_rate?: number;
  vat_amount?: number;
  grand_total?: number;
  total: number;
  notes?: string | null;
  item_count?: number;
  total_units?: number;
  created_at: string;
}

export interface PurchaseItem {
  id: number;
  purchase_id: number;
  product_id: number;
  product_name?: string;
  product_sku?: string | null;
  product_unit?: string | null;
  quantity: number;
  cost_price: number; // Inflow purchase unit price
  selling_price?: number | null; // Retail selling price if modified
  discount: number;
  total: number; // (quantity * cost_price) - discount
}

export interface PurchaseCartItem {
  product: Product;
  quantity: number;
  cost_price: number; // Unit purchase price
  selling_price?: number; // Retail selling price
  discount: number; // Item discount
}

export interface ProcessPurchaseItemInput {
  productId: number;
  quantity: number;
  costPrice: number;
  sellingPrice?: number;
  discount: number;
}

export interface ProcessPurchaseVendorInfo {
  vendorId?: number | null;
  vendorName?: string | null;
  vendorPhone?: string | null;
  vendorEmail?: string | null;
  vendorPanVat?: string | null;
  vendorAddress?: string | null;
  invoiceNumber?: string | null;
  notes?: string | null;
  vendorInput?: {
    name: string;
    pan_vat?: string;
    phone?: string;
    email?: string;
    address?: string;
  };
}

export interface AppSettings {
  currency_symbol: string;
  low_stock_threshold: number;
  allow_negative_stock: boolean;
  store_name?: string;
  store_email?: string;
  store_phone?: string;
  store_type?: string;
  store_address?: string;
  store_pan_vat?: string;
  enable_vat?: boolean;
  receipt_footer?: string;
}

export interface Shop {
  id: number;
  name: string;
  email: string;
  phone: string;
  shop_type: string;
  address: string;
  currency_symbol: string;
  is_active: boolean | number;
  created_at: string;
  updated_at: string;
}

export interface RegisterShopInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  shop_type: string;
  address?: string;
  currency_symbol?: string;
  seedTestData: boolean;
}

export interface LoginInput {
  emailOrPhone: string;
  password: string;
  rememberMe?: boolean;
}

export interface FinancialSummary {
  sales_count: number;
  revenue: number; // Net sales total
  discounts: number;
  vat_collected?: number;
  cost_of_goods_sold: number;
  gross_profit: number;
  units_sold: number;
  total_expenses?: number;
  net_profit?: number; // gross_profit - total_expenses
}

export interface Expense {
  id: number;
  category: string;
  amount: number; // Stored in minor units (e.g. cents / paisa)
  date: string; // YYYY-MM-DD or ISO
  payment_method: string | null;
  note: string | null;
  receipt_reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseCategoryBreakdown {
  category: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface ExpenseSummary {
  total_expenses: number;
  expense_count: number;
  categoryBreakdown: ExpenseCategoryBreakdown[];
}

export interface ProductAnalytics {
  product_id: number;
  name: string;
  sku: string | null;
  current_stock: number;
  units_sold: number;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
}

export interface DailySalesData {
  date: string;
  revenue: number;
  profit: number;
  transactions: number;
}

export interface TestResultItem {
  name: string;
  passed: boolean;
  message: string;
  expected?: string | number;
  actual?: string | number;
}

export type StaffRole =
  | 'Store Manager'
  | 'Cashier'
  | 'Sales Associate'
  | 'Inventory Manager'
  | 'Delivery Person'
  | 'Accountant'
  | 'Security Guard'
  | 'Cleaner'
  | 'Other';

export type SalaryType = 'monthly' | 'daily' | 'hourly';
export type StaffStatus = 'active' | 'inactive';

export interface Staff {
  id: number;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  base_salary: number; // in minor units
  salary_type: SalaryType;
  status: StaffStatus;
  join_date: string; // YYYY-MM-DD
  notes: string | null;
  created_at: string;
  updated_at: string;
  total_paid?: number;
  last_payment_date?: string | null;
}

export interface SalaryPayment {
  id: number;
  staff_id: number;
  staff_name?: string;
  staff_role?: string;
  amount: number; // base salary portion (minor units)
  bonus: number; // bonus amount (minor units)
  deductions: number; // deductions (minor units)
  net_paid: number; // net total paid: amount + bonus - deductions (minor units)
  payment_date: string; // YYYY-MM-DD
  payment_period: string; // e.g. "October 2026"
  payment_method: string;
  reference: string | null;
  note: string | null;
  expense_id: number | null;
  created_at: string;
}

export interface CreateStaffInput {
  name: string;
  role: string;
  phone?: string | null;
  email?: string | null;
  base_salary: number; // minor units
  salary_type?: SalaryType;
  status?: StaffStatus;
  join_date?: string;
  notes?: string | null;
}

export interface UpdateStaffInput {
  name?: string;
  role?: string;
  phone?: string | null;
  email?: string | null;
  base_salary?: number;
  salary_type?: SalaryType;
  status?: StaffStatus;
  join_date?: string;
  notes?: string | null;
}

export interface RecordSalaryInput {
  staff_id: number;
  amount: number; // minor units
  bonus?: number; // minor units
  deductions?: number; // minor units
  payment_date?: string; // YYYY-MM-DD
  payment_period: string; // e.g. "October 2026"
  payment_method?: string;
  reference?: string | null;
  note?: string | null;
  syncWithExpenses?: boolean;
}

export interface StaffSummary {
  total_staff: number;
  active_staff: number;
  monthly_payroll_commitment: number;
  total_salaries_paid_this_month: number;
  payments_count_this_month: number;
}

export interface StaffMonthlyPayrollStatus {
  staff_id: number;
  staff_name: string;
  staff_role: string;
  salary_type: SalaryType;
  base_salary: number; // minor units
  status: StaffStatus;
  is_paid: boolean;
  payment?: SalaryPayment;
  amount_paid?: number; // minor units
  payment_date?: string;
  payment_method?: string;
  payment_period?: string;
}

export interface TodayPayrollStatus {
  date: string; // YYYY-MM-DD
  formatted: string; // e.g. "October 1, 2026"
  is_paid: boolean;
  payments_count: number;
  total_paid: number; // minor units
}

export interface MonthlyPayrollSummary {
  period_label: string; // e.g. "September 2026"
  year: number;
  month: number; // 1-12
  is_current_month: boolean;
  total_active_staff: number;
  paid_count: number;
  unpaid_count: number;
  percent_paid: number;
  total_commitment: number; // minor units
  total_paid: number; // minor units
  total_pending: number; // minor units
  overall_status: 'fully_paid' | 'partially_paid' | 'unpaid';
  staff_statuses: StaffMonthlyPayrollStatus[];
  today_status: TodayPayrollStatus;
}

export interface Vendor {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  pan_vat?: string | null;
  address?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  product_count?: number;
  total_purchased?: number;
}

export interface CreateVendorInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  pan_vat?: string | null;
  address?: string | null;
  notes?: string | null;
}

export interface Customer {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  pan_vat?: string | null;
  address?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  sales_count?: number;
  total_spent?: number;
}

export interface CreateCustomerInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  pan_vat?: string | null;
  address?: string | null;
  notes?: string | null;
}
