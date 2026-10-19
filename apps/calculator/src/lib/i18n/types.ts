import { SUPPORTED_LANGUAGES } from "@greendex/config/languages";
import { ComponentType, SVGProps } from "react";

/**
 * Type definitions derived from supported languages
 * These are app-specific types, not shared across packages
 */
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type LanguageCode = SupportedLanguage["code"];

export type LocaleParams = { locale: string };

export type LocaleData = SupportedLanguage & {
  nativeName: string;
  englishName: string;
  Flag?: ComponentType<SVGProps<SVGSVGElement>>;
};
