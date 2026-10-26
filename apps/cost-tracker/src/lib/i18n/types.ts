import { SUPPORTED_LANGUAGES } from "@greendex/config/languages";

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type LanguageCode = SupportedLanguage["code"];
export type LocaleParams = { locale: string };
