/**
 * Authentication View: Shop Terminal Login
 * Features:
 * - Direct terminal login with email or phone + password
 * - Instant 1-click Demo Shop access
 * - Quick-select previously registered shops from SQLite
 * - Bilingual (English <-> Nepali) support with full dark/light theme awareness
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon, Languages, ShieldCheck, Headphones } from "lucide-react";
import { useLanguage } from "../context/LanguageContext.tsx";
import { useTheme } from "../context/ThemeContext.tsx";
import stockforgeLogo from "@/src-tauri/icons/icon.png";
import { Modal } from "../components/common/Modal.tsx";
import { AuthTechnicalSupport } from "../components/auth/AuthTechnicalSupport.tsx";
import { LoginForm } from "../components/forms/LoginForm.tsx";
import { SUPPORT_CONTACTS } from "../constants/support.ts";

interface AuthViewProps {
  onSuccess?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onSuccess }) => {
  const { t, isNepali, toggleLanguage } = useLanguage();
  const { isDark, toggleTheme } = useTheme();

  const [error, setError] = useState<string | null>(null);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  return (
    <div className="min-h-screen w-screen flex flex-col bg-neutral-950 text-neutral-100 font-sans selection:bg-emerald-500/30 overflow-y-auto">
      {/* Top Header bar */}
      <header className="h-14 px-6 border-b border-neutral-800/80 flex items-center justify-between shrink-0 bg-neutral-900/90 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-1 flex items-center justify-center shadow-xs">
            <img
              src={stockforgeLogo}
              alt="StockForge"
              className="w-full h-full object-contain"
            />
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
        <div className="w-full max-w-md transition-all duration-200">
          {/* Brand Card Title */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-neutral-900 border border-neutral-800 p-3 mx-auto mb-3.5 flex items-center justify-center shadow-lg">
              <img
                src={stockforgeLogo}
                alt="StockForge Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{t("auth_badge_offline")}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-100 tracking-tight">
              {t("auth_login_title")}
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1.5 max-w-sm mx-auto">
              {t("auth_login_desc")}
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 sm:p-8 relative overflow-hidden">
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

            {/* ================= LOGIN FORM ONLY ================= */}
            <LoginForm
              onSuccess={onSuccess}
              onSupport={() => setIsSupportModalOpen(true)}
              onError={(e) => setError(e)}
            />
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
                <span>
                  {t("auth_support_footer_line")} ({SUPPORT_CONTACTS.phone})
                </span>
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
          <AuthTechnicalSupport onClose={() => setIsSupportModalOpen(false)} />
        </Modal>
      )}
    </div>
  );
};
