/**
 * Date Filtering & Preset Helper Functions
 */

export type DatePreset =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'week'
  | 'month'
  | 'year'
  | 'last7'
  | 'last30'
  | 'thisMonth'
  | 'custom';

export interface DateFilterOption {
  id: DatePreset;
  label: string;
  nepaliLabel?: string;
}

export const DATE_PRESETS: DateFilterOption[] = [
  { id: 'all', label: 'All Time', nepaliLabel: 'सबै समय' },
  { id: 'today', label: 'Today', nepaliLabel: 'आज' },
  { id: 'yesterday', label: 'Yesterday', nepaliLabel: 'हिजो' },
  { id: 'week', label: 'This Week', nepaliLabel: 'यस हप्ता' },
  { id: 'month', label: 'This Month', nepaliLabel: 'यस महिना' },
  { id: 'year', label: 'This Year', nepaliLabel: 'यस वर्ष' },
  { id: 'custom', label: 'Custom', nepaliLabel: 'कस्टम' },
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
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = formatYMD(now);

  switch (preset) {
    case 'today':
      return { startDate: todayStr, endDate: todayStr };

    case 'yesterday': {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      const yestStr = formatYMD(yest);
      return { startDate: yestStr, endDate: yestStr };
    }

    case 'week':
    case 'last7': {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      return { startDate: formatYMD(start), endDate: todayStr };
    }

    case 'month':
    case 'thisMonth': {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: formatYMD(firstOfMonth), endDate: todayStr };
    }

    case 'year': {
      const firstOfYear = new Date(now.getFullYear(), 0, 1);
      return { startDate: formatYMD(firstOfYear), endDate: todayStr };
    }

    case 'last30': {
      const past30 = new Date(now);
      past30.setDate(now.getDate() - 29);
      return { startDate: formatYMD(past30), endDate: todayStr };
    }

    case 'all':
    case 'custom':
    default:
      return { startDate: '', endDate: '' };
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
    if (startDate.includes('T')) {
      result.startIso = startDate;
    } else {
      const parts = startDate.split('-').map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        const localStart = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
        result.startIso = localStart.toISOString();
      } else {
        result.startIso = `${startDate}T00:00:00.000Z`;
      }
    }
  }
  if (endDate) {
    if (endDate.includes('T')) {
      result.endIso = endDate;
    } else {
      const parts = endDate.split('-').map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        const localEnd = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
        result.endIso = localEnd.toISOString();
      } else {
        result.endIso = `${endDate}T23:59:59.999Z`;
      }
    }
  }
  return result;
}

/**
 * Returns UTC or local date boundary strings (YYYY-MM-DDTHH:mm:ss.sssZ) for a preset
 */
export function getDateRangeFromPreset(preset: DatePreset): { start: string; end: string } | null {
  if (preset === 'all' || preset === 'custom') return null;
  const range = calculateDateRange(preset);
  if (!range.startDate || !range.endDate) return null;
  const iso = toIsoRange(range.startDate, range.endDate);
  if (iso.startIso && iso.endIso) {
    return { start: iso.startIso, end: iso.endIso };
  }
  return null;
}
