/** ISO 3166-1 alpha-2 country with its ISO 4217 currency. */
export type CountryOption = {
  code: string;
  name: string;
  currency: string;
};

export const DEFAULT_COUNTRY_CODE = 'AE';
export const DEFAULT_CURRENCY = 'AED';

/**
 * Common trading countries for a marble/stone ERP. Currency is the
 * domestic ISO 4217 code — display abbreviation only, not FX conversion.
 */
export const COUNTRIES: CountryOption[] = [
  { code: 'AF', name: 'Afghanistan', currency: 'AFN' },
  { code: 'DZ', name: 'Algeria', currency: 'DZD' },
  { code: 'AR', name: 'Argentina', currency: 'ARS' },
  { code: 'AU', name: 'Australia', currency: 'AUD' },
  { code: 'AT', name: 'Austria', currency: 'EUR' },
  { code: 'BH', name: 'Bahrain', currency: 'BHD' },
  { code: 'BD', name: 'Bangladesh', currency: 'BDT' },
  { code: 'BE', name: 'Belgium', currency: 'EUR' },
  { code: 'BR', name: 'Brazil', currency: 'BRL' },
  { code: 'BG', name: 'Bulgaria', currency: 'BGN' },
  { code: 'CA', name: 'Canada', currency: 'CAD' },
  { code: 'CL', name: 'Chile', currency: 'CLP' },
  { code: 'CN', name: 'China', currency: 'CNY' },
  { code: 'CO', name: 'Colombia', currency: 'COP' },
  { code: 'HR', name: 'Croatia', currency: 'EUR' },
  { code: 'CY', name: 'Cyprus', currency: 'EUR' },
  { code: 'CZ', name: 'Czechia', currency: 'CZK' },
  { code: 'DK', name: 'Denmark', currency: 'DKK' },
  { code: 'EG', name: 'Egypt', currency: 'EGP' },
  { code: 'EE', name: 'Estonia', currency: 'EUR' },
  { code: 'ET', name: 'Ethiopia', currency: 'ETB' },
  { code: 'FI', name: 'Finland', currency: 'EUR' },
  { code: 'FR', name: 'France', currency: 'EUR' },
  { code: 'DE', name: 'Germany', currency: 'EUR' },
  { code: 'GH', name: 'Ghana', currency: 'GHS' },
  { code: 'GR', name: 'Greece', currency: 'EUR' },
  { code: 'HK', name: 'Hong Kong', currency: 'HKD' },
  { code: 'HU', name: 'Hungary', currency: 'HUF' },
  { code: 'IN', name: 'India', currency: 'INR' },
  { code: 'ID', name: 'Indonesia', currency: 'IDR' },
  { code: 'IQ', name: 'Iraq', currency: 'IQD' },
  { code: 'IE', name: 'Ireland', currency: 'EUR' },
  { code: 'IT', name: 'Italy', currency: 'EUR' },
  { code: 'JP', name: 'Japan', currency: 'JPY' },
  { code: 'JO', name: 'Jordan', currency: 'JOD' },
  { code: 'KE', name: 'Kenya', currency: 'KES' },
  { code: 'KW', name: 'Kuwait', currency: 'KWD' },
  { code: 'LV', name: 'Latvia', currency: 'EUR' },
  { code: 'LB', name: 'Lebanon', currency: 'LBP' },
  { code: 'LY', name: 'Libya', currency: 'LYD' },
  { code: 'LT', name: 'Lithuania', currency: 'EUR' },
  { code: 'LU', name: 'Luxembourg', currency: 'EUR' },
  { code: 'MY', name: 'Malaysia', currency: 'MYR' },
  { code: 'MT', name: 'Malta', currency: 'EUR' },
  { code: 'MX', name: 'Mexico', currency: 'MXN' },
  { code: 'MA', name: 'Morocco', currency: 'MAD' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR' },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD' },
  { code: 'NG', name: 'Nigeria', currency: 'NGN' },
  { code: 'NO', name: 'Norway', currency: 'NOK' },
  { code: 'OM', name: 'Oman', currency: 'OMR' },
  { code: 'PK', name: 'Pakistan', currency: 'PKR' },
  { code: 'PS', name: 'Palestine', currency: 'ILS' },
  { code: 'PE', name: 'Peru', currency: 'PEN' },
  { code: 'PH', name: 'Philippines', currency: 'PHP' },
  { code: 'PL', name: 'Poland', currency: 'PLN' },
  { code: 'PT', name: 'Portugal', currency: 'EUR' },
  { code: 'QA', name: 'Qatar', currency: 'QAR' },
  { code: 'RO', name: 'Romania', currency: 'RON' },
  { code: 'RU', name: 'Russia', currency: 'RUB' },
  { code: 'SA', name: 'Saudi Arabia', currency: 'SAR' },
  { code: 'SG', name: 'Singapore', currency: 'SGD' },
  { code: 'SK', name: 'Slovakia', currency: 'EUR' },
  { code: 'SI', name: 'Slovenia', currency: 'EUR' },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR' },
  { code: 'KR', name: 'South Korea', currency: 'KRW' },
  { code: 'ES', name: 'Spain', currency: 'EUR' },
  { code: 'LK', name: 'Sri Lanka', currency: 'LKR' },
  { code: 'SE', name: 'Sweden', currency: 'SEK' },
  { code: 'CH', name: 'Switzerland', currency: 'CHF' },
  { code: 'TW', name: 'Taiwan', currency: 'TWD' },
  { code: 'TH', name: 'Thailand', currency: 'THB' },
  { code: 'TN', name: 'Tunisia', currency: 'TND' },
  { code: 'TR', name: 'Turkey', currency: 'TRY' },
  { code: 'UA', name: 'Ukraine', currency: 'UAH' },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
  { code: 'US', name: 'United States', currency: 'USD' },
  { code: 'VN', name: 'Vietnam', currency: 'VND' },
  { code: 'YE', name: 'Yemen', currency: 'YER' },
];

export const COUNTRY_BY_CODE: Record<string, CountryOption> = Object.fromEntries(
  COUNTRIES.map((country) => [country.code, country]),
);

export function normalizeCountryCode(
  code?: string | null,
): string | null {
  const normalized = code?.trim().toUpperCase() ?? '';
  return COUNTRY_BY_CODE[normalized] ? normalized : null;
}

export function isCountryCode(code: string): boolean {
  return Boolean(normalizeCountryCode(code));
}

export function currencyForCountry(code?: string | null): string {
  const country = normalizeCountryCode(code);
  if (country) return COUNTRY_BY_CODE[country].currency;
  return DEFAULT_CURRENCY;
}

export function countryName(code?: string | null): string {
  const country = normalizeCountryCode(code);
  return country ? COUNTRY_BY_CODE[country].name : '';
}

/** Company profile currency wins so a country change updates every surface. */
export function resolveDisplayCurrency(
  companyCurrency?: string | null,
  documentCurrency?: string | null,
): string {
  const company = companyCurrency?.trim().toUpperCase();
  if (company && company.length === 3) return company;
  const document = documentCurrency?.trim().toUpperCase();
  if (document && document.length === 3) return document;
  return DEFAULT_CURRENCY;
}
