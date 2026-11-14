/**
 * Centralized i18n configuration
 * This file contains all internationalization-related settings
 */

/**
 * Supported languages configuration
 *
 * Every `code` is a full BCP-47 tag, because it is passed unchanged to `Intl` for
 * dates, numbers, and country names. A subtag-less code is not a neutral "international"
 * variant: `Intl` resolves bare `en` to US English, so the United Kingdom tag is required
 * for the British English this project writes. Slovenian likewise needs `sl`; `si` is
 * Sinhala in ISO 639-1.
 *
 * `countryCode` is the country whose variant and flag represent the language. It is not
 * an EU-membership claim.
 */
export const SUPPORTED_LANGUAGES = [
  {
    code: "en-GB",
    label: "English",
    displayRegion: "United Kingdom",
    countryCode: "GB",
  },
  {
    code: "de",
    label: "German",
    displayRegion: "Germany",
    countryCode: "DE", // Germany is an EUc member
  },
  {
    code: "es",
    label: "Spanish",
    displayRegion: "Spain",
    countryCode: "ES", // Spain is an EU member
  },
  {
    code: "it",
    label: "Italian",
    displayRegion: "Italy",
    countryCode: "IT", // Italy is an EU member
  },
  {
    code: "fr",
    label: "French",
    displayRegion: "France",
    countryCode: "FR", // France is an EU member
  },
  {
    code: "nl",
    label: "Dutch",
    displayRegion: "Netherlands",
    countryCode: "NL", // Netherlands is an EU member
  },
  {
    code: "sl",
    label: "Slovenian",
    displayRegion: "Slovenia",
    countryCode: "SI", // Slovenia is an EU member
  },
] as const;

/**
 * Array of supported language codes (derived constant, not a type)
 */
export const LANGUAGE_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);

/**
 * Default language code (derived constant, not a type)
 */
export const DEFAULT_LANGUAGE = LANGUAGE_CODES[0];
