/**
 * Units of Measure Constants
 * Centralized list of measurement units for products and inventory management.
 */

export interface UnitItem {
  value: string;
  label: string;
}

export interface UnitOption {
  value: string;
  label: string;
  nepaliLabel?: string;
  category?: 'count' | 'weight' | 'volume' | 'length' | 'package' | 'area';
}

export const COMMON_UNITS: UnitItem[] = [
  { value: "pcs", label: "pcs (piece)" },
  { value: "kg", label: "kg (kilogram)" },
  { value: "g", label: "g (gram)" },
  { value: "ltr", label: "ltr (litre)" },
  { value: "ml", label: "ml (millilitre)" },
  { value: "pkt", label: "pkt (packet)" },
  { value: "box", label: "box (box)" },
  { value: "bottle", label: "bottle" },
  { value: "can", label: "can" },
  { value: "dozen", label: "dozen" },
  { value: "bag", label: "bag" },
  { value: "strip", label: "strip" },
  { value: "tablet", label: "tablet" },
  { value: "m", label: "m (meter)" },
  { value: "roll", label: "roll" },
  { value: "set", label: "set" },
  { value: "carton", label: "carton" },
  { value: "jar", label: "jar" },
  { value: "pair", label: "pair" },
];

export const COMMON_UNIT_STRINGS: string[] = COMMON_UNITS.map((u) => u.value);

export const UNIT_OPTIONS: UnitOption[] = [
  { value: 'pcs', label: 'Pieces (pcs)', nepaliLabel: 'थान (pcs)', category: 'count' },
  { value: 'kg', label: 'Kilograms (kg)', nepaliLabel: 'किलोग्राम (kg)', category: 'weight' },
  { value: 'ltr', label: 'Liters (ltr)', nepaliLabel: 'लिटर (ltr)', category: 'volume' },
  { value: 'g', label: 'Grams (g)', nepaliLabel: 'ग्राम (g)', category: 'weight' },
  { value: 'ml', label: 'Milliliters (ml)', nepaliLabel: 'मिलिलिटर (ml)', category: 'volume' },
  { value: 'box', label: 'Box (box)', nepaliLabel: 'बाकस (box)', category: 'package' },
  { value: 'pkt', label: 'Packet (pkt)', nepaliLabel: 'प्याकेट (packet)', category: 'package' },
  { value: 'dozen', label: 'Dozen (dz)', nepaliLabel: 'दर्जन (dozen)', category: 'count' },
  { value: 'm', label: 'Meters (m)', nepaliLabel: 'मिटर (m)', category: 'length' },
  { value: 'can', label: 'Can (can)', nepaliLabel: 'क्यान (can)', category: 'package' },
  { value: 'bottle', label: 'Bottle (btl)', nepaliLabel: 'बोतल (bottle)', category: 'package' },
  { value: 'set', label: 'Set (set)', nepaliLabel: 'सेट (set)', category: 'package' },
  { value: 'roll', label: 'Roll (roll)', nepaliLabel: 'रोल (roll)', category: 'length' },
  { value: 'bag', label: 'Bag (bag)', nepaliLabel: 'बोरा (bag)', category: 'package' },
  { value: 'carton', label: 'Carton (ctn)', nepaliLabel: 'कार्टुन (carton)', category: 'package' },
  { value: 'strip', label: 'Strip (strip)', nepaliLabel: 'स्ट्रिप (strip)', category: 'package' },
  { value: 'tablet', label: 'Tablet (tab)', nepaliLabel: 'ट्याब्लेट (tablet)', category: 'package' },
  { value: 'jar', label: 'Jar (jar)', nepaliLabel: 'जार (jar)', category: 'package' },
  { value: 'pair', label: 'Pair (pair)', nepaliLabel: 'जोडी (pair)', category: 'count' },
];

export const DEFAULT_PRODUCT_UNIT = 'pcs';
