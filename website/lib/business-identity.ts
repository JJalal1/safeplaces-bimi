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
 if (settings.businessIdentityVerified && (!validRegistration(settings.cr) || !settings.legalNameAr.trim() || !settings.legalNameEn.trim())) return 'BUSINESS_IDENTITY_INCOMPLETE';
 if (settings.nationalAddressVerified && (!settings.businessIdentityVerified || !settings.nationalAddressAr.trim() || !settings.nationalAddressEn.trim())) return 'NATIONAL_ADDRESS_INCOMPLETE';
 if (settings.vatRegistrationVerified && (!settings.businessIdentityVerified || !validVatNumber(settings.vatNumber))) return 'VAT_VERIFICATION_REQUIRED';
 return null;
}

/** Revoke only the attestations affected by a change, before one atomic save. */
export function prepareBusinessSettingsPatch(current: Settings, supplied: Record<string, unknown>) {
 const patch = {...supplied};
 for (const key of ['cr', 'vatNumber']) if (key in patch) patch[key] = identifierDigits(patch[key]);
 const changed = (keys: (keyof Settings)[]) => keys.some(key => key in patch && patch[key] !== current[key]);
 if (changed(['cr', 'legalNameAr', 'legalNameEn'])) {
  if (patch.businessIdentityVerified !== true) patch.businessIdentityVerified = false;
  if (patch.nationalAddressVerified !== true) patch.nationalAddressVerified = false;
  if (patch.vatRegistrationVerified !== true) patch.vatRegistrationVerified = false;
 }
 if (changed(['nationalAddressAr', 'nationalAddressEn']) && patch.nationalAddressVerified !== true) patch.nationalAddressVerified = false;
 if (changed(['vatNumber']) && patch.vatRegistrationVerified !== true) patch.vatRegistrationVerified = false;
 if (patch.businessIdentityVerified === false) {
  patch.nationalAddressVerified = false;
  patch.vatRegistrationVerified = false;
 }
 return patch;
}

/** Syntax alone does not prove ownership: publication needs an explicit attestation. */
export function publishedBusinessIdentity(settings: Settings, lang: Lang) {
 if (!settings.businessIdentityVerified || !validRegistration(settings.cr) || !settings.legalNameAr.trim() || !settings.legalNameEn.trim()) return [];
 const ar = lang === 'ar';
 const rows = [{label: settings.cr.startsWith('7') ? (ar ? 'الرقم الوطني الموحد' : 'National unified number') : (ar ? 'السجل التجاري' : 'Commercial registration'), value: settings.cr}];
 if (settings.nationalAddressVerified && settings.nationalAddressAr.trim() && settings.nationalAddressEn.trim()) rows.push({label: ar ? 'العنوان الوطني' : 'National address', value: ar ? settings.nationalAddressAr : settings.nationalAddressEn});
 if (settings.vatRegistrationVerified && validVatNumber(settings.vatNumber)) rows.push({label: ar ? 'رقم تسجيل ضريبة القيمة المضافة' : 'VAT registration number', value: settings.vatNumber});
 return rows;
}
