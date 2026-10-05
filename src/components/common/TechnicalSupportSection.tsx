/**
 * Dedicated Developer & Company Technical Support Section
 * Provides direct contact channels, SLA/operating hours,
 * services covered, and live system diagnostics for fast troubleshooting.
 */
import React, { useState } from 'react';
import {
  Headphones,
  Mail,
  Phone,
  MessageCircle,
  Globe,
  MapPin,
  Clock,
  ShieldCheck,
  Copy,
  Check,
  ExternalLink,
  Printer,
  Database,
  Terminal,
  LifeBuoy,
  Send,
  Building2,
  Wrench,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { SUPPORT_CONTACTS } from '../../constants/index.ts';
import { compileSystemDiagnostics } from '../../helpers/index.ts';

interface TechnicalSupportSectionProps {
  id?: string;
  className?: string;
}

export const TechnicalSupportSection: React.FC<TechnicalSupportSectionProps> = ({
  id = 'developer-support',
  className = '',
}) => {
  const { t, isNepali, language } = useLanguage();
  const { theme } = useTheme();
  const { currentShop } = useAuth();
  const { showToast } = useToast();

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const supportContacts = {
    phonePrimary: SUPPORT_CONTACTS.phonePrimary,
    phoneSecondary: SUPPORT_CONTACTS.phoneSecondary,
    email: SUPPORT_CONTACTS.email,
    emailDev: SUPPORT_CONTACTS.emailDev,
    whatsapp: SUPPORT_CONTACTS.whatsapp,
    website: SUPPORT_CONTACTS.website,
    address: isNepali ? SUPPORT_CONTACTS.addressNe : SUPPORT_CONTACTS.addressEn,
    hours: isNepali ? SUPPORT_CONTACTS.hoursNe : SUPPORT_CONTACTS.hoursEn,
    companyName: isNepali ? SUPPORT_CONTACTS.companyNameNe : SUPPORT_CONTACTS.companyNameEn,
    teamName: isNepali ? SUPPORT_CONTACTS.teamNameNe : SUPPORT_CONTACTS.teamNameEn,
  };

  const handleCopy = (text: string, labelKey: string, message: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(labelKey);
    showToast(message, 'info');
    setTimeout(() => {
      setCopiedKey(null);
    }, 2500);
  };

  // Compile live diagnostic snapshot for support tickets
  const generateDiagnosticsText = () => {
    return compileSystemDiagnostics({
      language,
      theme,
      shop: currentShop,
    });
  };

  const handleCopyDiagnostics = () => {
    const diagStr = generateDiagnosticsText();
    handleCopy(
      diagStr,
      'diagnostics',
      t('dev_diagnostics_copied') || 'Diagnostic details copied to clipboard!'
    );
  };

  const handleEmailSupport = () => {
    const shopName = currentShop ? currentShop.name : 'StockForge Retail';
    const subject = encodeURIComponent(`[StockForge Support] Issue Report - ${shopName}`);
    const body = encodeURIComponent(
      `Hello StockForge Support Team,\n\nI need technical assistance with my retail setup.\n\nDescription of Issue:\n\n\n\n--- System Diagnostics ---\n${generateDiagnosticsText()}\n`
    );
    window.open(`mailto:${supportContacts.email}?subject=${subject}&body=${body}`, '_blank');
  };

  const handleWhatsAppSupport = () => {
    const shopName = currentShop ? currentShop.name : 'StockForge Retail';
    const text = encodeURIComponent(
      `Namaste StockForge Support, I need assistance with our shop: ${shopName}.`
    );
    window.open(`https://wa.me/${supportContacts.whatsapp.replace(/\D/g, '')}?text=${text}`, '_blank');
  };

  return (
    <div
      id={id}
      className={`bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-6 scroll-mt-20 ${className}`}
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-neutral-800 gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0">
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-neutral-100">
                {t('dev_support_section_title')}
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold inline-flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Verified Support</span>
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              {t('dev_support_section_subtitle')}
            </p>
          </div>
        </div>

        {/* Quick Emergency Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleWhatsAppSupport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors cursor-pointer"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>{t('dev_chat_whatsapp')}</span>
          </button>
          <button
            type="button"
            onClick={handleEmailSupport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-200 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700/80 rounded-lg transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{t('dev_send_email')}</span>
          </button>
        </div>
      </div>

      {/* Company / Developer Identity Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-neutral-950 via-neutral-950/80 to-emerald-950/20 border border-neutral-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-neutral-100 uppercase tracking-wide">
              {supportContacts.companyName}
            </span>
          </div>
          <p className="text-xs text-neutral-400 font-medium">
            {supportContacts.teamName} · StockForge Desktop Suite
          </p>
          <div className="flex items-center gap-2 text-[11px] text-neutral-500 pt-0.5">
            <span className="font-mono text-emerald-400 font-semibold">v0.1.0 Offline Core</span>
            <span>•</span>
            <span>Local SQLite Engine</span>
            <span>•</span>
            <span>App ID: com.stockforge.dev</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <a
            href={supportContacts.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white transition-colors cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-neutral-400" />
            <span>{t('dev_open_portal')}</span>
            <ExternalLink className="w-3 h-3 text-neutral-500" />
          </a>
        </div>
      </div>

      {/* 4 Dedicated Support Channel Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Phone / Hotline */}
        <div className="p-4 bg-neutral-950 border border-neutral-800/80 rounded-xl space-y-3 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                {t('dev_call_support')}
              </span>
              <Phone className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="font-mono text-xs font-bold text-neutral-100 pt-1">
              {supportContacts.phonePrimary}
            </div>
            <div className="font-mono text-[11px] text-neutral-400">
              {supportContacts.phoneSecondary} (Office)
            </div>
            <p className="text-[10px] text-emerald-400/90 font-medium pt-1">
              {isNepali ? 'आपतकालीन काउन्टर सपोर्ट' : 'Emergency POS On-Call'}
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-neutral-800/60">
            <a
              href={`tel:${supportContacts.phonePrimary}`}
              className="flex-1 py-1.5 px-2 text-center text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
            >
              {t('dev_call_now')}
            </a>
            <button
              type="button"
              onClick={() =>
                handleCopy(supportContacts.phonePrimary, 'phone', 'Phone number copied to clipboard!')
              }
              className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800 transition-colors cursor-pointer"
              title="Copy Phone Number"
            >
              {copiedKey === 'phone' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Email Support */}
        <div className="p-4 bg-neutral-950 border border-neutral-800/80 rounded-xl space-y-3 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                {t('dev_email_support')}
              </span>
              <Mail className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="font-mono text-xs font-bold text-neutral-100 pt-1 truncate">
              {supportContacts.email}
            </div>
            <div className="font-mono text-[11px] text-neutral-400 truncate">
              {supportContacts.emailDev}
            </div>
            <p className="text-[10px] text-neutral-400 pt-1">
              {isNepali ? '२ घण्टाभित्र प्रत्युत्तर' : 'Avg. response < 2 hrs'}
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-neutral-800/60">
            <button
              type="button"
              onClick={handleEmailSupport}
              className="flex-1 py-1.5 px-2 text-center text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors cursor-pointer"
            >
              {t('dev_send_email')}
            </button>
            <button
              type="button"
              onClick={() =>
                handleCopy(supportContacts.email, 'email', 'Email address copied to clipboard!')
              }
              className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800 transition-colors cursor-pointer"
              title="Copy Email Address"
            >
              {copiedKey === 'email' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* WhatsApp & Viber */}
        <div className="p-4 bg-neutral-950 border border-neutral-800/80 rounded-xl space-y-3 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                {t('dev_whatsapp_support')}
              </span>
              <MessageCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="font-mono text-xs font-bold text-neutral-100 pt-1">
              {supportContacts.whatsapp}
            </div>
            <p className="text-[11px] text-neutral-400">
              {isNepali ? 'फोटो, स्क्रिनसट र च्याट' : 'Screenshots & Chat'}
            </p>
            <p className="text-[10px] text-neutral-400 pt-1">
              {isNepali ? 'द्रुत सहायता तथा प्रत्यक्ष सम्पर्क' : 'Instant live messenger'}
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-neutral-800/60">
            <button
              type="button"
              onClick={handleWhatsAppSupport}
              className="flex-1 py-1.5 px-2 text-center text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
            >
              WhatsApp
            </button>
            <button
              type="button"
              onClick={() =>
                handleCopy(supportContacts.whatsapp, 'whatsapp', 'WhatsApp number copied to clipboard!')
              }
              className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800 transition-colors cursor-pointer"
              title="Copy WhatsApp Number"
            >
              {copiedKey === 'whatsapp' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Office & Operating Hours */}
        <div className="p-4 bg-neutral-950 border border-neutral-800/80 rounded-xl space-y-3 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                {t('dev_hours_label')}
              </span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xs font-bold text-neutral-200 pt-1">
              Sun – Fri: 9 AM – 6 PM
            </div>
            <div className="text-[11px] text-emerald-400 font-mono">
              24/7 Critical Hotfix
            </div>
            <div className="flex items-start gap-1 pt-1 text-[10px] text-neutral-400">
              <MapPin className="w-3 h-3 text-neutral-500 shrink-0 mt-0.5" />
              <span className="truncate">{supportContacts.address}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-neutral-800/60">
            <button
              type="button"
              onClick={() =>
                handleCopy(supportContacts.address, 'address', 'Office address copied to clipboard!')
              }
              className="w-full py-1.5 px-2 text-center text-xs font-medium text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              {copiedKey === 'address' ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>Copied Address</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy Address</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Scope of Technical Support Services */}
      <div className="p-4 bg-neutral-950/60 border border-neutral-800/80 rounded-xl space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-neutral-200">
          <Wrench className="w-4 h-4 text-emerald-400" />
          <span>{t('dev_services_title')}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800/60 flex items-start gap-2.5">
            <Printer className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-neutral-200 block text-[11px]">
                {t('dev_service_printer')}
              </span>
              <span className="text-[10px] text-neutral-500">ESC/POS 58mm & 80mm</span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800/60 flex items-start gap-2.5">
            <Database className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-neutral-200 block text-[11px]">
                {t('dev_service_database')}
              </span>
              <span className="text-[10px] text-neutral-500">Atomic WAL backups & repairs</span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800/60 flex items-start gap-2.5">
            <Terminal className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-neutral-200 block text-[11px]">
                {t('dev_service_hardware')}
              </span>
              <span className="text-[10px] text-neutral-500">USB / Bluetooth barcode readers</span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800/60 flex items-start gap-2.5">
            <LifeBuoy className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-neutral-200 block text-[11px]">
                {t('dev_service_custom')}
              </span>
              <span className="text-[10px] text-neutral-500">Custom formats & invoice rules</span>
            </div>
          </div>
        </div>
      </div>

      {/* Live System Diagnostics Tool for Support */}
      <div className="p-4 bg-neutral-950 border border-neutral-800/80 rounded-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-neutral-800/60">
          <div>
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-neutral-400" />
              <span className="text-xs font-bold text-neutral-100">
                {t('dev_diagnostics_title')}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              {t('dev_diagnostics_desc')}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyDiagnostics}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/80 rounded-lg transition-colors cursor-pointer"
            >
              {copiedKey === 'diagnostics' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{t('dev_copy_diagnostics')}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Diagnostics Summary Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-[11px] font-mono">
          <div className="p-2 rounded bg-neutral-900/80 border border-neutral-800">
            <span className="text-[9px] text-neutral-500 uppercase block">App Build</span>
            <span className="text-neutral-200 font-semibold truncate block">v0.1.0</span>
          </div>

          <div className="p-2 rounded bg-neutral-900/80 border border-neutral-800">
            <span className="text-[9px] text-neutral-500 uppercase block">Engine</span>
            <span className="text-emerald-400 font-semibold truncate block">SQLite WASM</span>
          </div>

          <div className="p-2 rounded bg-neutral-900/80 border border-neutral-800">
            <span className="text-[9px] text-neutral-500 uppercase block">Active Shop</span>
            <span className="text-neutral-200 font-semibold truncate block">
              {currentShop ? currentShop.name : 'Unregistered'}
            </span>
          </div>

          <div className="p-2 rounded bg-neutral-900/80 border border-neutral-800">
            <span className="text-[9px] text-neutral-500 uppercase block">Shop ID</span>
            <span className="text-neutral-300 font-semibold truncate block">
              {currentShop ? `#${currentShop.id}` : 'None'}
            </span>
          </div>

          <div className="p-2 rounded bg-neutral-900/80 border border-neutral-800">
            <span className="text-[9px] text-neutral-500 uppercase block">Theme / Lang</span>
            <span className="text-neutral-300 font-semibold truncate block">
              {theme} / {language.toUpperCase()}
            </span>
          </div>

          <div className="p-2 rounded bg-neutral-900/80 border border-neutral-800">
            <span className="text-[9px] text-neutral-500 uppercase block">Mode</span>
            <span className="text-emerald-400 font-semibold truncate block">100% Offline</span>
          </div>
        </div>

        <p className="text-[10px] text-neutral-500 italic">
          {t('dev_quick_support_hint')}
        </p>
      </div>
    </div>
  );
};
