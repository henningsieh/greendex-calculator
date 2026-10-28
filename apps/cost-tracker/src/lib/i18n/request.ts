import { DEFAULT_LANGUAGE } from "@greendex/config/languages";
import { getRequestConfig } from "@greendex/i18n/server";

import { isSupportedLocale } from "@/lib/i18n/locales";
import type { LanguageCode } from "@/lib/i18n/types";
import type { Messages } from "@/messages/en";

const messageLoaders: Record<LanguageCode, () => Promise<{ default: Messages }>> =
  {
    de: () => import("@/messages/de"),
    en: () => import("@/messages/en"),
    es: () => import("@/messages/es"),
    fr: () => import("@/messages/fr"),
    it: () => import("@/messages/it"),
    nl: () => import("@/messages/nl"),
    si: () => import("@/messages/si"),
  };

export default getRequestConfig(async ({ requestLocale }) => {
  // This typically corresponds to the `[locale]` segment
  const locale = (await requestLocale) ?? DEFAULT_LANGUAGE;

  // Ensure that the incoming locale is valid
  const supportedLocale = isSupportedLocale(locale) ? locale : DEFAULT_LANGUAGE;

  const messages = (await messageLoaders[supportedLocale]()).default;

  return {
    locale: supportedLocale,
    messages,
  };
});
