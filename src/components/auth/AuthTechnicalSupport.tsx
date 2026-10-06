import React, { useState } from "react";
import {
  Mail,
  Phone,
  MessageCircle,
  HelpCircle,
  Copy,
  Check,
  Terminal,
} from "lucide-react";
import { SUPPORT_CONTACTS } from "@/src/constants/support.ts";
import { useAuth } from "@/src/context/AuthContext.tsx";
import { useLanguage } from "@/src/context/LanguageContext.tsx";
import { useTheme } from "@/src/context/ThemeContext.tsx";
import { useToast } from "@/src/context/ToastContext.tsx";
import { compileSystemDiagnostics } from "@/src/helpers/diagnosticHelpers.ts";

interface Props {
  onClose?: () => void;
}

export const AuthTechnicalSupport: React.FC<Props> = ({ onClose }) => {
  const { allShops } = useAuth();
  const { t, isNepali, language } = useLanguage();
  const { theme } = useTheme();
  const { showToast } = useToast();

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

  return (
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
              {isNepali ? "च्याट तथा स्क्रिनसट" : "Screenshots & Live Chat"}
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
              {isNepali ? "२ घण्टाभित्र प्रत्युत्तर" : "Avg. response < 2 hrs"}
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
          onClick={onClose}
          className="px-4 py-1.5 text-xs font-semibold text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer"
        >
          {t("action_close")}
        </button>
      </div>
    </div>
  );
};
