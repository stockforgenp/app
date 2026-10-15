/**
 * Settings & System Diagnostics View
 * Implements Sections 16, 17, and 19:
 * - Currency Symbol configuration (default: Rs.)
 * - Low-stock threshold (default: 10 units)
 * - Allow negative stock toggle (default: OFF)
 * - Backup SQLite database (exports binary .sqlite file)
 * - Restore SQLite database (imports binary .sqlite file with confirmation warning)
 * - Reset database to sample state
 * - Section 19 Automated Business Logic Test Suite runner
 */
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Settings,
  Database,
  CheckCircle2,
  XCircle,
  FlaskConical,
  Play,
  Printer,
  Store,
  Sun,
  Moon,
  Languages,
  LogOut,
} from "lucide-react";
import { AppSettings, TestResultItem } from "../types/index.ts";
import {
  getSettings,
  updateSettings,
} from "../lib/services/settingsService.ts";
import { runBusinessLogicTests } from "../lib/services/testService.ts";
import { Select } from "../components/common/Select.tsx";
import { Input } from "../components/common/Input.tsx";
import { useToast } from "../context/ToastContext.tsx";
import { useTheme } from "../context/ThemeContext.tsx";
import { useLanguage } from "../context/LanguageContext.tsx";
import { useAuth } from "../context/AuthContext.tsx";

interface SettingsViewProps {
  onSettingsUpdated: (newSettings: AppSettings) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onSettingsUpdated,
}) => {
  const { showToast } = useToast();
  const { theme, setTheme } = useTheme();
  const { t, language, setLanguage, isNepali } = useLanguage();
  const { currentShop, logout, allShops, switchShop } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [currencyInput, setCurrencyInput] = useState(settings.currency_symbol);
  const [lowStockInput, setLowStockInput] = useState(
    settings.low_stock_threshold.toString(),
  );
  const [negativeStock, setNegativeStock] = useState(
    settings.allow_negative_stock,
  );
  const [storeNameInput, setStoreNameInput] = useState(
    settings.store_name || "StockForge Retail",
  );
  const [storeAddressInput, setStoreAddressInput] = useState(
    settings.store_address || "",
  );
  const [storePhoneInput, setStorePhoneInput] = useState(
    settings.store_phone || "",
  );
  const [storePanVatInput, setStorePanVatInput] = useState(
    settings.store_pan_vat || "",
  );
  const [enableVat, setEnableVat] = useState(settings.enable_vat !== false);
  const [receiptFooterInput, setReceiptFooterInput] = useState(
    settings.receipt_footer ||
      "Thank you for shopping with us! Please come again.",
  );

  // Tests
  const [testResults, setTestResults] = useState<TestResultItem[] | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  useEffect(() => {
    const s = getSettings();
    let cur = s.currency_symbol || (language === "np" ? "रु." : "Rs.");
    if (language === "np") {
      const isRs =
        !cur ||
        cur === "Rs." ||
        cur === "Rs" ||
        cur.toLowerCase() === "rs" ||
        cur.toLowerCase() === "rs." ||
        cur.toUpperCase() === "NRS" ||
        cur.toUpperCase() === "NRS.";
      if (isRs) cur = "रु.";
    } else {
      const isNe =
        cur === "रु." || cur === "रु" || cur === "रू." || cur === "रू";
      if (isNe) cur = "Rs.";
    }
    setSettings({ ...s, currency_symbol: cur });
    setCurrencyInput(cur);
    setLowStockInput(s.low_stock_threshold.toString());
    setNegativeStock(s.allow_negative_stock);
    setStoreNameInput(s.store_name || "StockForge Retail");
    setStoreAddressInput(s.store_address || "");
    setStorePhoneInput(s.store_phone || "");
    setStorePanVatInput(s.store_pan_vat || "");
    setEnableVat(s.enable_vat !== false);
    setReceiptFooterInput(
      s.receipt_footer || "Thank you for shopping with us! Please come again.",
    );
  }, [language]);

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    const threshold = parseInt(lowStockInput, 10);
    const updated = updateSettings({
      currency_symbol: currencyInput.trim() || "Rs.",
      low_stock_threshold: isNaN(threshold) ? 10 : threshold,
      allow_negative_stock: negativeStock,
      store_name: storeNameInput.trim() || "StockForge Retail",
      store_address: storeAddressInput.trim(),
      store_phone: storePhoneInput.trim(),
      store_pan_vat: storePanVatInput.trim(),
      enable_vat: enableVat,
      receipt_footer: receiptFooterInput.trim(),
    });
    setSettings(updated);
    onSettingsUpdated(updated);
    showToast("Settings & bill receipt header updated successfully", "success");
  };

  const handleRunTests = async () => {
    setIsRunningTests(true);
    try {
      const results = await runBusinessLogicTests();
      setTestResults(results);
      const allPassed = results.every((r) => r.passed);
      if (allPassed) {
        showToast(
          "All 11 business logic & ACID tests passed perfectly!",
          "success",
        );
      } else {
        showToast(
          "Some business logic tests reported discrepancies",
          "warning",
        );
      }
    } catch (err: unknown) {
      showToast((err as Error).message, "error", "Testing Error");
    } finally {
      setIsRunningTests(false);
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-150">
      {/* Shop Profile & Identity Card */}
      {currentShop && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-100">
              <Store className="w-4 h-4 text-emerald-400" />
              <span>
                {isNepali
                  ? "पसल खाता तथा दर्ता विवरण"
                  : "Registered Shop Profile & Account"}
              </span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="px-2.5 py-1 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Log out of this shop"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{isNepali ? "लगआउट (Log Out)" : "Log Out"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-1">
            <div className="p-3 bg-neutral-950 border border-neutral-800/80 rounded-lg">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider block mb-1">
                {isNepali ? "पसलको नाम" : "Shop Name"}
              </span>
              <span className="text-xs font-bold text-neutral-100 block truncate">
                {currentShop.name}
              </span>
            </div>

            <div className="p-3 bg-neutral-950 border border-neutral-800/80 rounded-lg">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider block mb-1">
                {isNepali ? "सञ्चालक इमेल" : "Registered Email"}
              </span>
              <span className="text-xs font-mono text-neutral-300 block truncate">
                {currentShop.email}
              </span>
            </div>

            <div className="p-3 bg-neutral-950 border border-neutral-800/80 rounded-lg">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider block mb-1">
                {isNepali ? "पसलको प्रकार" : "Category / Type"}
              </span>
              <span className="text-xs font-semibold text-emerald-400 block truncate">
                {currentShop.shop_type}
              </span>
            </div>

            <div className="p-3 bg-neutral-950 border border-neutral-800/80 rounded-lg">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider block mb-1">
                {isNepali ? "सम्पर्क / फोन" : "Contact Phone"}
              </span>
              <span className="text-xs font-mono text-neutral-300 block truncate">
                {currentShop.phone || "—"}
              </span>
            </div>
          </div>

          {/* Subscription Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-1">
            <div className="p-3 bg-neutral-950 border border-neutral-800/80 rounded-lg">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider block mb-1">
                {isNepali ? "सदस्यता योजना" : "Subscription Plan"}
              </span>
              <span className="text-xs font-bold text-emerald-400 block truncate">
                {currentShop.subscription_plan || "Standard"}
              </span>
            </div>

            <div className="p-3 bg-neutral-950 border border-neutral-800/80 rounded-lg">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider block mb-1">
                {isNepali ? "सुरु मिति" : "Subscribed Date"}
              </span>
              <span className="text-xs font-mono text-neutral-300 block truncate">
                {currentShop.subscribed_date || "—"}
              </span>
            </div>

            <div className="p-3 bg-neutral-950 border border-neutral-800/80 rounded-lg">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider block mb-1">
                {isNepali ? "समयावधि" : "Duration"}
              </span>
              <span className="text-xs text-neutral-300 block truncate">
                {currentShop.subscription_duration_days || 365}{" "}
                {isNepali ? "दिन" : "Days"}
              </span>
            </div>

            <div className="p-3 bg-neutral-950 border border-neutral-800/80 rounded-lg">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider block mb-1">
                {isNepali ? "म्याद सकिने मिति" : "Expiry Date"}
              </span>
              <span className="text-xs font-mono font-semibold text-neutral-100 block truncate">
                {currentShop.subscription_expiry_date || "—"}
              </span>
            </div>
          </div>

          {allShops.length > 1 && (
            <div className="pt-2 border-t border-neutral-800/60 flex items-center justify-between text-xs">
              <span className="text-neutral-400">
                {isNepali
                  ? "अन्य दर्ता भएका पसलमा जानुहोस्:"
                  : "Switch to another registered shop:"}
              </span>
              <Select
                value={currentShop.id}
                onChange={(e) => switchShop(parseInt(e.target.value, 10))}
                containerClassName="w-56"
                sizeVariant="sm"
                options={allShops.map((s) => ({
                  value: s.id,
                  label: `${s.name} (${s.shop_type})`,
                }))}
              />
            </div>
          )}
        </div>
      )}

      {/* Theme & Appearance Card */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-100">
            <Sun className="w-4 h-4 text-amber-400" />
            <span>Appearance & Interface Theme</span>
          </div>
          <span className="text-xs text-neutral-400">
            Active:{" "}
            <strong className="text-neutral-200 capitalize">
              {theme} Theme
            </strong>
          </span>
        </div>

        <p className="text-xs text-neutral-400">
          Choose your visual preference. Light theme is the default clean retail
          workspace, or switch to dark theme for low-light environments.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {/* Light Theme Option (Default) */}
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
              theme === "light"
                ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/30"
                : "border-neutral-800 bg-neutral-950 hover:border-neutral-700"
            }`}
          >
            <div
              className={`p-2.5 rounded-lg shrink-0 ${
                theme === "light"
                  ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                  : "bg-neutral-800 text-neutral-400"
              }`}
            >
              <Sun className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-100">
                  Light Theme
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-semibold border border-emerald-500/20">
                  Default
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-1">
                Bright, high-contrast, modern daylight canvas tailored for
                retail counters and bright shop floors.
              </p>
            </div>
          </button>

          {/* Dark Theme Option */}
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
              theme === "dark"
                ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/30"
                : "border-neutral-800 bg-neutral-950 hover:border-neutral-700"
            }`}
          >
            <div
              className={`p-2.5 rounded-lg shrink-0 ${
                theme === "dark"
                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                  : "bg-neutral-800 text-neutral-400"
              }`}
            >
              <Moon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-100">
                  Dark Theme
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-1">
                Deep obsidian palette reduces eye strain during evening shifts
                and night stocktaking audits.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Language Selection Card (EN <-> NP) */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-100">
            <Languages className="w-4 h-4 text-emerald-400" />
            <span>{t("set_language_title")}</span>
          </div>
          <span className="text-xs text-neutral-400">
            Active:{" "}
            <strong className="text-emerald-400 font-medium">
              {isNepali ? "नेपाली (Nepali)" : "English (अंग्रेजी)"}
            </strong>
          </span>
        </div>

        <p className="text-xs text-neutral-400">{t("set_language_desc")}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {/* English Option */}
          <button
            type="button"
            onClick={() => {
              setLanguage("en");
              setCurrencyInput("Rs.");
              const updated = updateSettings({ currency_symbol: "Rs." });
              setSettings(updated);
              onSettingsUpdated(updated);
              showToast(
                "Language switched to English and currency set to Rs.",
                "info",
              );
            }}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
              language === "en"
                ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/30"
                : "border-neutral-800 bg-neutral-950 hover:border-neutral-700"
            }`}
          >
            <div
              className={`p-2.5 rounded-lg shrink-0 ${
                language === "en"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-neutral-800 text-neutral-400"
              }`}
            >
              <span className="font-mono text-xs font-bold">EN</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-100">
                  English
                </span>
                {language === "en" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-semibold border border-emerald-500/20">
                    Active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-400 mt-1">
                Standard international English with default currency "Rs.".
              </p>
            </div>
          </button>

          {/* Nepali Option */}
          <button
            type="button"
            onClick={() => {
              setLanguage("np");
              setCurrencyInput("रु.");
              const updated = updateSettings({ currency_symbol: "रु." });
              setSettings(updated);
              onSettingsUpdated(updated);
              showToast(
                "भाषा नेपालीमा परिवर्तन भयो र मुद्रा संकेत रु. मा सेट भयो",
                "info",
              );
            }}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
              language === "np"
                ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/30"
                : "border-neutral-800 bg-neutral-950 hover:border-neutral-700"
            }`}
          >
            <div
              className={`p-2.5 rounded-lg shrink-0 ${
                language === "np"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-neutral-800 text-neutral-400"
              }`}
            >
              <span className="font-mono text-xs font-bold">ने</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-100">
                  नेपाली (Nepali)
                </span>
                {language === "np" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-semibold border border-emerald-500/20">
                    सक्रिय
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-400 mt-1">
                नेपाली भाषा र स्वचालित नेपाली रुपैयाँ संकेत (रु.)।
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* General Settings Card */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-100 pb-3 border-b border-neutral-800">
          <Settings className="w-4 h-4 text-emerald-400" />
          <span>General Application Rules</span>
        </div>

        <form onSubmit={handleSaveGeneral} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Currency Symbol */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-neutral-300">
                  {t("set_currency_label", "Currency Symbol")}
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-neutral-500">Preset:</span>
                  <button
                    type="button"
                    onClick={() => setCurrencyInput("रु.")}
                    className={`px-1.5 py-0.5 text-[10px] font-mono rounded border transition-colors cursor-pointer ${
                      currencyInput === "रु."
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold"
                        : "bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200"
                    }`}
                  >
                    रु.
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrencyInput("Rs.")}
                    className={`px-1.5 py-0.5 text-[10px] font-mono rounded border transition-colors cursor-pointer ${
                      currencyInput === "Rs."
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold"
                        : "bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200"
                    }`}
                  >
                    Rs.
                  </button>
                </div>
              </div>
              <Input
                type="text"
                required
                mono
                value={currencyInput}
                onChange={(e) => setCurrencyInput(e.target.value)}
                placeholder={isNepali ? "रु." : "Rs."}
                helperText={
                  isNepali
                    ? 'नेपाली भाषामा डिफल्ट "रु."। सबै तालिका, बिक्री काउन्टर, रसिद र रिपोर्टहरूमा देखिन्छ।'
                    : 'Default: "Rs." in English, "रु." in Nepali. Displays across all tables, POS, reports, and receipts.'
                }
              />
            </div>

            {/* Low-Stock Threshold */}
            <Input
              label="Low-Stock Threshold (Units)"
              type="number"
              min="0"
              required
              mono
              value={lowStockInput}
              onChange={(e) => setLowStockInput(e.target.value)}
              placeholder="10"
              helperText="Default: 10 units. Products at or below this count show warnings."
            />
          </div>

          {/* Allow Negative Stock Toggle */}
          <div className="pt-2">
            <div className="flex items-start justify-between p-4 rounded-xl bg-neutral-950 border border-neutral-800">
              <div className="pr-4">
                <div className="text-xs font-semibold text-neutral-200">
                  Allow Negative Stock
                </div>
                <div className="text-[11px] text-neutral-400 mt-0.5">
                  Default:{" "}
                  <span className="font-semibold text-neutral-300">OFF</span>.
                  When disabled, sales cannot exceed current on-hand inventory.
                  When enabled, stock is allowed to drop below zero.
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                <Input
                  type="checkbox"
                  checked={negativeStock}
                  onChange={(e) => setNegativeStock(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>

          {/* VAT / Tax Calculation (13%) Toggle */}
          <div className="pt-2">
            <div className="flex items-start justify-between p-4 rounded-xl bg-neutral-950 border border-neutral-800">
              <div className="pr-4">
                <div className="text-xs font-semibold text-neutral-200">
                  {isNepali
                    ? "१३% भ्याट गणना सक्रिय गर्नुहोस्"
                    : "Enable 13% VAT Calculation"}
                </div>
                <div className="text-[11px] text-neutral-400 mt-0.5">
                  {isNepali ? (
                    <>
                      डिफल्ट:{" "}
                      <span className="font-semibold text-emerald-400">
                        {enableVat ? "चालू (१३%)" : "बन्द (०%)"}
                      </span>
                      । सक्रिय हुँदा, बिक्री तथा खरिद बिलहरूमा १३% मूल्य
                      अभिवृद्धि कर (VAT) गणना हुन्छ। बन्द गर्दा, सबै कारोबारहरू
                      भ्याट विना (०%) जारी हुन्छन्।
                    </>
                  ) : (
                    <>
                      Default:{" "}
                      <span className="font-semibold text-emerald-400">
                        {enableVat ? "ON (13%)" : "OFF (0%)"}
                      </span>
                      . When enabled, sales and purchase invoices calculate
                      standard 13% Value Added Tax on taxable amounts. If turned
                      off, transactions are billed without VAT (0%).
                    </>
                  )}
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                <Input
                  type="checkbox"
                  checked={enableVat}
                  onChange={(e) => {
                    const nextVal = e.target.checked;
                    setEnableVat(nextVal);
                    const updated = updateSettings({ enable_vat: nextVal });
                    setSettings(updated);
                    onSettingsUpdated(updated);
                    showToast(
                      nextVal
                        ? isNepali
                          ? "१३% भ्याट गणना सक्रिय गरियो"
                          : "13% VAT calculation enabled for store"
                        : isNepali
                          ? "भ्याट गणना निष्क्रिय गरियो (०%)"
                          : "VAT calculation disabled for store (0%)",
                      "info",
                    );
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>

          {/* Store & Bill Print Customization */}
          <div className="pt-4 border-t border-neutral-800/80 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-200">
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>Store Details & Printed Bill Header</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Store / Business Name"
                type="text"
                value={storeNameInput}
                onChange={(e) => setStoreNameInput(e.target.value)}
                placeholder="e.g. Al-Madina Superstore"
                helperText="Appears at the top of printed thermal receipts and invoices."
              />

              <Input
                label="Store PAN / VAT Number"
                type="text"
                mono
                value={storePanVatInput}
                onChange={(e) => setStorePanVatInput(e.target.value)}
                placeholder="e.g. 601234567"
                helperText="Printed on receipt header for tax invoice compliance."
              />

              <Input
                label="Contact Phone / Mobile"
                type="text"
                mono
                value={storePhoneInput}
                onChange={(e) => setStorePhoneInput(e.target.value)}
                placeholder="e.g. +92 300 1234567"
                helperText="Printed on receipt header for customer inquiries."
              />

              <div className="md:col-span-2">
                <Input
                  label="Store Address"
                  type="text"
                  value={storeAddressInput}
                  onChange={(e) => setStoreAddressInput(e.target.value)}
                  placeholder="e.g. Shop #14, Main Market, Blue Area, Islamabad"
                />
              </div>

              <div className="md:col-span-2">
                <Input
                  label="Bill Footer Message / Return Policy"
                  type="text"
                  value={receiptFooterInput}
                  onChange={(e) => setReceiptFooterInput(e.target.value)}
                  placeholder="e.g. Thank you for shopping with us! Please come again."
                  helperText="Printed at the bottom of the bill receipt."
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer"
            >
              Save Configuration
            </button>
          </div>
        </form>
      </div>

      {/* Quick Link Banner to Dedicated Backup & Restore Menu */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-neutral-200">
              {isNepali
                ? "डाटाबेस ब्याकअप र पुनर्स्थापना नयाँ मेनुमा उपलब्ध छ"
                : "Database Backup & Recovery is in a dedicated menu"}
            </div>
            <div className="text-[11px] text-neutral-400 mt-0.5">
              {isNepali
                ? "पूर्ण एसक्यूएल डम्प (.sql), बाइनरी स्न्यापसट (.sqlite), डाटा टेलिमेट्री र पुनर्स्थापना उपकरणहरू अब छुट्टै 'ब्याकअप र पुनर्स्थापना' मेनुमा उपलब्ध छन्।"
                : "Full SQL script dumps (.sql), binary snapshots (.sqlite), telemetry, and disaster recovery tools now live in the dedicated Backup & Restore menu."}
            </div>
          </div>
        </div>
        <Link
          to="/backup"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer shrink-0 shadow-xs"
        >
          <Database className="w-3.5 h-3.5" />
          <span>
            {isNepali ? "ब्याकअप मेनु खोल्नुहोस्" : "Open Backup & Restore"}
          </span>
        </Link>
      </div>

      {/* Section 19: Business Logic & ACID Test Suite */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-neutral-100">
              Section 19: Automated Business Logic & Invariant Test Suite
            </h2>
          </div>

          <button
            type="button"
            disabled={isRunningTests}
            onClick={handleRunTests}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            <span>
              {isRunningTests ? "Executing Tests..." : "Run All 11 Tests"}
            </span>
          </button>
        </div>

        <p className="text-xs text-neutral-400">
          Executes isolated test runs against a temporary WebAssembly SQLite
          instance to verify all 11 mandatory requirements from Section 19:
          Product creation, restocking, sales math (Gross, Discount, Net
          Revenue, COGS, Gross Profit), historical cost snapshot preservation,
          stock depletion, overselling prevention, and atomic rollback on
          failure.
        </p>

        {testResults && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs text-neutral-300 pb-1 font-mono">
              <span>Test Suite Execution Results:</span>
              <span className="text-emerald-400 font-semibold">
                {testResults.filter((t) => t.passed).length} /{" "}
                {testResults.length} Invariants Passed
              </span>
            </div>

            <div className="space-y-1.5">
              {testResults.map((t, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border text-xs flex items-start justify-between gap-3 ${
                    t.passed
                      ? "bg-neutral-950 border-emerald-500/20 text-neutral-200"
                      : "bg-rose-950/20 border-rose-500/40 text-rose-200"
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    {t.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-semibold text-neutral-100">
                        {t.name}
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-0.5 font-mono">
                        {t.message}
                      </div>
                    </div>
                  </div>

                  {t.expected !== undefined && (
                    <div className="text-right shrink-0 font-mono text-[11px]">
                      <div className="text-neutral-400">
                        Expected: {t.expected}
                      </div>
                      <div
                        className={
                          t.passed ? "text-emerald-400" : "text-rose-400"
                        }
                      >
                        Actual: {t.actual}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
