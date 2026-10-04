/**
 * Authentication View: Shop Terminal Login
 * Features:
 * - Direct login with email or phone + password
 * - Instant 1-click Demo Shop access
 * - Quick-select previously registered shops from SQLite
 * - Bilingual (English <-> Nepali) support
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store,
  Mail,
  Lock,
  LogIn,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Languages,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import { Input } from '../common/Input.tsx';

interface AuthViewProps {
  onSuccess?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onSuccess }) => {
  const { login, loginDemoShop, allShops, switchShop } = useAuth();
  const { isNepali, toggleLanguage } = useLanguage();
  const { isDark, toggleTheme } = useTheme();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Login form state
  const [loginData, setLoginData] = useState({
    emailOrPhone: '',
    password: '',
  });

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!loginData.emailOrPhone.trim()) {
      setError(
        isNepali
          ? 'कृपया इमेल वा फोन नम्बर लेख्नुहोस्।'
          : 'Please enter your email or phone number.'
      );
      return;
    }
    if (!loginData.password) {
      setError(isNepali ? 'कृपया पासवर्ड लेख्नुहोस्।' : 'Please enter your password.');
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
      setError((err as Error).message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginDemoShop();
      onSuccess?.();
    } catch (err: unknown) {
      setError((err as Error).message || 'Demo login failed.');
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
      setError((err as Error).message || 'Failed to select shop.');
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
            <span>{isNepali ? 'नेपाली' : 'English'}</span>
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
        <div className="w-full max-w-md">
          {/* Brand Card Title */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isNepali ? '१००% अफलाइन सुरक्षित SQLite भण्डारण' : '100% Offline Secure SQLite Engine'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-100 tracking-tight">
              {isNepali ? 'पसल खातामा लगइन गर्नुहोस्' : 'Log In to Your Shop'}
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1.5 max-w-sm mx-auto">
              {isNepali
                ? 'आफ्नो पसल व्यवस्थापन तथा POS काउन्टर खोल्न विवरण भर्नुहोस्'
                : 'Access your offline POS checkout counter, inventory ledger, and reports.'}
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-6 sm:p-8 relative overflow-hidden">
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

            {/* LOGIN FORM */}
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {/* Email or Phone */}
              <Input
                label={isNepali ? 'इमेल वा फोन नम्बर *' : 'Registered Email or Phone *'}
                icon={Mail}
                type="text"
                required
                placeholder="owner@store.com or 9801234567"
                value={loginData.emailOrPhone}
                onChange={(e) =>
                  setLoginData({ ...loginData, emailOrPhone: e.target.value })
                }
              />

              {/* Password */}
              <Input
                label={isNepali ? 'पासवर्ड *' : 'Password *'}
                icon={Lock}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-neutral-500 hover:text-neutral-300 text-xs cursor-pointer flex items-center"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                }
                type={showPassword ? 'text' : 'password'}
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
                  <span>{isNepali ? 'प्रमाणीकरण हुँदैछ...' : 'Logging In...'}</span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>{isNepali ? 'पसल खातामा लगइन गर्नुहोस्' : 'Log In to Shop Terminal'}</span>
                  </>
                )}
              </button>

              {/* Quick 1-Click Demo Shop Option */}
              <div className="pt-3 border-t border-neutral-800/80">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] text-neutral-400">
                    {isNepali ? 'सिधै परीक्षण गर्न चाहनुहुन्छ?' : 'Want to explore instantly?'}
                  </div>
                  <button
                    type="button"
                    onClick={handleQuickDemoLogin}
                    disabled={loading}
                    className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-emerald-400 font-semibold text-xs border border-neutral-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isNepali ? 'डेमो पसल खोल्नुहोस्' : '1-Click Demo Shop'}</span>
                  </button>
                </div>
              </div>

              {/* Previously Registered Shops in SQLite */}
              {allShops.length > 0 && (
                <div className="pt-4 border-t border-neutral-800/80">
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-2">
                    {isNepali ? 'पहिले दर्ता भएका पसलहरू:' : 'Registered Shops in Local Database:'}
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
          </div>

          {/* Footer note */}
          <div className="text-center mt-6 text-[11px] text-neutral-500 space-y-1">
            <p>
              StockForge Offline POS · SQLite ACID Transaction Engine
            </p>
            <p className="text-[10px]">
              {isNepali
                ? 'सम्पूर्ण डाटा तपाईंको आफ्नै कम्प्युटरमा स्थानीय रूपमा सुरक्षित रहन्छ।'
                : 'All credentials, inventory, and sales ledger are stored locally on your device.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
