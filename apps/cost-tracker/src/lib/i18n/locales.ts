import { LANGUAGE_CODES } from "@greendex/config/languages";

import type { LanguageCode } from "@/lib/i18n/types";

export const isSupportedLocale = (
  value: string | undefined,
): value is LanguageCode =>
  !!value && LANGUAGE_CODES.includes(value as LanguageCode);
