import { DEFAULT_LANGUAGE } from "@greendex/config/languages";
import { getRequestConfig } from "@greendex/i18n/server";

import { isSupportedLocale } from "@/lib/i18n/locales";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = (await requestLocale) ?? DEFAULT_LANGUAGE;

  if (!isSupportedLocale(locale)) {
    locale = DEFAULT_LANGUAGE;
  }

  const [messages, apiErrors] = await Promise.all([
    import(`@/messages/${locale}.json`),
    import(`@/messages/api-errors/${locale}.json`),
  ]);

  return {
    locale,
    messages: { ...messages.default, apiErrors: apiErrors.default },
  };
});
