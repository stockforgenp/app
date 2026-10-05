/**
 * Global Keyboard Shortcuts Hook & Registry
 * StockForge Desktop & Web POS
 */
import { useEffect } from "react";
import { NavTab } from "../../components/layout/Sidebar.tsx";
export {
  isMac,
  MODIFIER_LABEL,
  type ShortcutDefinition,
  SHORTCUT_REGISTRY,
} from "../../constants/shortcuts.ts";

export interface UseGlobalShortcutsOptions {
  onNavigate: (tab: NavTab) => void;
  onOpenCommandPalette: () => void;
  onOpenShortcutsHelp: () => void;
  onCloseModals?: () => void;
  onOpenCreateProduct?: () => void;
  onToggleTheme?: () => void;
  onToggleLanguage?: () => void;
}

export function isTypingInInput(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null;
  if (!target) return false;
  const tagName = target.tagName?.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    Boolean(target.isContentEditable)
  );
}

export function useGlobalShortcuts({
  onNavigate,
  onOpenCommandPalette,
  onOpenShortcutsHelp,
  onCloseModals,
  onOpenCreateProduct,
  onToggleTheme,
  onToggleLanguage,
}: UseGlobalShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModifier = e.ctrlKey || e.metaKey;
      const isAlt = e.altKey;
      const key = e.key.toLowerCase();

      // Toggle Theme: Alt+T or Ctrl+Shift+T (works everywhere)
      if ((isAlt && key === "t") || (isModifier && e.shiftKey && key === "t")) {
        e.preventDefault();
        if (onToggleTheme) {
          onToggleTheme();
        }
        return;
      }

      // Toggle Language: Alt+L or Ctrl+Shift+L (works everywhere)
      if ((isAlt && key === "l") || (isModifier && e.shiftKey && key === "l")) {
        e.preventDefault();
        if (onToggleLanguage) {
          onToggleLanguage();
        }
        return;
      }
      const inInput = isTypingInInput(e);

      // Escape key
      if (e.key === "Escape") {
        if (onCloseModals) {
          onCloseModals();
        }
        return;
      }

      // Command Palette: Ctrl+K or Cmd+K
      if (isModifier && key === "k") {
        e.preventDefault();
        onOpenCommandPalette();
        return;
      }

      // Shortcuts Help: "?" (when not in input) or Ctrl+/ or Cmd+/
      if ((!inInput && e.key === "?") || (isModifier && key === "/")) {
        e.preventDefault();
        onOpenShortcutsHelp();
        return;
      }

      // Create Product: Ctrl+Shift+P or Cmd+Shift+P
      if (isModifier && e.shiftKey && key === "p") {
        e.preventDefault();
        if (onOpenCreateProduct) {
          onOpenCreateProduct();
        } else {
          onNavigate("inventory");
        }
        return;
      }

      // Ctrl+N / Cmd+N or Alt+N: New Sale (POS)
      // High priority power-user request
      if (
        (isModifier && !e.shiftKey && key === "n") ||
        (isAlt && key === "n") ||
        (isAlt && key === "s")
      ) {
        e.preventDefault();
        onNavigate("sales");
        return;
      }

      // Ctrl+P / Cmd+P or Alt+P: Inventory & Products Catalog
      if (
        (isModifier && !e.shiftKey && key === "p") ||
        (isAlt && key === "p")
      ) {
        e.preventDefault();
        onNavigate("inventory");
        return;
      }

      // Ctrl+D / Cmd+D or Alt+D: Dashboard
      // Prevents browser bookmark dialog and navigates directly to Dashboard
      if (
        (isModifier && !e.shiftKey && key === "d") ||
        (isAlt && key === "d")
      ) {
        e.preventDefault();
        onNavigate("dashboard");
        return;
      }

      // Ctrl+I / Cmd+I or Alt+I: Inventory
      if (
        (isModifier && !e.shiftKey && key === "i") ||
        (isAlt && key === "i")
      ) {
        e.preventDefault();
        onNavigate("inventory");
        return;
      }

      // Ctrl+Shift+B / Cmd+Shift+B or Alt+Shift+B: Purchase History
      if (
        !inInput &&
        ((isModifier && e.shiftKey && key === "b") ||
          (isAlt && e.shiftKey && key === "b"))
      ) {
        e.preventDefault();
        onNavigate("purchase-history");
        return;
      }

      // Ctrl+B / Cmd+B or Alt+B: Purchases (only if not typing in input)
      if (
        !inInput &&
        ((isModifier && !e.shiftKey && key === "b") || (isAlt && key === "b"))
      ) {
        e.preventDefault();
        onNavigate("purchases");
        return;
      }

      // Ctrl+M / Cmd+M or Alt+M: Stock Movement Log
      if (
        !inInput &&
        ((isModifier && !e.shiftKey && key === "m") || (isAlt && key === "m"))
      ) {
        e.preventDefault();
        onNavigate("movements");
        return;
      }

      // Ctrl+V / Cmd+V or Alt+V: Vendors (only if not typing in input)
      if (
        !inInput &&
        ((isModifier && !e.shiftKey && key === "v") || (isAlt && key === "v"))
      ) {
        e.preventDefault();
        onNavigate("vendors");
        return;
      }

      // Alt+C or Ctrl+Shift+C: Customers (only if not typing in input)
      if (
        !inInput &&
        ((isAlt && key === "c") || (isModifier && e.shiftKey && key === "c"))
      ) {
        e.preventDefault();
        onNavigate("customers");
        return;
      }

      // Ctrl+H / Cmd+H or Alt+H: Sales History
      if (
        (isModifier && !e.shiftKey && key === "h") ||
        (isAlt && key === "h")
      ) {
        e.preventDefault();
        onNavigate("history");
        return;
      }

      // Ctrl+E / Cmd+E or Alt+E: Expenses
      if (
        (isModifier && !e.shiftKey && key === "e") ||
        (isAlt && key === "e")
      ) {
        e.preventDefault();
        onNavigate("expenses");
        return;
      }

      // Ctrl+U / Cmd+U or Alt+U: Staff Management
      if (
        (isModifier && !e.shiftKey && key === "u") ||
        (isAlt && key === "u")
      ) {
        e.preventDefault();
        onNavigate("staff");
        return;
      }

      // Ctrl+Y / Cmd+Y or Alt+Y: Payroll Management
      if (
        (isModifier && !e.shiftKey && key === "y") ||
        (isAlt && key === "y")
      ) {
        e.preventDefault();
        onNavigate("payroll");
        return;
      }

      // Alt+A or Ctrl+Shift+A: Analytics
      if ((isAlt && key === "a") || (isModifier && e.shiftKey && key === "a")) {
        e.preventDefault();
        onNavigate("analytics");
        return;
      }

      // Ctrl+, or Cmd+, or Alt+,: Settings
      if (
        (isModifier && (key === "," || e.code === "Comma")) ||
        (isAlt && (key === "," || e.code === "Comma"))
      ) {
        e.preventDefault();
        onNavigate("settings");
        return;
      }

      // Alt+H or Ctrl+Shift+H / Cmd+Shift+H: Technical Support
      if (
        !inInput &&
        ((isAlt && key === "h") || (isModifier && e.shiftKey && key === "h"))
      ) {
        e.preventDefault();
        onNavigate("support");
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    onNavigate,
    onOpenCommandPalette,
    onOpenShortcutsHelp,
    onCloseModals,
    onOpenCreateProduct,
    onToggleTheme,
  ]);
}
