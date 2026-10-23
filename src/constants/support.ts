import { CONTACT_INFO } from "./contactInfo.ts";

export interface SupportContactInfo {
  developerName: string;
  developerNameNp: string;
  developerNameNe: string;
  companyNameEn: string;
  companyNameNp: string;
  companyNameNe: string;
  teamNameEn: string;
  teamNameNp: string;
  teamNameNe: string;
  phone: string;
  phoneRaw: string;
  phonePrimary: string;
  phoneSecondary: string;
  email: string;
  emailDev: string;
  whatsapp: string;
  whatsappRaw: string;
  website: string;
  addressEn: string;
  addressNp: string;
  addressNe: string;
  hoursEn: string;
  hoursNp: string;
  hoursNe: string;
  emergencySla: string;
}

export const SUPPORT_CONTACTS: SupportContactInfo = {
  developerName: CONTACT_INFO.name,
  developerNameNp: CONTACT_INFO.nameNp,
  developerNameNe: CONTACT_INFO.nameNp,
  companyNameEn: "StockForge Technologies Pvt. Ltd.",
  companyNameNp: "स्टकफोर्ज टेक्नोलोजिज प्रा. लि.",
  companyNameNe: "स्टकफोर्ज टेक्नोलोजिज प्रा. लि.",
  teamNameEn: "Core Engineering & Technical Support Team",
  teamNameNp: "मूल इन्जिनियरिङ तथा प्राविधिक सहयोग टोली",
  teamNameNe: "मूल इन्जिनियरिङ तथा प्राविधिक सहयोग टोली",
  phone: CONTACT_INFO.phone.display,
  phoneRaw: CONTACT_INFO.phone.clean,
  phonePrimary: CONTACT_INFO.phone.display,
  phoneSecondary: CONTACT_INFO.phone.display,
  email: CONTACT_INFO.email.address,
  emailDev: CONTACT_INFO.email.address,
  whatsapp: CONTACT_INFO.whatsapp.display,
  whatsappRaw: CONTACT_INFO.whatsapp.number,
  website: "https://stockforge.dev",
  addressEn: CONTACT_INFO.address.displayEn,
  addressNp: CONTACT_INFO.address.displayNp,
  addressNe: CONTACT_INFO.address.displayNp,
  hoursEn: CONTACT_INFO.hours.en,
  hoursNp: CONTACT_INFO.hours.np,
  hoursNe: CONTACT_INFO.hours.np,
  emergencySla: "< 2 Hours",
};

export const APP_VERSION = "0.1.0";
export const APP_IDENTIFIER = "com.stockforge.dev";
export const APP_ENGINE = "SQLite 3 WASM (Local-First Offline)";
