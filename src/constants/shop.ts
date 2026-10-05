/**
 * Shop & Business Profile Constants
 * Categories, default currencies, and store configuration options.
 */

export const SHOP_TYPES: string[] = [
  'Grocery & Supermarket',
  'Clothing & Apparel',
  'Electronics & Mobile',
  'Pharmacy & Healthcare',
  'Cafe, Bakery & Restaurant',
  'Hardware & Construction',
  'Stationery & Bookshop',
  'Cosmetics & Personal Care',
  'Departmental & Wholesale',
  'General Retail & Store',
  'Other',
];

export interface CurrencyOption {
  value: string;
  label: string;
  symbol: string;
  country?: string;
}

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { value: 'रु.', label: 'रु. (Nepali Rupee - Default)', symbol: 'रु.', country: 'NP' },
  { value: 'Rs.', label: 'Rs. (Rupee)', symbol: 'Rs.', country: 'IN/PK/LK' },
  { value: '$', label: '$ (USD)', symbol: '$', country: 'US' },
  { value: '€', label: '€ (Euro)', symbol: '€', country: 'EU' },
  { value: '£', label: '£ (GBP)', symbol: '£', country: 'UK' },
];

export const DEFAULT_CURRENCY = 'Rs.';
export const DEFAULT_NEPALI_CURRENCY = 'रु.';
export const DEFAULT_LOW_STOCK_THRESHOLD = 10;
