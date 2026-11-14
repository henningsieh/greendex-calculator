import { LANGUAGE_CODES, SUPPORTED_LANGUAGES } from "@greendex/config/languages";
import * as Flags from "country-flag-icons/react/3x2";
import countries from "i18n-iso-countries";
import deCountries from "i18n-iso-countries/langs/de.json";
import enCountries from "i18n-iso-countries/langs/en.json";
import type { ComponentType, SVGProps } from "react";

import { LocaleData, type LanguageCode } from "@/lib/i18n/types";

// Load and register locale data for country names
countries.registerLocale(enCountries);
countries.registerLocale(deCountries);

const flagRegistry = Flags as Record<
  string,
  ComponentType<SVGProps<SVGSVGElement>>
>;

export const getLocaleData = (): LocaleData[] => {
  return SUPPORTED_LANGUAGES.map((locale) => {
    const countryCode = "countryCode" in locale ? locale.countryCode : undefined;

    let nativeName: string;
    let englishName: string;
    let Flag: ComponentType<SVGProps<SVGSVGElement>> | undefined;

    if (countryCode) {
      // Locale has a country code - use i18n-iso-countries for names
      nativeName =
        countries.getName(countryCode, locale.code, {
          select: "official",
        }) ?? locale.label;

      englishName =
        countries.getName(countryCode, "en", {
          select: "official",
        }) ?? locale.label;

      Flag = flagRegistry[countryCode];
    } else {
      // Locale without country code - use display region or label
      nativeName =
        (locale as { displayRegion?: string; label: string }).displayRegion ??
        locale.label;
      englishName =
        (locale as { displayRegion?: string; label: string }).displayRegion ??
        locale.label;
      Flag = undefined; // No flag for regionless locales
    }

    return {
      ...locale,
      nativeName,
      englishName,
      Flag,
    };
  });
};

export const isSupportedLocale = (
  value: string | undefined,
): value is LanguageCode =>
  !!value && LANGUAGE_CODES.includes(value as LanguageCode);
