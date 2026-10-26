import { DEFAULT_LANGUAGE, LANGUAGE_CODES } from "@greendex/config/languages";
import { defineRouting, createNavigation } from "@greendex/i18n/server";

export const routing = defineRouting({
  // All supported locales
  locales: LANGUAGE_CODES,

  // Default locale when none is specified
  defaultLocale: DEFAULT_LANGUAGE,

  // Add locale prefix to all routes (e.g., /en/about, /de/about)
  localePrefix: "always",
});

// Lightweight wrappers around Next.js navigation APIs
// that will consider the routing configuration
export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);
