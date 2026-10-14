/**
 * Centralized Contact Information for StockForge Desktop App
 * Reusable contact configuration for phone, WhatsApp, email, address, and developer info.
 */

export interface ContactInfo {
  name: string;
  nameNp: string;
  phone: {
    display: string;
    clean: string;
    national: string;
    telLink: string;
  };
  whatsapp: {
    number: string;
    display: string;
    defaultMessageEn: string;
    defaultMessageNp: string;
    getUrl: (customMessage?: string, isNepali?: boolean) => string;
  };
  email: {
    address: string;
    mailtoLink: string;
  };
  address: {
    street: string;
    city: string;
    district: string;
    country: string;
    displayEn: string;
    displayNp: string;
  };
  hours: {
    en: string;
    np: string;
  };
}

const WHATSAPP_RAW_NUMBER = "9779809167106";
const WHATSAPP_DEFAULT_MSG_EN =
  "Namaste! I would like to inquire about StockForge retail POS software, hardware setup, and technical support.";
const WHATSAPP_DEFAULT_MSG_NP =
  "नमस्ते! म StockForge अफलाइन रिटेल POS सफ्टवेयर, हार्डवेयर र प्राविधिक सहयोगबारे बुझ्न चाहन्छु।";

export const CONTACT_INFO: ContactInfo = {
  name: "Ayub Alam",
  nameNp: "अयुब आलम",
  phone: {
    display: "+977 9809167106",
    clean: "+9779809167106",
    national: "9809167106",
    telLink: "tel:+9779809167106",
  },
  whatsapp: {
    number: WHATSAPP_RAW_NUMBER,
    display: "+977 9809167106",
    defaultMessageEn: WHATSAPP_DEFAULT_MSG_EN,
    defaultMessageNp: WHATSAPP_DEFAULT_MSG_NP,
    getUrl: (customMessage?: string, isNepali = false): string => {
      const defaultMsg = isNepali ? WHATSAPP_DEFAULT_MSG_NP : WHATSAPP_DEFAULT_MSG_EN;
      const text = encodeURIComponent(customMessage || defaultMsg);
      return `https://wa.me/${WHATSAPP_RAW_NUMBER}?text=${text}`;
    },
  },
  email: {
    address: "imayubalam@gmail.com",
    mailtoLink: "mailto:imayubalam@gmail.com",
  },
  address: {
    street: "Main Road",
    city: "Birgunj",
    district: "Parsa",
    country: "Nepal",
    displayEn: "Birgunj, Parsa, Nepal",
    displayNp: "वीरगन्ज, पर्सा, नेपाल",
  },
  hours: {
    en: "7:00 AM – 10:00 PM NPT (7 days a week, 24/7 for POS emergencies)",
    np: "बिहान ७:०० देखि साँझ १०:०० सम्म (साताको ७ दिन, POS आपतकालीन २४/७)",
  },
};

export default CONTACT_INFO;

