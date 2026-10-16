/**
 * Nepali Calendar (Bikram Sambat - B.S.) Utility
 * 100% Offline, Zero-Dependency AD <-> BS Conversion Engine
 */
// @ts-ignore - JavaScript ES5 core bundle
import RawNepaliDateCore, { dateConfigMap as rawDateConfigMap } from "./nepaliDateCore.js";

const NepaliDateCore = RawNepaliDateCore as any;
const dateConfigMap = rawDateConfigMap as Record<string, Record<string, number>>;

/**
 * Convert standard numerals (0-9) to Nepali Devanagari numerals (०-९)
 */
export function toNepaliDigits(input: string | number): string {
  const nepaliDigits = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];
  return String(input).replace(
    /[0-9]/g,
    (digit) => nepaliDigits[parseInt(digit, 10)],
  );
}

export interface BsDateInfo {
  year: number; // e.g. 2083
  month: number; // 1-12 (1: Baisakh, 12: Chaitra)
  day: number; // 1-32
  dayOfWeek: number; // 0: Sunday, 6: Saturday
  str: string; // YYYY-MM-DD (e.g. "2083-06-30")
  strNp: string; // २०८३-०६-३०
  monthNameEn: string; // "Aswin"
  monthNameNp: string; // "असोज"
  dayNameEn: string; // "Friday"
  dayNameNp: string; // "शुक्रबार"
}

export const BS_MONTHS_EN = [
  "Baisakh",
  "Jestha",
  "Asar",
  "Shrawan",
  "Bhadra",
  "Aswin",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
];

export const BS_MONTHS_NP = [
  "बैशाख",
  "जेठ",
  "असार",
  "साउन",
  "भदौ",
  "असोज",
  "कात्तिक",
  "मङ्सिर",
  "पुस",
  "माघ",
  "फागुन",
  "चैत",
];

export const BS_DAYS_EN = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const BS_DAYS_NP = [
  "आइतबार",
  "सोमबार",
  "मङ्गलबार",
  "बुधबार",
  "बिहिबार",
  "शुक्रबार",
  "शनिबार",
];

export const BS_DAYS_SHORT_NP = [
  "आइत",
  "सोम",
  "मङ्गल",
  "बुध",
  "बिही",
  "शुक्र",
  "शनि",
];

/**
 * Safely parses any date input (ISO string, timestamp, Date object) to a valid JS Date
 */
function parseToJsDate(input: Date | string | number): Date {
  if (input instanceof Date) return isNaN(input.getTime()) ? new Date() : input;
  if (typeof input === "number") return new Date(input);
  if (typeof input === "string") {
    // If it's a date-only string like YYYY-MM-DD, parse as local date
    const parts = input.split("-");
    if (parts.length === 3 && parts[0].length === 4) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2].slice(0, 2), 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return new Date(y, m, d);
      }
    }
    const d = new Date(input);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  return new Date();
}

/**
 * Converts Gregorian (AD) Date to Bikram Sambat (BS) object
 */
export function adToBs(dateInput: Date | string | number): BsDateInfo {
  const d = parseToJsDate(dateInput);
  try {
    const nd = new NepaliDateCore(d);
    const bs = nd.getBS();
    // In NepaliDateCore, month is 0-indexed (0 = Baisakh, 11 = Chaitra)
    const month = bs.month + 1;
    const year = bs.year;
    const day = bs.date;
    const dayOfWeek = bs.day ?? d.getDay();

    const pad = (n: number) => String(n).padStart(2, "0");
    const str = `${year}-${pad(month)}-${pad(day)}`;
    const strNp = `${toNepaliDigits(year)}-${toNepaliDigits(pad(month))}-${toNepaliDigits(pad(day))}`;

    const monthIndex = Math.max(0, Math.min(11, bs.month));
    const dayIndex = Math.max(0, Math.min(6, dayOfWeek));

    return {
      year,
      month,
      day,
      dayOfWeek,
      str,
      strNp,
      monthNameEn: BS_MONTHS_EN[monthIndex] || "Baisakh",
      monthNameNp: BS_MONTHS_NP[monthIndex] || "बैशाख",
      dayNameEn: BS_DAYS_EN[dayIndex] || "Sunday",
      dayNameNp: BS_DAYS_NP[dayIndex] || "आइतबार",
    };
  } catch (err) {
    // Fallback if out of bounds (before 2000 BS or after 2090 BS)
    const fallbackYear = d.getFullYear() + 57;
    return {
      year: fallbackYear,
      month: d.getMonth() + 1,
      day: d.getDate(),
      dayOfWeek: d.getDay(),
      str: `${fallbackYear}-01-01`,
      strNp: `${toNepaliDigits(fallbackYear)}-०१-०१`,
      monthNameEn: BS_MONTHS_EN[0],
      monthNameNp: BS_MONTHS_NP[0],
      dayNameEn: BS_DAYS_EN[d.getDay()],
      dayNameNp: BS_DAYS_NP[d.getDay()],
    };
  }
}

/**
 * Converts Bikram Sambat (BS) year, month (1-12), day (1-32) to Gregorian (AD) Date object
 */
export function bsToAd(year: number, month: number, day: number): Date {
  try {
    // NepaliDateCore constructor expects month 0-indexed (0-11)
    const nd = new NepaliDateCore(year, month - 1, day);
    const adObj = nd.getAD();
    return new Date(adObj.year, adObj.month, adObj.date);
  } catch (err) {
    // Fallback approximation
    return new Date(year - 57, month - 1, Math.min(28, day));
  }
}

/**
 * Converts a BS date string (YYYY-MM-DD or YYYY/MM/DD) to an AD ISO date string (YYYY-MM-DD)
 */
export function bsToAdIso(bsDateStr: string): string {
  if (!bsDateStr) return "";
  const parts = bsDateStr.replace(/\//g, "-").split("-").map((s) => parseInt(s, 10));
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return bsDateStr;
  }
  const ad = bsToAd(parts[0], parts[1], parts[2]);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${ad.getFullYear()}-${pad(ad.getMonth() + 1)}-${pad(ad.getDate())}`;
}

/**
 * Converts an AD date string / Date to BS YYYY-MM-DD string
 */
export function adToBsIso(adDate: Date | string): string {
  return adToBs(adDate).str;
}

/**
 * Get number of days in a given BS year and month (1-12)
 */
export function getDaysInBsMonth(year: number, month: number): number {
  try {
    const yrStr = String(year);
    const monthKey = BS_MONTHS_EN[month - 1];
    if (dateConfigMap && dateConfigMap[yrStr] && dateConfigMap[yrStr][monthKey]) {
      return dateConfigMap[yrStr][monthKey];
    }
  } catch {}
  return 30;
}

/**
 * Formats a date into human-readable Bikram Sambat string
 * @example
 * formatBsDate(new Date(), { format: 'short', digits: 'en' }) // "2083-06-30"
 * formatBsDate(new Date(), { format: 'long', digits: 'np' })  // "३० असोज, २०८३"
 */
export function formatBsDate(
  dateInput: Date | string | number,
  options: {
    format?: "numeric" | "short" | "long" | "full";
    digits?: "en" | "np";
    includeSuffix?: boolean;
  } = {},
): string {
  const { format = "short", digits = "en", includeSuffix = false } = options;
  const bs = adToBs(dateInput);

  const pad = (n: number) => String(n).padStart(2, "0");
  const suffix = includeSuffix ? " BS" : "";

  if (digits === "np") {
    const yNp = toNepaliDigits(bs.year);
    const mNp = toNepaliDigits(pad(bs.month));
    const dNp = toNepaliDigits(pad(bs.day));
    const dayNp = toNepaliDigits(bs.day);

    switch (format) {
      case "numeric":
        return `${yNp}-${mNp}-${dNp}`;
      case "short":
        return `${yNp}/${mNp}/${dNp}`;
      case "long":
        return `${dayNp} ${bs.monthNameNp}, ${yNp}`;
      case "full":
        return `${bs.dayNameNp}, ${dayNp} ${bs.monthNameNp} ${yNp}`;
      default:
        return `${yNp}/${mNp}/${dNp}`;
    }
  }

  // English digits
  switch (format) {
    case "numeric":
      return `${bs.str}${suffix}`;
    case "short":
      return `${bs.year}/${pad(bs.month)}/${pad(bs.day)}${suffix}`;
    case "long":
      return `${bs.monthNameEn} ${pad(bs.day)}, ${bs.year}${suffix}`;
    case "full":
      return `${bs.dayNameEn}, ${bs.monthNameEn} ${bs.day}, ${bs.year}${suffix}`;
    default:
      return `${bs.str}${suffix}`;
  }
}

/**
 * Formats date and time in Bikram Sambat
 * @example "2083-06-30 03:45 PM"
 */
export function formatBsDateTime(
  dateInput: Date | string | number,
  options: { digits?: "en" | "np" } = {},
): string {
  const d = parseToJsDate(dateInput);
  const bs = adToBs(d);
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const hours12 = hours % 12 || 12;
  const pad = (n: number) => String(n).padStart(2, "0");

  const timeStr = `${pad(hours12)}:${pad(minutes)} ${ampm}`;

  if (options.digits === "np") {
    return `${bs.strNp} ${timeStr}`;
  }
  return `${bs.str} ${timeStr}`;
}

/**
 * Gets today's BS date info
 */
export function getTodayBs(): BsDateInfo {
  return adToBs(new Date());
}

/**
 * Returns Gregorian start & end ISO strings for the current or given BS month
 * Crucial for "This Month" accounting filter in Nepal
 */
export function getBsMonthRange(
  year?: number,
  month?: number,
): { startDate: string; endDate: string } {
  const todayBs = getTodayBs();
  const y = year ?? todayBs.year;
  const m = month ?? todayBs.month;
  const daysInMonth = getDaysInBsMonth(y, m);

  const startAd = bsToAd(y, m, 1);
  const endAd = bsToAd(y, m, daysInMonth);

  const pad = (n: number) => String(n).padStart(2, "0");
  const startAdStr = `${startAd.getFullYear()}-${pad(startAd.getMonth() + 1)}-${pad(startAd.getDate())}`;
  const endAdStr = `${endAd.getFullYear()}-${pad(endAd.getMonth() + 1)}-${pad(endAd.getDate())}`;

  return { startDate: startAdStr, endDate: endAdStr };
}

/**
 * Returns Gregorian start & end ISO strings for the current or given BS year
 * (Baisakh 1 to Chaitra end) - Crucial for "This Year" in Nepal
 */
export function getBsYearRange(year?: number): {
  startDate: string;
  endDate: string;
} {
  const todayBs = getTodayBs();
  const y = year ?? todayBs.year;
  const daysInChaitra = getDaysInBsMonth(y, 12);

  const startAd = bsToAd(y, 1, 1);
  const endAd = bsToAd(y, 12, daysInChaitra);

  const pad = (n: number) => String(n).padStart(2, "0");
  const startAdStr = `${startAd.getFullYear()}-${pad(startAd.getMonth() + 1)}-${pad(startAd.getDate())}`;
  const endAdStr = `${endAd.getFullYear()}-${pad(endAd.getMonth() + 1)}-${pad(endAd.getDate())}`;

  return { startDate: startAdStr, endDate: endAdStr };
}
