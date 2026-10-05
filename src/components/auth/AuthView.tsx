/**
 * Authentication View: Shop Terminal Login & Registration
 * Features:
 * - Dual mode: Direct Terminal Login <-> New Shop Registration
 * - Direct login with email or phone + password
 * - New retail shop creation with shop type, currency, and optional test seed data
 * - Instant 1-click Demo Shop access
 * - Quick-select previously registered shops from SQLite
 * - Bilingual (English <-> Nepali) support with full dark/light theme awareness
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store,
  Mail,
  Lock,
  LogIn,
  UserPlus,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Languages,
  ShieldCheck,
  Phone,
  MapPin,
  Tag,
  Coins,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.tsx";
import { useLanguage } from "../../context/LanguageContext.tsx";
import { useTheme } from "../../context/ThemeContext.tsx";
import { Input } from "../common/Input.tsx";
import { Select } from "../common/Select.tsx";

const SHOP_TYPES = [
  "Grocery & Supermarket",
  "Clothing & Apparel",
  "Electronics & Mobile",
  "Pharmacy & Healthcare",
  "Cafe, Bakery & Restaurant",
  "Hardware & Construction",
  "Stationery & Bookshop",
  "Cosmetics & Personal Care",
  "Departmental & Wholesale",
  "General Retail & Store",
  "Other",
];

const CURRENCY_OPTIONS = [
  { value: "रु.", label: "रु. (Nepali Rupee - Default)" },
  { value: "Rs.", label: "Rs. (Rupee)" },
  { value: "$", label: "$ (USD)" },
  { value: "€", label: "€ (Euro)" },
  { value: "£", label: "£ (GBP)" },
];

interface AuthViewProps {
  onSuccess?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onSuccess }) => {
  const { login, register, allShops, switchShop, hasAnyShops } = useAuth();
  const { t, isNepali, toggleLanguage } = useLanguage();
  const { isDark, toggleTheme } = useTheme();

  const [mode, setMode] = useState<"login" | "register">(
    hasAnyShops ? "login" : "register",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Registration form state
  const [registerData, setRegisterData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    shop_type: "Grocery & Supermarket",
    address: "",
    currency_symbol: isNepali ? "रु." : "Rs.",
  });

  // Login form state
  const [loginData, setLoginData] = useState({
    emailOrPhone: "",
    password: "",
  });

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!loginData.emailOrPhone.trim()) {
      setError(t("auth_err_email_phone_required"));
      return;
    }
    if (!loginData.password) {
      setError(t("auth_err_password_required"));
      return;
    }

    setLoading(true);
    try {
      await login({
        emailOrPhone: loginData.emailOrPhone.trim(),
        password: loginData.password,
      });
      onSuccess?.();
    } catch (err: unknown) {
      setError((err as Error).message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!registerData.name.trim()) {
      setError(t("auth_err_shop_name_required"));
      return;
    }
    if (!registerData.email.trim() || !registerData.email.includes("@")) {
      setError(t("auth_err_email_invalid"));
      return;
    }
    if (registerData.password.length < 4) {
      setError(t("auth_err_password_length"));
      return;
    }
    if (registerData.password !== registerData.confirmPassword) {
      setError(t("auth_err_password_mismatch"));
      return;
    }

    setLoading(true);
    try {
      await register({
        name: registerData.name.trim(),
        email: registerData.email.trim(),
        password: registerData.password,
        phone: registerData.phone.trim() || undefined,
        shop_type: registerData.shop_type,
        address: registerData.address.trim() || undefined,
        currency_symbol:
          registerData.currency_symbol || (isNepali ? "रु." : "Rs."),
      });
      onSuccess?.();
    } catch (err: unknown) {
      setError((err as Error).message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSelectShop = async (shopId: number) => {
    setLoading(true);
    try {
      await switchShop(shopId);
      onSuccess?.();
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to select shop.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col bg-neutral-950 text-neutral-100 font-sans selection:bg-emerald-500/30 overflow-y-auto">
      {/* Top Header bar */}
      <header className="h-14 px-6 border-b border-neutral-800/80 flex items-center justify-between shrink-0 bg-neutral-900/90 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-xs">
            <Store className="w-4 h-4" />
          </div>
          <div>
            <span className="text-sm font-black tracking-tight text-neutral-100">
              StockForge
            </span>
            <span className="text-[10px] text-emerald-400 font-mono ml-2 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
              POS Terminal
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Language Switcher */}
          <button
            type="button"
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-300 hover:text-neutral-100 bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/60 transition-colors cursor-pointer"
            title="Toggle Language"
          >
            <Languages className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isNepali ? "नेपाली" : "English"}</span>
          </button>

          {/* Theme Switcher */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/60 transition-colors cursor-pointer"
            title="Toggle Dark / Light Theme"
          >
            {isDark ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-neutral-400" />
            )}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8">
        <div
          className={`w-full ${mode === "register" ? "max-w-xl" : "max-w-md"} transition-all duration-200`}
        >
          {/* Brand Card Title */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{t("auth_badge_offline")}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-100 tracking-tight">
              {mode === "register"
                ? t("auth_register_title")
                : t("auth_login_title")}
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1.5 max-w-sm mx-auto">
              {mode === "register"
                ? t("auth_register_desc")
                : t("auth_login_desc")}
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl  p-6 sm:p-8 relative overflow-hidden">
            {/* Mode Tabs (Login vs Register) */}
            <div className="grid grid-cols-2 p-1 bg-neutral-950 border border-neutral-800 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
                className={`py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  mode === "login"
                    ? "bg-neutral-800 text-neutral-100 shadow-xs"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{t("auth_tab_login")}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError(null);
                }}
                className={`py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  mode === "register"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{t("auth_tab_register")}</span>
              </button>
            </div>

            {/* Error Banner */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5"
                >
                  <span className="text-rose-400 font-bold shrink-0">!</span>
                  <div className="flex-1">{error}</div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ================= REGISTER FORM ================= */}
            {mode === "register" ? (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                {/* Shop Name */}
                <Input
                  label={t("auth_shop_name")}
                  icon={Store}
                  type="text"
                  required
                  placeholder={t("auth_shop_name_placeholder")}
                  value={registerData.name}
                  onChange={(e) =>
                    setRegisterData({ ...registerData, name: e.target.value })
                  }
                />

                {/* Email and Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <Input
                    label={t("auth_owner_email")}
                    icon={Mail}
                    type="email"
                    required
                    placeholder="owner@store.com"
                    value={registerData.email}
                    onChange={(e) =>
                      setRegisterData({
                        ...registerData,
                        email: e.target.value,
                      })
                    }
                  />

                  <Input
                    label={t("auth_store_phone")}
                    icon={Phone}
                    type="tel"
                    mono
                    placeholder={t("auth_store_phone_placeholder")}
                    value={registerData.phone}
                    onChange={(e) =>
                      setRegisterData({
                        ...registerData,
                        phone: e.target.value,
                      })
                    }
                  />
                </div>

                {/* Shop Type and Currency */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <Select
                    label={t("auth_shop_type")}
                    icon={Tag}
                    value={registerData.shop_type}
                    onChange={(e) =>
                      setRegisterData({
                        ...registerData,
                        shop_type: String(e.target.value),
                      })
                    }
                    options={SHOP_TYPES}
                  />

                  <Select
                    label={t("auth_currency")}
                    icon={Coins}
                    value={registerData.currency_symbol}
                    onChange={(e) =>
                      setRegisterData({
                        ...registerData,
                        currency_symbol: String(e.target.value),
                      })
                    }
                    options={CURRENCY_OPTIONS}
                  />
                </div>

                {/* Store Address */}
                <Input
                  label={t("auth_address")}
                  icon={MapPin}
                  type="text"
                  placeholder={t("auth_address_placeholder")}
                  value={registerData.address}
                  onChange={(e) =>
                    setRegisterData({
                      ...registerData,
                      address: e.target.value,
                    })
                  }
                />

                {/* Passwords */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <Input
                    label={t("auth_password_register")}
                    icon={Lock}
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={registerData.password}
                    onChange={(e) =>
                      setRegisterData({
                        ...registerData,
                        password: e.target.value,
                      })
                    }
                    rightIcon={
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-neutral-500 hover:text-neutral-300 text-xs cursor-pointer flex items-center"
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    }
                  />

                  <Input
                    label={t("auth_confirm_password")}
                    icon={Lock}
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={registerData.confirmPassword}
                    onChange={(e) =>
                      setRegisterData({
                        ...registerData,
                        confirmPassword: e.target.value,
                      })
                    }
                  />
                </div>

                {/* Submit Register Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
                >
                  {loading ? (
                    <span>{t("auth_creating_shop")}</span>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>{t("auth_btn_register")}</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* ================= LOGIN FORM ================= */
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {/* Email or Phone */}
                <Input
                  label={t("auth_login_identity")}
                  icon={Mail}
                  type="text"
                  required
                  placeholder={t("auth_login_identity_placeholder")}
                  value={loginData.emailOrPhone}
                  onChange={(e) =>
                    setLoginData({ ...loginData, emailOrPhone: e.target.value })
                  }
                />

                {/* Password */}
                <Input
                  label={t("auth_password")}
                  icon={Lock}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-neutral-500 hover:text-neutral-300 text-xs cursor-pointer flex items-center"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  }
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={loginData.password}
                  onChange={(e) =>
                    setLoginData({ ...loginData, password: e.target.value })
                  }
                />

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
                >
                  {loading ? (
                    <span>{t("auth_logging_in")}</span>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>{t("auth_btn_login")}</span>
                    </>
                  )}
                </button>

                {/* Previously Registered Shops in SQLite */}
                {allShops.length > 0 && (
                  <div className="pt-4 border-t border-neutral-800/80">
                    <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-2">
                      {t("auth_saved_shops")}
                    </span>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {allShops.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleQuickSelectShop(s.id)}
                          className="w-full p-2.5 rounded-lg bg-neutral-950 hover:bg-neutral-800 border border-neutral-800/70 hover:border-emerald-500/50 flex items-center justify-between text-left transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Store className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <div className="truncate">
                              <span className="text-xs font-bold text-neutral-200 block truncate">
                                {s.name}
                              </span>
                              <span className="text-[10px] text-neutral-500 block truncate">
                                {s.email} · {s.shop_type}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] text-emerald-400 font-mono font-medium shrink-0 ml-2">
                            Select &rarr;
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </form>
            )}

            {/* Bottom prompt */}
            <div className="mt-6 text-center text-xs text-neutral-400">
              {mode === "register" ? (
                <span>
                  {t("auth_already_registered")}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setError(null);
                    }}
                    className="text-emerald-400 hover:text-emerald-300 font-bold underline underline-offset-2 ml-1 cursor-pointer"
                  >
                    {t("auth_link_login")}
                  </button>
                </span>
              ) : (
                <span>
                  {t("auth_need_register")}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("register");
                      setError(null);
                    }}
                    className="text-emerald-400 hover:text-emerald-300 font-bold underline underline-offset-2 ml-1 cursor-pointer"
                  >
                    {t("auth_link_register")}
                  </button>
                </span>
              )}
            </div>
          </div>

          {/* Footer note */}
          <div className="text-center mt-6 text-[11px] text-neutral-500 space-y-1">
            <p>StockForge Offline POS · SQLite ACID Transaction Engine</p>
            <p className="text-[10px]">{t("auth_footer_note")}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
