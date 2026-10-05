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
  Headphones,
  MessageCircle,
  HelpCircle,
  Copy,
  Check,
  Terminal,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.tsx";
import { useLanguage } from "../context/LanguageContext.tsx";
import { useTheme } from "../context/ThemeContext.tsx";
import { useToast } from "../context/ToastContext.tsx";
import { Input } from "../components/common/Input.tsx";
import { Select } from "../components/common/Select.tsx";
import { Modal } from "../components/common/Modal.tsx";
import {
  SHOP_TYPES,
  CURRENCY_OPTIONS,
  SUPPORT_CONTACTS,
} from "../constants/index.ts";
import { compileSystemDiagnostics } from "../helpers/index.ts";

interface AuthViewProps {
  onSuccess?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onSuccess }) => {
  const { login, register, allShops, switchShop, hasAnyShops } = useAuth();
  const { t, isNepali, toggleLanguage, language } = useLanguage();
  const { isDark, toggleTheme, theme } = useTheme();
  const { showToast } = useToast();

  const [mode, setMode] = useState<"login" | "register">(
    hasAnyShops ? "login" : "register",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string, msg: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast(msg, "info");
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleWhatsAppSupport = () => {
    const text = encodeURIComponent(
      isNepali
        ? "नमस्ते, मलाई स्टकफोर्ज (StockForge) पसल लगइन / टर्मिनल सेटअपमा प्राविधिक सहयोग चाहियो।"
        : "Hello StockForge Support, I need assistance with shop login / terminal setup.",
    );
    window.open(
      `https://wa.me/${SUPPORT_CONTACTS.whatsappRaw}?text=${text}`,
      "_blank",
    );
  };

  const handleEmailSupport = () => {
    const subject = encodeURIComponent(
      "[StockForge Support] Shop Login & Terminal Help",
    );
    const body = encodeURIComponent(
      `Hello StockForge Support Team,\n\nI need help accessing or setting up my shop terminal.\n\nIssue Details:\n\n\n--- Diagnostics ---\nApp: StockForge Desktop\nEngine: SQLite WASM (Local-First Offline)\n`,
    );
    window.open(
      `mailto:${SUPPORT_CONTACTS.email}?subject=${subject}&body=${body}`,
      "_blank",
    );
  };

  const handleCopyDiagnostics = () => {
    const diagStr = compileSystemDiagnostics({
      language,
      theme,
      extra: {
        storedShopsCount: allShops.length,
      },
    });
    handleCopy(
      diagStr,
      "diagnostics",
      t("dev_diagnostics_copied") || "Diagnostic details copied to clipboard!",
    );
  };

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
          {/* Technical Support Quick Button */}
          <button
            type="button"
            onClick={() => setIsSupportModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-300 hover:text-emerald-400 bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/60 hover:border-emerald-500/30 transition-colors cursor-pointer"
            title={
              isNepali
                ? "प्राविधिक सहयोग तथा विकासकर्ता सम्पर्क"
                : "Technical Support & Terminal Help"
            }
          >
            <Headphones className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline font-medium">
              {t("auth_support_button")}
            </span>
          </button>

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
                  className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start justify-between gap-2.5"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="text-rose-400 font-bold shrink-0">!</span>
                    <div className="flex-1">{error}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSupportModalOpen(true)}
                    className="text-[11px] text-rose-300 hover:text-white underline font-semibold shrink-0 cursor-pointer"
                  >
                    {t("auth_support_button")}
                  </button>
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

                {/* Forgot Password / Terminal Assistance */}
                <div className="flex justify-end pt-0.5">
                  <button
                    type="button"
                    onClick={() => setIsSupportModalOpen(true)}
                    className="text-[11px] text-neutral-400 hover:text-emerald-400 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <HelpCircle className="w-3 h-3 text-emerald-500/70" />
                    <span>{t("auth_forgot_password_help")}</span>
                  </button>
                </div>

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
          <div className="text-center mt-6 text-[11px] text-neutral-500 space-y-1.5">
            <p>StockForge Offline POS · SQLite ACID Transaction Engine</p>
            <p className="text-[10px]">{t("auth_footer_note")}</p>
            <div className="pt-1 flex items-center justify-center">
              <button
                type="button"
                onClick={() => setIsSupportModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-emerald-400 text-[10px] transition-colors cursor-pointer"
              >
                <Headphones className="w-3 h-3 text-emerald-400" />
                <span>{t("auth_support_footer_line")} (+977 980-1234567)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Optimized Technical Support Modal for Auth & Terminal Setup */}
      {isSupportModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsSupportModalOpen(false)}
          title={t("auth_support_modal_title")}
          subtitle={t("auth_support_modal_subtitle")}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            {/* Quick Emergency Assistance Channels */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Phone / Hotline */}
              <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                      {t("dev_call_support")}
                    </span>
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="font-mono text-xs font-bold text-neutral-100 pt-1">
                    {SUPPORT_CONTACTS.phone}
                  </div>
                  <span className="text-[10px] text-emerald-400 block pt-0.5">
                    {isNepali ? "२४/७ काउन्टर हटलाइन" : "24/7 POS Hotline"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 pt-2 border-t border-neutral-800/60">
                  <a
                    href={`tel:${SUPPORT_CONTACTS.phoneRaw}`}
                    className="flex-1 py-1 px-2 text-center text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
                  >
                    {t("dev_call_now")}
                  </a>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        SUPPORT_CONTACTS.phone,
                        "phone",
                        "Phone copied to clipboard!",
                      )
                    }
                    className="p-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border border-neutral-800 transition-colors cursor-pointer"
                    title="Copy Phone"
                  >
                    {copiedKey === "phone" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* WhatsApp Support */}
              <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                      {t("dev_whatsapp_support")}
                    </span>
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="font-mono text-xs font-bold text-neutral-100 pt-1">
                    {SUPPORT_CONTACTS.whatsapp}
                  </div>
                  <span className="text-[10px] text-neutral-400 block pt-0.5">
                    {isNepali
                      ? "च्याट तथा स्क्रिनसट"
                      : "Screenshots & Live Chat"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 pt-2 border-t border-neutral-800/60">
                  <button
                    type="button"
                    onClick={handleWhatsAppSupport}
                    className="flex-1 py-1 px-2 text-center text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
                  >
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        SUPPORT_CONTACTS.whatsapp,
                        "wa",
                        "WhatsApp copied to clipboard!",
                      )
                    }
                    className="p-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border border-neutral-800 transition-colors cursor-pointer"
                    title="Copy WhatsApp"
                  >
                    {copiedKey === "wa" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Email Support */}
              <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                      {t("dev_email_support")}
                    </span>
                    <Mail className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <div className="font-mono text-xs font-bold text-neutral-100 pt-1 truncate">
                    {SUPPORT_CONTACTS.email}
                  </div>
                  <span className="text-[10px] text-neutral-400 block pt-0.5">
                    {isNepali
                      ? "२ घण्टाभित्र प्रत्युत्तर"
                      : "Avg. response < 2 hrs"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 pt-2 border-t border-neutral-800/60">
                  <button
                    type="button"
                    onClick={handleEmailSupport}
                    className="flex-1 py-1 px-2 text-center text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors cursor-pointer truncate"
                  >
                    {t("dev_send_email")}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        SUPPORT_CONTACTS.email,
                        "email",
                        "Email copied to clipboard!",
                      )
                    }
                    className="p-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border border-neutral-800 transition-colors cursor-pointer"
                    title="Copy Email"
                  >
                    {copiedKey === "email" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Common Auth & Setup Troubleshooting Guides */}
            <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-200">
                <HelpCircle className="w-4 h-4 text-emerald-400" />
                <span>
                  {isNepali
                    ? "प्रायः आउने समस्याहरूको समाधान"
                    : "Common Setup & Login Solutions"}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800/80">
                  <div className="font-semibold text-neutral-200 text-[11px]">
                    {t("auth_help_faq_forgot")}
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-0.5 leading-relaxed">
                    {t("auth_help_faq_forgot_desc")}
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800/80">
                  <div className="font-semibold text-neutral-200 text-[11px]">
                    {t("auth_help_faq_setup")}
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-0.5 leading-relaxed">
                    {t("auth_help_faq_setup_desc")}
                  </p>
                </div>
              </div>
            </div>

            {/* System Diagnostics & Close Footer */}
            <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-neutral-500" />
                <div>
                  <span className="text-[11px] font-semibold text-neutral-300 block">
                    StockForge v0.1.0 · SQLite Engine
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    {isNepali
                      ? "सहायताका लागि प्रणाली विवरण क्लिपबोर्डमा कपी गर्नुहोस्"
                      : "Copy diagnostics payload to share with technician"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyDiagnostics}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-neutral-200 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                {copiedKey === "diagnostics" ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{t("dev_copy_diagnostics")}</span>
                  </>
                )}
              </button>
            </div>

            {/* Modal Bottom Action */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
              <span className="text-[10px] text-neutral-500">
                {t("dev_hours_val")}
              </span>
              <button
                type="button"
                onClick={() => setIsSupportModalOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer"
              >
                {t("action_close")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
