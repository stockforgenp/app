/**
 * Centralized Date Filter Presets and Utilities
 * Standard preset options: today, yesterday, week (last 7 days), month (this month), year (this year), all (all time), custom
 */

export type DatePreset =
  | "all"
  | "today"
  | "yesterday"
  | "week"
  | "month"
  | "year"
  | "custom";

export interface DateFilterOption {
  id: DatePreset;
  label: string;
  nepaliLabel?: string;
}

export const DATE_PRESETS: DateFilterOption[] = [
  { id: "all", label: "All Time", nepaliLabel: "सबै समय" },
  { id: "today", label: "Today", nepaliLabel: "आज" },
  { id: "yesterday", label: "Yesterday", nepaliLabel: "हिजो" },
  { id: "week", label: "This Week", nepaliLabel: "यस हप्ता" },
  { id: "month", label: "This Month", nepaliLabel: "यस महिना" },
  { id: "year", label: "This Year", nepaliLabel: "यस वर्ष" },
  { id: "custom", label: "Custom", nepaliLabel: "कस्टम" },
];

/**
 * Calculates start and end dates (YYYY-MM-DD) for a given preset
 */
export function calculateDateRange(preset: DatePreset): {
  startDate: string;
  endDate: string;
} {
  const now = new Date();
  const formatYMD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const todayStr = formatYMD(now);

  switch (preset) {
    case "today":
      return { startDate: todayStr, endDate: todayStr };

    case "yesterday": {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      const yestStr = formatYMD(yest);
      return { startDate: yestStr, endDate: yestStr };
    }

    case "week": {
      // Last 7 days including today
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      return { startDate: formatYMD(start), endDate: todayStr };
    }

    case "month": {
      // First day of current month to today
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: formatYMD(firstOfMonth), endDate: todayStr };
    }

    case "year": {
      // First day of current year to today
      const firstOfYear = new Date(now.getFullYear(), 0, 1);
      return { startDate: formatYMD(firstOfYear), endDate: todayStr };
    }

    case "all":
    case "custom":
    default:
      return { startDate: "", endDate: "" };
  }
}

/**
 * Converts a YYYY-MM-DD date range into full ISO strings for datetime timestamp comparisons (created_at)
 */
export function toIsoRange(
  startDate: string,
  endDate: string,
): { startIso?: string; endIso?: string } {
  const result: { startIso?: string; endIso?: string } = {};
  if (startDate) {
    result.startIso = startDate.includes("T")
      ? startDate
      : `${startDate}T00:00:00.000Z`;
  }
  if (endDate) {
    result.endIso = endDate.includes("T")
      ? endDate
      : `${endDate}T23:59:59.999Z`;
  }
  return result;
}
