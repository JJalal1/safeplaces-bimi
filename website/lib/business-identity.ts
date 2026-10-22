import type {initialSettings, Lang} from './config';

type Settings = typeof initialSettings;
export const identifierDigits = (value: unknown) => String(value ?? '').trim().replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776));
export const validRegistration = (value: unknown) => /^\d{10}$/.test(identifierDigits(value));
export const validVatNumber = (value: unknown) => /^3\d{13}3$/.test(identifierDigits(value));

/** Legacy ten-digit tax references are drafts, never VAT registration numbers. */
export function normalizeBusinessSettings(settings: Settings): Settings {
 const next = {...settings, cr: identifierDigits(settings.cr), vatNumber: identifierDigits(settings.vatNumber)};
 if (/^\d{10}$/.test(next.vatNumber)) {
  next.taxReference = next.taxReference || next.vatNumber;
  next.vatNumber = '';
  next.vatRegistrationVerified = false;
 }
 return next;
}

export function businessSettingsError(settings: Settings): string | null {
 if (settings.cr && !validRegistration(settings.cr)) return 'INVALID_REGISTRATION_NUMBER';
 if (settings.vatNumber && !validVatNumber(settings.vatNumber)) return 'INVALID_VAT_NUMBER';
 if (settings.businessIdentityVerified && (!validRegistration(settings.cr) || !settings.nationalAddressAr.trim() || !settings.nationalAddressEn.trim())) return 'BUSINESS_IDENTITY_INCOMPLETE';
 if (settings.vatRegistrationVerified && (!settings.businessIdentityVerified || !validVatNumber(settings.vatNumber))) return 'VAT_VERIFICATION_REQUIRED';
 return null;
}

/** Syntax alone does not prove ownership: publication needs an explicit attestation. */
export function publishedBusinessIdentity(settings: Settings, lang: Lang) {
 if (!settings.businessIdentityVerified || !validRegistration(settings.cr) || !settings.nationalAddressAr.trim() || !settings.nationalAddressEn.trim()) return [];
 const ar = lang === 'ar';
 const rows = [{label: settings.cr.startsWith('7') ? (ar ? 'الرقم الوطني الموحد' : 'National unified number') : (ar ? 'السجل التجاري' : 'Commercial registration'), value: settings.cr},
  {label: ar ? 'العنوان الوطني' : 'National address', value: ar ? settings.nationalAddressAr : settings.nationalAddressEn}];
 if (settings.vatRegistrationVerified && validVatNumber(settings.vatNumber)) rows.push({label: ar ? 'رقم تسجيل ضريبة القيمة المضافة' : 'VAT registration number', value: settings.vatNumber});
 return rows;
}
