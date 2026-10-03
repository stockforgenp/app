/**
 * Authentication View: Shop Registration & Login
 * Features:
 * - Register shop with Name, Email, Phone, Shop Type, Address, Currency
 * - "Check for seed test data" to toggle between sample data vs. fresh blank ledger
 * - Login with email or phone + password
 * - Instant 1-click Demo Shop access
 * - Bilingual (English <-> Nepali) support
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store,
  Mail,
  Lock,
  Phone,
  MapPin,
  Tag,
  Coins,
  CheckCircle2,
  Database,
  ArrowRight,
  LogIn,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Languages,
  Sparkles,
  ShieldCheck,
  PackageOpen,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import { Select } from '../common/Select.tsx';

const SHOP_TYPES = [
  'Grocery & Supermarket',
  'Clothing & Apparel',
  'Electronics & Mobile',
  'Pharmacy & Healthcare',
  'Cafe, Bakery & Restaurant',
  'Hardware & Construction',
  'Stationery & Bookshop',
  'Cosmetics & Personal Care',
  'Departmental & Wholesale',
  'General Retail & Store',
  'Other',
];

interface AuthViewProps {
  onSuccess?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onSuccess }) => {
  const { login, register, loginDemoShop, allShops, switchShop, hasAnyShops } = useAuth();
  const { isNepali, toggleLanguage } = useLanguage();
  const { isDark, toggleTheme } = useTheme();

  const [mode, setMode] = useState<'register' | 'login'>(hasAnyShops ? 'login' : 'register');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Registration form state
  const [registerData, setRegisterData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    shop_type: 'Grocery & Supermarket',
    address: '',
    currency_symbol: isNepali ? 'रु.' : 'Rs.',
    seedTestData: true, // The requested check for seed test data
  });

  // Login form state
  const [loginData, setLoginData] = useState({
    emailOrPhone: '',
    password: '',
  });

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!registerData.name.trim()) {
      setError(isNepali ? 'कृपया पसलको नाम लेख्नुहोस्।' : 'Shop name is required.');
      return;
    }
    if (!registerData.email.trim() || !registerData.email.includes('@')) {
      setError(isNepali ? 'कृपया मान्य इमेल ठेगाना लेख्नुहोस्।' : 'A valid email address is required.');
      return;
    }
    if (registerData.password.length < 4) {
      setError(
        isNepali
          ? 'पासवर्ड कम्तीमा ४ अक्षरको हुनुपर्दछ।'
          : 'Password must be at least 4 characters long.'
      );
      return;
    }
    if (registerData.password !== registerData.confirmPassword) {
      setError(
        isNepali ? 'पासवर्ड र कन्फर्म पासवर्ड मिलेन।' : 'Passwords do not match.'
      );
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
        currency_symbol: registerData.currency_symbol || (isNepali ? 'रु.' : 'Rs.'),
        seedTestData: registerData.seedTestData,
      });
      onSuccess?.();
    } catch (err: unknown) {
      setError((err as Error).message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

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
            <span className="text-[10px] text-neutral-400 ml-2 font-mono hidden sm:inline">
              Offline Retail POS & ERP
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Language Toggle */}
          <button
            type="button"
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-neutral-300 hover:text-neutral-100 bg-neutral-950 hover:bg-neutral-800 rounded-lg transition-colors border border-neutral-800 cursor-pointer shadow-xs"
            title={isNepali ? 'Switch to English' : 'नेपाली भाषामा बदल्नुहोस्'}
          >
            <Languages className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-semibold text-emerald-400 font-mono">
              {isNepali ? 'नेपाली' : 'EN'}
            </span>
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors border border-neutral-800 cursor-pointer"
            title="Toggle theme"
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
        <div className="w-full max-w-xl">
          {/* Brand Card Title */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isNepali ? '१००% अफलाइन सुरक्षित SQLite भण्डारण' : '100% Offline Secure SQLite Engine'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-100 tracking-tight">
              {mode === 'register'
                ? isNepali
                  ? 'आफ्नो पसल दर्ता गर्नुहोस्'
                  : 'Register Your Retail Shop'
                : isNepali
                ? 'पसल खातामा लगइन गर्नुहोस्'
                : 'Log In to Your Shop'}
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1.5 max-w-md mx-auto">
              {mode === 'register'
                ? isNepali
                  ? 'पसलको नाम, ठेगाना, सम्पर्क तथा प्रारम्भिक मौज्दात सेटिङ सुरक्षित गर्नुहोस्'
                  : 'Set up your retail business profile, contact details, and initial inventory ledger.'
                : isNepali
                ? 'आफ्नो पसल व्यवस्थापन तथा POS काउन्टर खोल्न विवरण भर्नुहोस्'
                : 'Access your offline POS checkout counter, inventory ledger, and reports.'}
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-6 sm:p-8 relative overflow-hidden">
            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-neutral-950 border border-neutral-800/80 rounded-xl mb-6 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer ${
                  mode === 'register'
                    ? 'bg-neutral-800 text-emerald-400 shadow-sm font-bold border border-neutral-700/60'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>{isNepali ? 'पसल दर्ता (Register)' : 'Register Shop'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer ${
                  mode === 'login'
                    ? 'bg-neutral-800 text-emerald-400 shadow-sm font-bold border border-neutral-700/60'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{isNepali ? 'लगइन (Log In)' : 'Log In'}</span>
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

            {/* REGISTER FORM */}
            {mode === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                {/* Shop Name */}
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    {isNepali ? 'पसलको नाम (Shop Name) *' : 'Shop Name *'}
                  </label>
                  <div className="relative">
                    <Store className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder={isNepali ? 'उदा. काभ्या जनरल स्टोर' : 'e.g. StockForge Retail Mart'}
                      value={registerData.name}
                      onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-9.5 pr-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Email and Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">
                      {isNepali ? 'सञ्चालकको इमेल (Email) *' : 'Owner / Admin Email *'}
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        placeholder="owner@store.com"
                        value={registerData.email}
                        onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-9.5 pr-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">
                      {isNepali ? 'सम्पर्क फोन (Phone)' : 'Contact Phone'}
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        placeholder={isNepali ? '९८०१२३४५६७' : '+977 9801234567'}
                        value={registerData.phone}
                        onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-9.5 pr-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Shop Type and Currency */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <Select
                    label={isNepali ? 'पसलको प्रकार (Shop Type)' : 'Shop Category / Type'}
                    required
                    icon={Tag}
                    value={registerData.shop_type}
                    onChange={(e) => setRegisterData({ ...registerData, shop_type: e.target.value })}
                    options={SHOP_TYPES}
                  />

                  <Select
                    label={isNepali ? 'मुद्रा संकेत (Currency)' : 'Default Currency'}
                    icon={Coins}
                    value={registerData.currency_symbol}
                    onChange={(e) =>
                      setRegisterData({ ...registerData, currency_symbol: e.target.value })
                    }
                    options={[
                      { value: 'रु.', label: 'रु. (Nepali Rupee)' },
                      { value: 'Rs.', label: 'Rs. (Rupee)' },
                      { value: '$', label: '$ (USD)' },
                      { value: '€', label: '€ (Euro)' },
                      { value: '£', label: '£ (GBP)' },
                    ]}
                  />
                </div>

                {/* Shop Address */}
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    {isNepali ? 'पसलको ठेगाना (Store Address)' : 'Store Address (Prints on Bills)'}
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder={isNepali ? 'उदा. न्युरोड, काठमाडौं' : 'e.g. 45 Commercial Street, New Road'}
                      value={registerData.address}
                      onChange={(e) => setRegisterData({ ...registerData, address: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-9.5 pr-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Passwords */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">
                      {isNepali ? 'पासवर्ड (Password) *' : 'Password (min. 4 chars) *'}
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={registerData.password}
                        onChange={(e) =>
                          setRegisterData({ ...registerData, password: e.target.value })
                        }
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-9.5 pr-9 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 text-xs cursor-pointer"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">
                      {isNepali ? 'कन्फर्म पासवर्ड *' : 'Confirm Password *'}
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={registerData.confirmPassword}
                        onChange={(e) =>
                          setRegisterData({ ...registerData, confirmPassword: e.target.value })
                        }
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-9.5 pr-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* THE USER REQUESTED CHECKBOX: "while registering, keep a check for seed test data" */}
                <div className="pt-2">
                  <label
                    htmlFor="seed-test-data-check"
                    className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                      registerData.seedTestData
                        ? 'bg-emerald-500/5 border-emerald-500/40 ring-1 ring-emerald-500/20'
                        : 'bg-neutral-950/80 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <input
                      id="seed-test-data-check"
                      type="checkbox"
                      checked={registerData.seedTestData}
                      onChange={(e) =>
                        setRegisterData({ ...registerData, seedTestData: e.target.checked })
                      }
                      className="mt-0.5 rounded border-neutral-700 text-emerald-500 focus:ring-emerald-500/30 cursor-pointer w-4 h-4"
                    />
                    <div className="flex-1 text-xs">
                      <div className="font-semibold text-neutral-100 flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-emerald-400" />
                        <span>
                          {isNepali
                            ? 'परीक्षणको लागि नमूना सामान र कारोबार डाटा थप्नुहोस् (Seed Test Data)'
                            : 'Populate with sample inventory & transaction test data'}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                        {registerData.seedTestData
                          ? isNepali
                            ? '८ वटा नमूना सामान, मौज्दात स्टक, विगतका बिक्री कारोबार, खर्च र कर्मचारी रेकर्ड स्वतः तयार हुन्छन्। यदि नयाँ खाली पसल सुरु गर्न चाहनुहुन्छ भने यो हटाउनुहोस्।'
                            : 'Includes 8 starter grocery/snack products, opening stock movements, historical POS sales, shop expenses, and staff records. Perfect for immediate testing and demonstration.'
                          : isNepali
                          ? 'खाली क्याटलगबाट सुरु हुन्छ (० सामान, ० बिक्री)। तपाईं आफ्नो वास्तविक सामानहरू आफै थप्न सक्नुहुन्छ।'
                          : 'Starts with a 100% clean, blank catalog (0 products, 0 sales). Ready for real inventory entry.'}
                      </p>
                    </div>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-3 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
                >
                  {loading ? (
                    <span>{isNepali ? 'पसल सिर्जना हुँदैछ...' : 'Registering Shop & Setting Up Database...'}</span>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>{isNepali ? 'पसल दर्ता गरी POS सुरु गर्नुहोस्' : 'Register Shop & Launch POS'}</span>
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* LOGIN FORM */}
            {mode === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {/* Email or Phone */}
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    {isNepali ? 'इमेल वा फोन नम्बर *' : 'Registered Email or Phone *'}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="owner@store.com or 9801234567"
                      value={loginData.emailOrPhone}
                      onChange={(e) =>
                        setLoginData({ ...loginData, emailOrPhone: e.target.value })
                      }
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-9.5 pr-3 py-2.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    {isNepali ? 'पासवर्ड *' : 'Password *'}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={loginData.password}
                      onChange={(e) =>
                        setLoginData({ ...loginData, password: e.target.value })
                      }
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-9.5 pr-9 py-2.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 text-xs cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

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
                      {isNepali ? 'सिधै परीक्षण गर्न चाहनुहुन्छ?' : 'Want to explore with sample data instantly?'}
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
            )}

            {/* Bottom prompt */}
            <div className="mt-6 text-center text-xs text-neutral-400">
              {mode === 'register' ? (
                <span>
                  {isNepali ? 'पहिले नै पसल दर्ता भइसकेको छ? ' : 'Already registered your shop? '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                    }}
                    className="text-emerald-400 hover:text-emerald-300 font-bold underline underline-offset-2 ml-1 cursor-pointer"
                  >
                    {isNepali ? 'यहाँ लगइन गर्नुहोस्' : 'Log in here'}
                  </button>
                </span>
              ) : (
                <span>
                  {isNepali ? 'नयाँ पसल दर्ता गर्न चाहनुहुन्छ? ' : 'Need to set up a new retail shop? '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setError(null);
                    }}
                    className="text-emerald-400 hover:text-emerald-300 font-bold underline underline-offset-2 ml-1 cursor-pointer"
                  >
                    {isNepali ? 'यहाँ दर्ता गर्नुहोस्' : 'Register your shop'}
                  </button>
                </span>
              )}
            </div>
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
