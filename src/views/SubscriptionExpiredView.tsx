/**
 * Subscription Expired View
 * Displayed when an authenticated shop's subscription period has ended.
 * Reassures the user that their local offline SQLite database is 100% safe,
 * presents subscription metadata, and offers one-click support channels to renew.
 */
import React, { useState } from 'react';
import {
  AlertTriangle,
  ShieldCheck,
  PhoneCall,
  MessageCircle,
  Mail,
  RefreshCw,
  LogOut,
  Copy,
  Check,
  Calendar,
  Clock,
  Store,
  Layers,
  Headphones,
  Moon,
  Sun,
  Languages,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { SUPPORT_CONTACTS, APP_VERSION } from '../constants/support.ts';
import stockforgeLogo from '@/src-tauri/icons/icon.png';

export const SubscriptionExpiredView: React.FC = () => {
  const { currentShop, refreshShops, logout } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const { showToast } = useToast();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const isNp = language === 'np';

  const copyToClipboard = async (text: string, label: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      showToast(`${label} copied to clipboard`, 'success');
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      showToast(`Failed to copy ${label}`, 'error');
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      refreshShops();
      showToast(
        isNp
          ? 'सदस्यता स्थिति पुनः जाँच गरियो।'
          : 'Subscription status rechecked from database.',
        'info'
      );
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  const handleWhatsApp = () => {
    const shopName = currentShop?.name || 'StockForge Store';
    const shopId = currentShop?.id ? `ID #${currentShop.id}` : '';
    const message = encodeURIComponent(
      `Namaste StockForge Support Team,\n\nOur shop subscription for "${shopName}" (${shopId}) has expired.\nWe would like to renew our subscription plan. Please provide payment and renewal instructions.\n\nThank you!`
    );
    window.open(`https://wa.me/${SUPPORT_CONTACTS.whatsappRaw}?text=${message}`, '_blank');
  };

  const handleEmail = () => {
    const shopName = currentShop?.name || 'StockForge Store';
    const shopId = currentShop?.id ? `ID #${currentShop.id}` : '';
    const subject = encodeURIComponent(`[StockForge Renewal] Subscription Renewal for ${shopName}`);
    const body = encodeURIComponent(
      `Hello StockForge Support,\n\nOur subscription for "${shopName}" (${shopId}) has expired.\n\nShop Name: ${shopName}\nShop Email: ${currentShop?.email || '-'}\nShop Phone: ${currentShop?.phone || '-'}\nExpiry Date: ${currentShop?.subscription_expiry_date || '-'}\n\nPlease help us renew our account.\n\nBest regards,\n${shopName}`
    );
    window.open(`mailto:${SUPPORT_CONTACTS.email}?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <div className="min-h-screen w-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between selection:bg-amber-500/30 overflow-y-auto">
      {/* Top Navbar */}
      <header className="border-b border-neutral-800/80 bg-neutral-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 p-1.5 flex items-center justify-center shadow-md">
            <img
              src={stockforgeLogo}
              alt="StockForge"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-neutral-100">
                StockForge
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-neutral-800 text-neutral-400">
                v{APP_VERSION}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">
              {isNp
                ? 'अफलाइन इन्भेन्टरी व्यवस्थापन'
                : 'Offline Retail & Inventory Management'}
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          {/* Language Toggle */}
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-neutral-800 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 transition-colors cursor-pointer"
            title="Switch Language"
          >
            <Languages className="w-3.5 h-3.5 text-neutral-400" />
            <span>{isNp ? 'English' : 'नेपाली'}</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg border border-neutral-800 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 transition-colors cursor-pointer"
            title={isDark ? 'Light Mode' : 'Dark Mode'}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Logout / Switch Shop */}
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-neutral-800 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-rose-400 transition-colors cursor-pointer"
            title="Log Out / Switch Account"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {isNp ? 'पसल परिवर्तन / बाहिरिनुहोस्' : 'Switch Store / Log Out'}
            </span>
          </button>
        </div>
      </header>

      {/* Main Expired Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-8 flex flex-col justify-center gap-6">
        {/* Banner Card */}
        <div className="bg-gradient-to-b from-amber-950/30 via-neutral-900/60 to-neutral-900/90 border border-amber-500/30 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400 shadow-inner">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-400 mb-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                {isNp ? 'सदस्यता समाप्त भयो' : 'Subscription Expired'}
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-neutral-100 tracking-tight">
                {isNp
                  ? 'तपाईंको स्टकफोर्ज सदस्यता समाप्त भएको छ'
                  : 'Your StockForge Plan Has Expired'}
              </h1>
            </div>
          </div>

          <p className="text-sm text-neutral-300 leading-relaxed max-w-2xl">
            {isNp
              ? `पसल "${currentShop?.name || 'StockForge'}" को सक्रिय योजनाको समयावधि पूरा भएको छ। सफ्टवेयर सुचारु राख्न कृपया नवीकरण गर्नुहोस् वा प्राविधिक सहयोग टोलीलाई सम्पर्क गर्नुहोस्।`
              : `The subscription license for "${currentShop?.name || 'StockForge'}" has reached its expiration date. To renew your plan and continue using StockForge for billing and stock management, please contact our support team.`}
          </p>

          {/* Safety Reassurance Card */}
          <div className="mt-5 p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-start gap-3">
            <div className="p-1 rounded-md bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wide">
                {isNp ? 'तपाईंको डाटा १००% सुरक्षित छ' : 'Your Local SQLite Data is 100% Safe'}
              </h3>
              <p className="text-xs text-neutral-300 mt-0.5 leading-relaxed">
                {isNp
                  ? 'चिन्ता नगर्नुहोस्! तपाईंको सबै मौज्दात, खाता, ग्राहक विवरण, र बिक्री रसिदहरू तपाईंको कम्प्युटरको लोकल SQLite डाटाबेसमा सुरक्षित छन्। कुनै पनि डाटा मेटिएको वा नष्ट भएको छैन।'
                  : 'Rest assured: All your inventory records, transaction ledgers, vendor accounts, and invoices remain completely safe on your local offline SQLite storage. Nothing is deleted or modified.'}
              </p>
            </div>
          </div>
        </div>

        {/* Subscription Metadata & Shop Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Shop Details */}
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              <Store className="w-4 h-4 text-emerald-400" />
              <span>{isNp ? 'पसल विवरण' : 'Shop Information'}</span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-neutral-800/60">
                <span className="text-neutral-400">{isNp ? 'पसलको नाम' : 'Shop Name'}:</span>
                <span className="font-semibold text-neutral-200">{currentShop?.name || '-'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800/60">
                <span className="text-neutral-400">{isNp ? 'इमेल' : 'Email'}:</span>
                <span className="font-mono text-neutral-300">{currentShop?.email || '-'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800/60">
                <span className="text-neutral-400">{isNp ? 'फोन' : 'Phone'}:</span>
                <span className="font-mono text-neutral-300">{currentShop?.phone || '-'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-neutral-400">{isNp ? 'पसल प्रकार' : 'Type'}:</span>
                <span className="capitalize text-neutral-300">{currentShop?.shop_type || 'Retail'}</span>
              </div>
            </div>
          </div>

          {/* Subscription Expiry Details */}
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>{isNp ? 'सदस्यता विवरण' : 'Subscription Details'}</span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-neutral-800/60">
                <span className="text-neutral-400">{isNp ? 'योजना' : 'Plan'}:</span>
                <span className="font-semibold text-amber-400">
                  {currentShop?.subscription_plan || 'Standard'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800/60">
                <span className="text-neutral-400">{isNp ? 'शुरु भएको मिति' : 'Subscribed Date'}:</span>
                <span className="font-mono text-neutral-300">
                  {currentShop?.subscribed_date || '-'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800/60">
                <span className="text-neutral-400">{isNp ? 'अवधि' : 'Duration'}:</span>
                <span className="text-neutral-300">
                  {currentShop?.subscription_duration_days || 365} {isNp ? 'दिन' : 'Days'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-neutral-400">{isNp ? 'म्याद सकिएको मिति' : 'Expiry Date'}:</span>
                <span className="font-mono font-bold text-rose-400">
                  {currentShop?.subscription_expiry_date || 'Expired'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Support Renewal Section */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Headphones className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-neutral-100">
                  {isNp ? 'नवीकरण तथा सहायता सम्पर्क' : 'Contact Support For Instant Renewal'}
                </h2>
                <p className="text-xs text-neutral-400">
                  {isNp
                    ? 'हाम्रो टोलीले तत्काल तपाईंको सदस्यता नवीकरण गरी सफ्टवेयर सक्रिय गरिदिनेछ।'
                    : 'Our technical support team will instantly process your renewal and unlock your system.'}
                </p>
              </div>
            </div>

            <div className="text-xs text-neutral-500 flex items-center gap-1 font-mono">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              <span>SLA: {SUPPORT_CONTACTS.emergencySla}</span>
            </div>
          </div>

          {/* Quick Actions (WhatsApp, Call, Email) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* WhatsApp */}
            <button
              onClick={handleWhatsApp}
              className="flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-600/15 border border-emerald-500/30 hover:bg-emerald-600/25 text-emerald-400 hover:text-emerald-300 font-semibold text-xs transition-colors cursor-pointer group shadow-sm"
            >
              <MessageCircle className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>WhatsApp Support</span>
            </button>

            {/* Direct Phone Call */}
            <a
              href={`tel:${SUPPORT_CONTACTS.phoneRaw}`}
              className="flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-sky-600/15 border border-sky-500/30 hover:bg-sky-600/25 text-sky-400 hover:text-sky-300 font-semibold text-xs transition-colors cursor-pointer group shadow-sm"
            >
              <PhoneCall className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
              <span>{SUPPORT_CONTACTS.phone}</span>
            </a>

            {/* Email */}
            <button
              onClick={handleEmail}
              className="flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-violet-600/15 border border-violet-500/30 hover:bg-violet-600/25 text-violet-400 hover:text-violet-300 font-semibold text-xs transition-colors cursor-pointer group shadow-sm"
            >
              <Mail className="w-4 h-4 text-violet-400 group-hover:scale-110 transition-transform" />
              <span>Email Support</span>
            </button>
          </div>

          {/* Contact Details Copy Row */}
          <div className="flex flex-wrap items-center justify-between text-xs text-neutral-400 bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-3 gap-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-neutral-300">Email:</span>
              <span className="font-mono text-neutral-300">{SUPPORT_CONTACTS.email}</span>
              <button
                onClick={() => copyToClipboard(SUPPORT_CONTACTS.email, 'Email', 'email')}
                className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
                title="Copy Email"
              >
                {copiedKey === 'email' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-neutral-300">Hotline:</span>
              <span className="font-mono text-neutral-300">{SUPPORT_CONTACTS.phone}</span>
              <button
                onClick={() => copyToClipboard(SUPPORT_CONTACTS.phone, 'Phone number', 'phone')}
                className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
                title="Copy Phone"
              >
                {copiedKey === 'phone' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <div className="text-[11px] text-neutral-500">
              {isNp ? SUPPORT_CONTACTS.hoursNp : SUPPORT_CONTACTS.hoursEn}
            </div>
          </div>
        </div>

        {/* Primary Action Buttons (Check Renewal / Switch Store) */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 shadow-md"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>
              {isNp ? 'नवीकरण स्थिति जाँच गर्नुहोस्' : 'Recheck Subscription Status'}
            </span>
          </button>

          <button
            onClick={logout}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 font-semibold text-xs transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>{isNp ? 'अन्य पसलमा लगइन गर्नुहोस्' : 'Switch Store / Log In to Another Account'}</span>
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-800/80 bg-neutral-900/40 px-6 py-3 text-center text-[11px] text-neutral-500 font-mono">
        {SUPPORT_CONTACTS.companyNameEn} · Putalisadak, Kathmandu, Nepal · Local SQLite Data Secure
      </footer>
    </div>
  );
};
