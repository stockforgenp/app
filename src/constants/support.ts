/**
 * Technical Support & Company Constants
 * Centralized developer hotline, emails, WhatsApp, and operating hours.
 */

export interface SupportContactInfo {
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
  companyNameEn: 'StockForge Technologies Pvt. Ltd.',
  companyNameNp: 'स्टकफोर्ज टेक्नोलोजिज प्रा. लि.',
  companyNameNe: 'स्टकफोर्ज टेक्नोलोजिज प्रा. लि.',
  teamNameEn: 'Core Engineering & Technical Support Team',
  teamNameNp: 'मूल इन्जिनियरिङ तथा प्राविधिक सहयोग टोली',
  teamNameNe: 'मूल इन्जिनियरिङ तथा प्राविधिक सहयोग टोली',
  phone: '+977 980-1234567',
  phoneRaw: '+9779801234567',
  phonePrimary: '+977 980-1234567',
  phoneSecondary: '+977 1-4567890',
  email: 'support@stockforge.dev',
  emailDev: 'developer@stockforge.dev',
  whatsapp: '+977 980-1234567',
  whatsappRaw: '9779801234567',
  website: 'https://stockforge.dev',
  addressEn: 'Putalisadak, Kathmandu, Bagmati Province, Nepal',
  addressNp: 'पुतलीसडक, काठमाडौँ, बागमती प्रदेश, नेपाल',
  addressNe: 'पुतलीसडक, काठमाडौँ, बागमती प्रदेश, नेपाल',
  hoursEn: 'Sun – Fri: 9:00 AM – 6:00 PM NPT (24/7 for POS emergencies)',
  hoursNp: 'आइतबार – शुक्रबार: बिहान ९:०० – साँझ ६:०० (POS आपतकालीन २४/७)',
  hoursNe: 'आइतबार – शुक्रबार: बिहान ९:०० – साँझ ६:०० (POS आपतकालीन २४/७)',
  emergencySla: '< 2 Hours',
};

export const APP_VERSION = '0.1.0';
export const APP_IDENTIFIER = 'com.stockforge.dev';
export const APP_ENGINE = 'SQLite 3 WASM (Local-First Offline)';
