/**
 * Finance, Payroll & Accounting Constants
 * Expense categories, payment options, and staff designations.
 */
import { StaffRole, SalaryType, StaffStatus } from "../types/index.ts";

export const DEFAULT_EXPENSE_CATEGORIES: string[] = [
  "Utilities (Electricity, Water)",
  "Rent & Lease",
  "Packaging & Bags",
  "Transportation & Logistics",
  "Maintenance & Repairs",
  "Salaries & Wages",
  "Office & Shop Supplies",
  "Marketing & Signage",
  "Tea & Refreshments",
  "Taxes & Municipal Fees",
  "Miscellaneous",
];

export const DEFAULT_PAYMENT_METHODS: string[] = [
  "Cash",
  "Bank Transfer",
  "Fonepay / QR",
  "Cheque",
  "Credit Card",
  "Other",
];

export const DEFAULT_STAFF_ROLES: StaffRole[] = [
  "Store Manager",
  "Cashier",
  "Sales Associate",
  "Inventory Manager",
  "Delivery Person",
  "Accountant",
  "Security Guard",
  "Cleaner",
  "Other",
];

export const SALARY_PAYMENT_METHODS: string[] = [
  "Cash",
  "Bank Transfer",
  "Cheque",
  "Digital Wallet (eSewa/Khalti)",
  "Other",
];

export const MONTH_NAMES: string[] = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const NEPALI_MONTH_NAMES: string[] = [
  "बैशाख (Baishakh)",
  "जेठ (Jestha)",
  "असार (Ashadh)",
  "श्रावण (Shrawan)",
  "भाद्र (Bhadra)",
  "असोज (Ashwin)",
  "कार्तिक (Kartik)",
  "मंसिर (Mangsir)",
  "पुष (Poush)",
  "माघ (Magh)",
  "फागुन (Falgun)",
  "चैत (Chaitra)",
];

export interface StaffStatusFilterOption {
  value: "all" | StaffStatus;
  label: string;
}

export const getStaffStatusFilterOptions = (
  isNepali: boolean = false,
): StaffStatusFilterOption[] => [
  { value: "all", label: isNepali ? "सबै अवस्था (All Status)" : "All Status" },
  { value: "active", label: isNepali ? "सक्रिय (Active Only)" : "Active Only" },
  {
    value: "inactive",
    label: isNepali ? "निष्क्रिय (Inactive Only)" : "Inactive Only",
  },
];

export const STAFF_STATUS_FILTER_OPTIONS: StaffStatusFilterOption[] =
  getStaffStatusFilterOptions(false);

export interface StaffStatusOption {
  value: StaffStatus;
  label: string;
}

export const getStaffStatusOptions = (
  isNepali: boolean = false,
): StaffStatusOption[] => [
  { value: "active", label: isNepali ? "सक्रिय (Active)" : "Active" },
  { value: "inactive", label: isNepali ? "निष्क्रिय (Inactive)" : "Inactive" },
];

export const STAFF_STATUS_OPTIONS: StaffStatusOption[] =
  getStaffStatusOptions(false);

export interface SalaryTypeOption {
  value: SalaryType;
  label: string;
}

export const getSalaryTypeOptions = (
  isNepali: boolean = false,
): SalaryTypeOption[] => [
  {
    value: "monthly",
    label: isNepali ? "मासिक निश्चित (Monthly Fixed)" : "Monthly Fixed",
  },
  {
    value: "hourly",
    label: isNepali ? "प्रति घण्टा (Hourly Rate)" : "Hourly Rate",
  },
  {
    value: "daily",
    label: isNepali ? "दैनिक (Daily Rate)" : "Daily Rate",
  },
];

export const SALARY_TYPE_OPTIONS: SalaryTypeOption[] =
  getSalaryTypeOptions(false);
