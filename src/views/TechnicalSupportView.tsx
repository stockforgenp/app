/**
 * Dedicated Technical Support & Developer Contact View
 * Complete standalone page accessible via the SYSTEM sidebar menu (/support)
 */
import React from "react";
import {
  Headphones,
  Phone,
  MessageCircle,
  Mail,
  HelpCircle,
  Printer,
  Database,
  ExternalLink,
  Laptop,
  CheckCircle2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { TechnicalSupportSection } from "../components/common/TechnicalSupportSection.tsx";
import { useLanguage } from "../context/LanguageContext.tsx";
import { useAuth } from "../context/AuthContext.tsx";
import { SUPPORT_CONTACTS } from "../constants/index.ts";

export const TechnicalSupportView: React.FC = () => {
  const { isNepali } = useLanguage();
  const { currentShop } = useAuth();

  const handleWhatsApp = () => {
    const shopName = currentShop ? currentShop.name : "StockForge Retail";
    const text = encodeURIComponent(
      `Namaste StockForge Support, I need assistance with our shop: ${shopName}.`,
    );
    window.open(
      `https://wa.me/${SUPPORT_CONTACTS.whatsappRaw}?text=${text}`,
      "_blank",
    );
  };

  const handleEmail = () => {
    const shopName = currentShop ? currentShop.name : "StockForge Retail";
    const subject = encodeURIComponent(
      `[StockForge Support] Support Request - ${shopName}`,
    );
    window.open(
      `mailto:${SUPPORT_CONTACTS.email}?subject=${subject}`,
      "_blank",
    );
  };

  const faqs = [
    {
      icon: Printer,
      title: isNepali
        ? "थर्मल बिल प्रिन्टर सेटअप र समस्या"
        : "Thermal Bill Printer Troubleshooting",
      desc: isNepali
        ? "५८mm वा ८०mm USB/LAN थर्मल प्रिन्टर जोड्दा प्रिन्ट नभएमा केबल जाँच्नुहोस्, रोलको दिशा मिलाउनुहोस् र ब्राउजर प्रिन्ट डायलगमा मार्जिन शून्य राख्नुहोस्।"
        : "Ensure your 58mm or 80mm ESC/POS printer is set as default in system settings. For clean receipt prints, set page margins to None/Minimum.",
    },
    {
      icon: Database,
      title: isNepali
        ? "अफलाइन डाटा र सुरक्षित ब्याकअप"
        : "Offline Data Storage & Backup Safety",
      desc: isNepali
        ? "तपाईंको सम्पूर्ण कारोबार कम्प्युटरमै SQLite डाटाबेसमा सुरक्षित रहन्छ। हप्ताको एकपटक सेटिङबाट .sqlite ब्याकअप फाइल सुरक्षित राख्न सिफारिस गरिन्छ।"
        : "All transactions and stock ledgers are committed locally with zero internet dependency. Always take a weekly .sqlite backup from Settings.",
    },
    {
      icon: Laptop,
      title: isNepali
        ? "रिमोट डेस्कटप सहायता (AnyDesk / TeamViewer)"
        : "Remote Desktop Assistance",
      desc: isNepali
        ? "जटिल प्राविधिक समस्या समाधानका लागि हाम्रा प्राविधिकहरूले AnyDesk वा TeamViewer मार्फत सिधै स्क्रिन हेरी समाधान गरिदिनेछन्।"
        : "For complex network, multi-counter, or printer driver issues, our team can connect remotely via AnyDesk or TeamViewer during support hours.",
    },
  ];

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-150">
      {/* Main Support Section with Live Diagnostics and Contact Grid */}
      <TechnicalSupportSection />

      {/* Knowledge Base & Common Troubleshooting FAQ Cards */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-100">
            <HelpCircle className="w-4 h-4 text-emerald-400" />
            <span>
              {isNepali
                ? "प्रायः सोधिने प्राविधिक प्रश्न तथा समाधानहरू"
                : "Quick Troubleshooting Guides & Hardware FAQs"}
            </span>
          </div>
          <Link
            to="/settings"
            className="text-xs text-neutral-400 hover:text-neutral-200 flex items-center gap-1 transition-colors"
          >
            <span>
              {isNepali
                ? "सिस्टम सेटिङ तथा ब्याकअप"
                : "System Settings & Backups"}
            </span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {faqs.map((faq, index) => {
            const Icon = faq.icon;
            return (
              <div
                key={index}
                className="p-4 rounded-xl bg-neutral-950 border border-neutral-800/80 space-y-2 hover:border-neutral-700 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-emerald-400 shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-neutral-100">
                    {faq.title}
                  </h3>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed pl-1">
                  {faq.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* SLA & Service Commitment Guarantee */}
      <div className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-neutral-200">
              {isNepali
                ? "स्थानीय व्यापार सहायता प्रतिबद्धता"
                : "Local Retail Continuity Commitment"}
            </div>
            <div className="text-[11px] text-neutral-500">
              {isNepali
                ? "तपाईंको काउन्टर कहिल्यै रोकिने छैन — आपतकालीन अवस्थामा तत्काल सहयोग प्रदान गरिनेछ।"
                : "Zero-interruption checkout guarantee — rapid assistance for critical counter disruptions."}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/settings"
            className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs border border-neutral-800 transition-colors"
          >
            {isNepali ? "डाटाबेस ब्याकअप हेर्नुहोस्" : "Database Backups"}
          </Link>
        </div>
      </div>
    </div>
  );
};
