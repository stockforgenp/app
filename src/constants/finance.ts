/**
 * Finance, Payroll & Accounting Constants
 * Expense categories, payment options, and staff designations.
 */
import { StaffRole } from '../types/index.ts';

export const DEFAULT_EXPENSE_CATEGORIES: string[] = [
  'Utilities (Electricity, Water)',
  'Rent & Lease',
  'Packaging & Bags',
  'Transportation & Logistics',
  'Maintenance & Repairs',
  'Salaries & Wages',
  'Office & Shop Supplies',
  'Marketing & Signage',
  'Tea & Refreshments',
  'Taxes & Municipal Fees',
  'Miscellaneous',
];

export const DEFAULT_PAYMENT_METHODS: string[] = [
  'Cash',
  'Bank Transfer',
  'Fonepay / QR',
  'Cheque',
  'Credit Card',
  'Other',
];

export const DEFAULT_STAFF_ROLES: StaffRole[] = [
  'Store Manager',
  'Cashier',
  'Sales Associate',
  'Inventory Manager',
  'Delivery Person',
  'Accountant',
  'Security Guard',
  'Cleaner',
  'Other',
];

export const SALARY_PAYMENT_METHODS: string[] = [
  'Cash',
  'Bank Transfer',
  'Cheque',
  'Digital Wallet (eSewa/Khalti)',
  'Other',
];

export const MONTH_NAMES: string[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const NEPALI_MONTH_NAMES: string[] = [
  'बैशाख (Baishakh)',
  'जेठ (Jestha)',
  'असार (Ashadh)',
  'श्रावण (Shrawan)',
  'भाद्र (Bhadra)',
  'असोज (Ashwin)',
  'कार्तिक (Kartik)',
  'मंसिर (Mangsir)',
  'पुष (Poush)',
  'माघ (Magh)',
  'फागुन (Falgun)',
  'चैत (Chaitra)',
];
