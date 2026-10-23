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
  wholesale_price?: number | null; // Wholesale tier price in minor units
  wholesale_min_qty?: number | null; // Minimum qty threshold to trigger wholesale rate
  current_stock: number;
  min_stock_alert?: number | null; // Specific minimum alert threshold (defaults to app low_stock_threshold if null)
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

export type StockMovementType =
  | "RESTOCK"
  | "PURCHASE"
  | "SALE"
  | "ADJUSTMENT"
  | "RETURN";

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
  customer_pan_vat?: string | null;
  customer_address?: string | null;
  subtotal: number;
  discount: number;
  taxable_amount?: number;
  vat_rate?: number;
  vat_amount?: number;
  grand_total?: number;
  total: number;
  paid_amount?: number;
  due_amount?: number;
  payment_method?: string | null;
  previous_due?: number;
  total_due?: number;
  cost_total?: number;
  gross_profit?: number;
  item_count?: number;
  status?: "COMPLETED" | "RETURNED" | "PARTIAL_RETURN";
  returned_at?: string | null;
  created_at: string;
  lowStockAlerts?: LowStockAlertItem[];
}

export interface ProductBatch {
  id: number;
  product_id: number;
  product_name?: string;
  product_sku?: string | null;
  product_unit?: string | null;
  batch_number: string;
  mfg_date?: string | null;
  expiry_date: string;
  cost_price: number;
  selling_price?: number | null;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface ProductPackaging {
  id: number;
  product_id: number;
  package_name: string; // e.g. 'Carton', 'Sack', 'Box', 'Strip', 'Dozen'
  package_unit: string; // e.g. 'ctn', 'sack', 'box', 'strip', 'dzn'
  multiplier: number; // Conversion factor, e.g. 24, 25, 10, 12
  selling_price?: number | null; // Optional package-level selling price
  barcode?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number;
  product_name?: string;
  product_sku?: string | null;
  product_unit?: string | null;
  batch_id?: number | null;
  batch_number?: string | null;
  expiry_date?: string | null;
  pricing_tier?: "RETAIL" | "WHOLESALE";
  packaging_id?: number | null;
  package_multiplier?: number;
  packaging_name?: string | null;
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
  batch_id?: number | null;
  batch_number?: string | null;
  expiry_date?: string | null;
  pricing_tier?: "RETAIL" | "WHOLESALE";
  packaging_id?: number | null;
  package_multiplier?: number;
  packaging_name?: string | null;
}

export interface ProcessSaleItemInput {
  productId: number;
  quantity: number;
  actualSellingPrice: number; // in minor units
  discount: number; // in minor units
  batchId?: number | null;
  pricingTier?: "RETAIL" | "WHOLESALE";
  packagingId?: number | null;
  packageMultiplier?: number;
}

export interface ProcessSaleCustomerInfo {
  customerId?: number | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerPanVat?: string | null;
  customerAddress?: string | null;
  applyVat?: boolean;
  paidAmount?: number;
  paymentMethod?: string;
  createdAt?: string | null;
  customerInput?: {
    name: string;
    phone?: string;
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
  paid_amount?: number;
  due_amount?: number;
  payment_method?: string | null;
  previous_due?: number;
  total_due?: number;
  notes?: string | null;
  item_count?: number;
  total_units?: number;
  status?: "COMPLETED" | "RETURNED" | "PARTIAL_RETURN";
  returned_at?: string | null;
  created_at: string;
}

export interface PurchaseItem {
  id: number;
  purchase_id: number;
  product_id: number;
  product_name?: string;
  product_sku?: string | null;
  product_unit?: string | null;
  batch_id?: number | null;
  batch_number?: string | null;
  expiry_date?: string | null;
  mfg_date?: string | null;
  packaging_id?: number | null;
  package_multiplier?: number;
  packaging_name?: string | null;
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
  batch_number?: string;
  expiry_date?: string;
  mfg_date?: string;
  packaging_id?: number | null;
  package_multiplier?: number;
  packaging_name?: string | null;
}

export interface ProcessPurchaseItemInput {
  productId: number;
  quantity: number;
  costPrice: number;
  sellingPrice?: number;
  discount: number;
  batchNumber?: string;
  expiryDate?: string;
  mfgDate?: string;
  packagingId?: number | null;
  packageMultiplier?: number;
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
  applyVat?: boolean;
  paidAmount?: number;
  paymentMethod?: string;
  createdAt?: string | null;
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
  google_client_id?: string;
  google_sheet_backup_id?: string;
  google_sheet_backup_url?: string;
  google_sheet_last_backup?: string;
  calendar_system?: CalendarSystem;
}

export type CalendarSystem = "BS" | "AD";

export type SubscriptionStatus =
  | "active"
  | "expired"
  | "trial"
  | "grace_period";

export interface Shop {
  id: number;
  name: string;
  email: string;
  phone: string;
  shop_type: string;
  address: string;
  currency_symbol: string;
  is_active: boolean | number;
  subscription_status?: SubscriptionStatus;
  subscription_plan?: string;
  subscribed_date?: string;
  subscription_duration_days?: number;
  subscription_duration_months?: number;
  subscription_expiry_date?: string;
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
  enable_vat?: boolean;
  store_pan_vat?: string;
  seedTestData?: boolean;
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
  | "Store Manager"
  | "Cashier"
  | "Sales Associate"
  | "Inventory Manager"
  | "Delivery Person"
  | "Accountant"
  | "Security Guard"
  | "Cleaner"
  | "Other";

export type SalaryType = "monthly" | "daily" | "hourly";
export type StaffStatus = "active" | "inactive";

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
  total_deductions: number; // minor units
  total_bonus: number; // minor units
  overall_status: "fully_paid" | "partially_paid" | "unpaid";
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
  total_due?: number;
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
  phone?: string | null;
  pan_vat?: string | null;
  address?: string | null;
  notes?: string | null;
  customer_type?: "RETAIL" | "WHOLESALE";
  created_at: string;
  updated_at: string;
  sales_count?: number;
  total_spent?: number;
  total_due?: number;
}

export interface CreateCustomerInput {
  name: string;
  phone?: string | null;
  pan_vat?: string | null;
  address?: string | null;
  notes?: string | null;
  customer_type?: "RETAIL" | "WHOLESALE";
}

export interface CustomerPayment {
  id: number;
  customer_id: number;
  customer_name?: string;
  sale_id?: number | null;
  sale_bill_number?: string | null;
  amount: number; // minor units (paisa)
  payment_method: string;
  payment_date: string;
  receipt_number?: string | null;
  note?: string | null;
  created_at: string;
}

export interface VendorPayment {
  id: number;
  vendor_id: number;
  vendor_name?: string;
  purchase_id?: number | null;
  purchase_bill_number?: string | null;
  amount: number; // minor units (paisa)
  payment_method: string;
  payment_date: string;
  receipt_number?: string | null;
  note?: string | null;
  created_at: string;
}

export interface RecordCustomerPaymentInput {
  customerId: number;
  amount: number; // in minor units
  paymentMethod?: string;
  paymentDate?: string;
  note?: string;
  saleId?: number;
}

export interface RecordVendorPaymentInput {
  vendorId: number;
  amount: number; // in minor units
  paymentMethod?: string;
  paymentDate?: string;
  note?: string;
  purchaseId?: number;
}

export interface StatementRow {
  id: string; // e.g. "bill-10", "pay-4"
  date: string;
  type: "BILL" | "PAYMENT" | "RETURN";
  refNumber: string;
  description: string;
  amount: number; // total amount of bill or payment
  paidAmount: number;
  dueAmount: number;
  paymentMethod?: string;
  status?: string;
  runningBalance: number;
}

export type ReturnReason =
  | "DEFECTIVE"
  | "WRONG_ITEM"
  | "CUSTOMER_CANCELLED"
  | "EXPIRED"
  | "OTHER";
export type ReturnAction = "RESTOCK" | "DAMAGED";
export type ReturnRefundMethod = "CASH" | "CREDIT_NOTE" | "BANK";

export interface SaleReturn {
  id: number;
  return_number: string; // e.g. CN-20261022-0001 (Credit Note)
  sale_id: number | null;
  bill_number: string | null;
  customer_id: number | null;
  customer_name: string | null;
  total_refund: number; // minor units
  refund_method: ReturnRefundMethod;
  reason: ReturnReason;
  notes?: string | null;
  created_at: string;
}

export interface SaleReturnItem {
  id: number;
  return_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  batch_id?: number | null;
  batch_number?: string | null;
  action: ReturnAction;
  created_at: string;
}

export interface PurchaseReturn {
  id: number;
  return_number: string; // e.g. DN-20261022-0001 (Debit Note)
  purchase_id: number | null;
  bill_number: string | null;
  vendor_id: number | null;
  vendor_name: string | null;
  total_refund: number;
  refund_method: "CASH" | "VENDOR_CREDIT" | "BANK";
  reason: ReturnReason;
  notes?: string | null;
  created_at: string;
}

export interface PurchaseReturnItem {
  id: number;
  return_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  cost_price: number;
  total: number;
  batch_id?: number | null;
  batch_number?: string | null;
  created_at: string;
}

export type ShiftStatus = "OPEN" | "CLOSED";

export interface ShiftSession {
  id: number;
  cashier_name: string;
  staff_id?: number | null;
  opening_float: number; // minor units (paisa)
  closing_cash?: number | null; // physically counted in minor units
  system_cash?: number | null; // calculated expected cash in drawer
  cash_sales?: number;
  online_sales?: number;
  credit_sales?: number;
  cash_refunds?: number;
  cash_expenses?: number;
  variance?: number | null; // closing_cash - system_cash
  status: ShiftStatus;
  notes?: string | null;
  opened_at: string;
  closed_at?: string | null;
  created_at: string;
}

export interface OpenShiftInput {
  cashierName: string;
  staffId?: number | null;
  openingFloat: number; // in minor units
  notes?: string;
  openedAt?: string;
}

export interface CloseShiftInput {
  shiftId: number;
  closingCash: number; // physically counted in minor units
  notes?: string;
  closedAt?: string;
}

export type WriteOffReason =
  | "EXPIRED"
  | "DAMAGED"
  | "SPOILED_LEAKED"
  | "LOST_STOLEN"
  | "DEFECTIVE"
  | "DEAD_STOCK";

export type WriteOffAction =
  | "DISPOSAL"
  | "VENDOR_RETURN_PENDING"
  | "SALVAGE_CLEARANCE";

export interface StockWriteOff {
  id: number;
  voucher_number: string; // e.g. WO-00001
  product_id: number;
  product_name: string;
  quantity: number;
  unit_cost: number; // in minor units
  total_loss: number; // in minor units
  batch_id?: number | null;
  batch_number?: string | null;
  reason: WriteOffReason;
  action: WriteOffAction;
  approved_by?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface CreateWriteOffInput {
  productId: number;
  quantity: number;
  unitCost?: number; // optional, defaults to product/batch cost
  batchId?: number | null;
  batchNumber?: string | null;
  reason: WriteOffReason;
  action?: WriteOffAction; // default 'DISPOSAL'
  approvedBy?: string;
  notes?: string;
  recordAsExpense?: boolean; // if true, records as 'Inventory Loss & Spoilage' expense
  createdAt?: string;
}

// ==========================================
// Day Book / Daily Cash & Transaction Book
// ==========================================

export type DayBookTransactionType =
  | "SALE"
  | "PURCHASE"
  | "EXPENSE"
  | "CUSTOMER_PAYMENT"
  | "VENDOR_PAYMENT"
  | "SALARY"
  | "SALE_RETURN"
  | "PURCHASE_RETURN";

export interface DayBookEntry {
  id: string; // e.g. "sale-10", "exp-4"
  time: string; // ISO string
  type: DayBookTransactionType;
  refNumber: string; // Bill #, Receipt #, Voucher #
  partyName: string; // Customer, Vendor, Expense category, Staff name
  paymentMethod: string; // 'Cash' | 'Online' | 'Cheque' | 'Bank Transfer' | ...
  billAmount: number; // In minor units (total bill / invoice value)
  inflow: number; // In minor units (cash/money received)
  outflow: number; // In minor units (cash/money disbursed)
  dueAmount: number; // In minor units (credit remaining on this bill)
  notes?: string | null;
  status?: string | null;
}

export interface DayBookPaymentModeSummary {
  mode: string;
  inflow: number;
  outflow: number;
  net: number;
}

export interface DayBookSummary {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  openingBalance: number; // Cash balance at start of date range
  closingBalance: number; // Cash balance at end of date range
  totalInflow: number; // Total money received (all modes)
  totalOutflow: number; // Total money paid out (all modes)
  netCashFlow: number; // totalInflow - totalOutflow
  cashInflow: number; // Cash received
  cashOutflow: number; // Cash paid
  netCash: number; // cashInflow - cashOutflow
  // Dues & Credit Breakdown for the period
  salesInvoiced: number; // Total sales invoiced
  salesPaid: number; // Total sales paid at checkout
  newCustomerDue: number; // New customer credit given
  customerDueCollected: number; // Previous customer dues collected
  purchasesInvoiced: number; // Total purchases invoiced
  purchasesPaid: number; // Total purchases paid
  newVendorDue: number; // New vendor payable created
  vendorDuePaid: number; // Vendor dues settled
  expensesPaid: number; // Operational expenses paid
  salariesPaid: number; // Staff salaries paid
  refundsGiven: number; // Customer sales return refunds given
  refundsReceived: number; // Vendor purchase return refunds received
  entries: DayBookEntry[];
  modeSummaries: DayBookPaymentModeSummary[];
}
