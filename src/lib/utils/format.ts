/**
 * Utility functions for exact currency arithmetic and formatting.
 * Stores monetary values as integer minor units (e.g. paisa / cents: 100 = 1.00)
 * to avoid JavaScript floating point errors.
 */

export function toMinorUnits(val: number | string): number {
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    if (isNaN(num)) return 0;
    return Math.round(num * 100);
  }
  if (isNaN(val)) return 0;
  return Math.round(val * 100);
}

export function fromMinorUnits(minorUnits: number): number {
  if (isNaN(minorUnits)) return 0;
  return minorUnits / 100;
}

export function formatCurrency(
  minorUnits: number,
  symbol?: string,
  showDecimals: boolean = true
): string {
  const isNe =
    typeof document !== 'undefined' &&
    (document.documentElement.lang === 'ne' || document.documentElement.lang === 'np');

  let effectiveSymbol = symbol;
  if (effectiveSymbol === undefined) {
    effectiveSymbol = isNe ? 'रु.' : 'Rs.';
  } else if (effectiveSymbol !== '') {
    const clean = effectiveSymbol.trim();
    const isRsVariant =
      clean === 'Rs.' ||
      clean === 'Rs' ||
      clean.toLowerCase() === 'rs' ||
      clean.toLowerCase() === 'rs.' ||
      clean.toUpperCase() === 'NRS' ||
      clean.toUpperCase() === 'NRS.';
    const isNeVariant =
      clean === 'रु.' || clean === 'रु' || clean === 'रू.' || clean === 'रू';

    if (isNe && isRsVariant) {
      effectiveSymbol = 'रु.';
    } else if (!isNe && isNeVariant) {
      effectiveSymbol = 'Rs.';
    }
  }

  const amount = fromMinorUnits(minorUnits);
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });

  return effectiveSymbol ? `${effectiveSymbol} ${formatted}` : formatted;
}

export function formatNumber(val: number): string {
  return val.toLocaleString('en-US');
}

export function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoString;
  }
}

export function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

export function getTodayISODate(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}
