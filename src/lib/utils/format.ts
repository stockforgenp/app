/**
 * Legacy Format Utils - Forwarding to centralized helpers
 */
export * from '../../helpers/formatHelpers.ts';

export function getTodayISODate(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}
