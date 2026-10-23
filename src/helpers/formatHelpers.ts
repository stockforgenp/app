import { getCalendarSystem } from "../lib/services/settingsService.ts";
import {
  formatBsDate,
  formatBsDateTime,
  adToBs,
} from "../lib/calendar/nepaliCalendar.ts";
import { isNepaliActive } from "../lib/i18n/translations.ts";
import { CalendarSystem } from "../types/index.ts";

/**
 * Convert Latin digits (0-9) to Nepali Unicode numerals (०-९)
 */
export function toNepaliDigits(input: string | number): string {
  const nepaliDigits = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];
  return String(input).replace(
    /[0-9]/g,
    (digit) => nepaliDigits[parseInt(digit, 10)],
  );
}

/**
 * Format a number according to the active language:
 * English -> standard commas (e.g. 1,234.50)
 * Nepali -> Nepali digits (e.g. १,२३४.५०)
 */
export function formatNumberByLang(
  val: number | string | undefined | null,
  lang: "en" | "np" = "en",
): string {
  if (val === undefined || val === null || val === "") return "0";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "0";

  const enFormatted = num.toLocaleString("en-US");
  if (lang === "np") {
    return toNepaliDigits(enFormatted);
  }
  return enFormatted;
}

export function fromMinorUnits(minorUnits: number | undefined | null): number {
  if (minorUnits === undefined || minorUnits === null || isNaN(minorUnits))
    return 0;
  return minorUnits / 100;
}

export function toMinorUnits(val: number | string): number {
  if (typeof val === "string") {
    const cleaned = val.replace(/[^0-9.-]/g, "");
    const num = parseFloat(cleaned);
    if (isNaN(num)) return 0;
    return Math.round(num * 100);
  }
  if (isNaN(val)) return 0;
  return Math.round(val * 100);
}

/**
 * Format monetary amount stored in minor units into clean display string.
 * Supports both boolean showDecimals (legacy) and options object.
 */
export function formatCurrency(
  minorUnits: number | undefined | null,
  symbol?: string,
  showDecimalsOrOptions: boolean | { showDecimals?: boolean } = true,
): string {
  const isNe =
    typeof document !== "undefined" &&
    (document.documentElement.lang === "ne" ||
      document.documentElement.lang === "np");

  let effectiveSymbol = symbol;
  if (effectiveSymbol === undefined) {
    effectiveSymbol = isNe ? "रु." : "Rs.";
  } else if (effectiveSymbol !== "") {
    const clean = effectiveSymbol.trim();
    const isRsVariant =
      clean === "Rs." ||
      clean === "Rs" ||
      clean.toLowerCase() === "rs" ||
      clean.toLowerCase() === "rs." ||
      clean.toUpperCase() === "NRS" ||
      clean.toUpperCase() === "NRS.";
    const isNeVariant =
      clean === "रु." || clean === "रु" || clean === "रू." || clean === "रू";

    if (isNe && isRsVariant) {
      effectiveSymbol = "रु.";
    } else if (!isNe && isNeVariant) {
      effectiveSymbol = "Rs.";
    }
  }

  const showDecimals =
    typeof showDecimalsOrOptions === "boolean"
      ? showDecimalsOrOptions
      : (showDecimalsOrOptions?.showDecimals ?? true);

  if (minorUnits === undefined || minorUnits === null) {
    const defaultFormatted = showDecimals ? "0.00" : "0";
    return effectiveSymbol
      ? `${effectiveSymbol} ${defaultFormatted}`
      : defaultFormatted;
  }

  const amount = fromMinorUnits(minorUnits);
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });

  return effectiveSymbol ? `${effectiveSymbol} ${formatted}` : formatted;
}

export function formatNumber(val: number): string {
  return val.toLocaleString("en-US");
}

export function formatQuantity(qty: number, unit?: string): string {
  const formatted = qty.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Format date respecting active calendar system (BS or AD)
 * Defaults to Bikram Sambat (BS)
 */
export function formatDate(
  isoString: string,
  calendarOverride?: CalendarSystem,
): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;

    const calendar = calendarOverride || getCalendarSystem();
    if (calendar === "BS") {
      const isNp = isNepaliActive();
      return formatBsDate(d, {
        format: "long",
        digits: isNp ? "np" : "en",
      });
    }

    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return isoString;
  }
}

/**
 * Format datetime respecting active calendar system (BS or AD)
 */
export function formatDateTime(
  isoString: string,
  calendarOverride?: CalendarSystem,
): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;

    const calendar = calendarOverride || getCalendarSystem();
    if (calendar === "BS") {
      const isNp = isNepaliActive();
      return formatBsDateTime(d, {
        digits: isNp ? "np" : "en",
      });
    }

    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

/**
 * Explicit Bikram Sambat date formatter
 */
export function formatDateBS(
  isoString: string,
  options?: {
    format?: "numeric" | "short" | "long" | "full";
    digits?: "en" | "np";
    includeSuffix?: boolean;
  },
): string {
  return formatBsDate(isoString, options);
}

/**
 * Explicit Gregorian (AD) date formatter
 */
export function formatDateAD(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return isoString;
  }
}

export function getTodayISODate(): string {
  const now = new Date();
  return now.toISOString().split("T")[0];
}

/**
 * Formats a Date or ISO string into local 'YYYY-MM-DDTHH:mm' for datetime-local input
 */
export function formatForDateTimeLocal(
  date: Date | string = new Date(),
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (isNaN(d.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Converts a datetime-local string (YYYY-MM-DDTHH:mm) into a standard ISO-8601 string
 */
export function parseDateTimeLocalToIso(val?: string): string {
  if (!val) return new Date().toISOString();
  const d = new Date(val);
  if (isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

/**
 * Capitalizes the first letter of each word in a string while preserving mixed casing/acronyms.
 * Examples:
 * - "paracetamol 500mg" -> "Paracetamol 500mg"
 * - "john doe" -> "John Doe"
 * - "shree krishna stores" -> "Shree Krishna Stores"
 * - "coca-cola" -> "Coca-Cola"
 * - "USB cable" -> "USB Cable"
 * - "RAMESH SHRESTHA" -> "Ramesh Shrestha"
 */
export function capitalizeWords(str: string | undefined | null): string {
  if (!str) return "";
  const trimmed = str.trim();
  if (!trimmed) return "";

  // If the whole string is in ALL CAPS (common with caps lock on), convert to lowercase first
  const isAllUpper =
    trimmed === trimmed.toUpperCase() && /[a-zA-Z]/.test(trimmed);
  const normalized = isAllUpper ? trimmed.toLowerCase() : trimmed;

  return normalized
    .split(/(\s+)/)
    .map((part) => {
      if (!part || /^\s+$/.test(part)) return part;
      // Capitalize first letter of word, including after hyphens, slashes, and parentheses
      return part.replace(/(?:^|[(\[/\-_.,])([a-zA-Z])/g, (match, letter) => {
        return match.slice(0, -1) + letter.toUpperCase();
      });
    })
    .join("");
}
