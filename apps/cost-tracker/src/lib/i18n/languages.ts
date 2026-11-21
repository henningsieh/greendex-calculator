import { SUPPORTED_LANGUAGES } from "@greendex/config/languages";
import * as Flags from "country-flag-icons/react/3x2";
import type { ComponentType, SVGProps } from "react";

import type { LanguageCode } from "@/lib/i18n/types";

type FlagComponent = ComponentType<SVGProps<SVGSVGElement>>;

const flagRegistry = Flags as Record<string, FlagComponent>;

/** Endonyms keep the picker legible in every locale without locale-dependent Intl output. */
const nativeNames: Record<LanguageCode, string> = {
  "en-GB": "English (UK)",
  de: "Deutsch",
  es: "Español",
  it: "Italiano",
  fr: "Français",
  nl: "Nederlands",
  sl: "Slovenščina",
};

export type LanguageOption = (typeof SUPPORTED_LANGUAGES)[number] & {
  nativeName: string;
  Flag?: FlagComponent;
};

/**
 * Picker metadata for every configured language. The language registry stays
 * the single source of truth for codes and flags; adding a code requires only
 * its endonym above, and the flag resolves from the shared flag set.
 */
export function getLanguageOptions(): LanguageOption[] {
  return SUPPORTED_LANGUAGES.map((language) => ({
    ...language,
    nativeName: nativeNames[language.code],
    Flag: flagRegistry[language.countryCode],
  }));
}
