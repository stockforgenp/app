/**
 * Diagnostic & System Specs Helper Functions
 * Generates runtime snapshots for technical support tickets.
 */
import {
  APP_VERSION,
  APP_IDENTIFIER,
  APP_ENGINE,
} from "../constants/support.ts";

export interface SystemDiagnosticsParams {
  shop?: {
    id: number;
    name: string;
    email: string;
    shop_type: string;
    phone?: string | null;
  } | null;
  language?: string;
  theme?: string;
  extra?: Record<string, unknown>;
}

export function getSystemDiagnosticsObject(params?: SystemDiagnosticsParams) {
  return {
    app: "StockForge Desktop",
    version: APP_VERSION,
    identifier: APP_IDENTIFIER,
    engine: APP_ENGINE,
    platform:
      typeof navigator !== "undefined"
        ? navigator.platform || "Desktop"
        : "Desktop",
    userAgent:
      typeof navigator !== "undefined" ? navigator.userAgent : "Unknown",
    language: (params?.language || "en").toUpperCase(),
    theme: (params?.theme || "dark").toUpperCase(),
    activeShop: params?.shop
      ? {
          id: params.shop.id,
          name: params.shop.name,
          email: params.shop.email,
          type: params.shop.shop_type,
          phone: params.shop.phone || "N/A",
        }
      : "Unregistered / Logged Out",
    timestamp: new Date().toISOString(),
    ...(params?.extra || {}),
  };
}

export function compileSystemDiagnostics(
  params?: SystemDiagnosticsParams,
): string {
  return JSON.stringify(getSystemDiagnosticsObject(params), null, 2);
}

export function copyDiagnosticsToClipboard(
  params?: SystemDiagnosticsParams,
  onCopied?: () => void,
): void {
  const text = compileSystemDiagnostics(params);
  navigator.clipboard.writeText(text);
  if (onCopied) {
    onCopied();
  }
}
