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
import {
  Store,
  Mail,
  Lock,
  LogIn,
  Eye,
  EyeOff,
  HelpCircle,
} from "lucide-react";
import { useAuth } from "@/src/context/AuthContext.tsx";
import { useLanguage } from "@/src/context/LanguageContext.tsx";
import Input from "../common/Input";

interface Props {
  onSuccess?: () => void;
  onSupport?: () => void;
  onError: (error: string | null) => void;
}

export const LoginForm: React.FC<Props> = ({
  onSuccess,
  onSupport,
  onError,
}) => {
  const { login, allShops, switchShop } = useAuth();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Login form state
  const [loginData, setLoginData] = useState({
    emailOrPhone: "",
    password: "",
  });

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onError(null);

    if (!loginData.emailOrPhone.trim()) {
      onError(t("auth_err_email_phone_required"));
      return;
    }
    if (!loginData.password) {
      onError(t("auth_err_password_required"));
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
      onError((err as Error).message || "Login failed.");
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
      onError((err as Error).message || "Failed to select shop.");
    } finally {
      setLoading(false);
    }
  };

  return (
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
          onClick={() => onSupport?.()}
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
  );
};
