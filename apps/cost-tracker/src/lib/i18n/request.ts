import { DEFAULT_LANGUAGE } from "@greendex/config/languages";
import { getRequestConfig } from "@greendex/i18n/server";

import { isSupportedLocale } from "@/lib/i18n/locales";

export default getRequestConfig(async ({ requestLocale }) => {
  // This typically corresponds to the `[locale]` segment
  let locale = (await requestLocale) ?? DEFAULT_LANGUAGE;

  // Ensure that the incoming locale is valid
  if (!isSupportedLocale(locale)) {
    locale = DEFAULT_LANGUAGE;
  }

  return {
    locale,
    messages: (await import(`@/messages/${locale}.json`)).default,
  };
});
