import type { LANGUAGE_CODES } from "@greendex/config/languages";

import type { AppRoutes } from "#next-routes/routes";

// Mirrors apps/calculator/src/app/routes.ts: Next's generated route union with
// the dynamic locale segment resolved to the configured language codes.
type LanguageCode = (typeof LANGUAGE_CODES)[number];

type StripLocale<T> = T extends `/${string}/${infer Rest}`
  ? `/${Rest}`
  : T extends "/[locale]"
    ? "/"
    : T;

// `[param]` / `[[...param]]` become string, so concrete links type-check.
type WithParams<T extends string> =
  T extends `${infer Head}[${string}]${infer Tail}`
    ? `${Head}${string}${WithParams<Tail>}`
    : T;

/** The route as the app links to it (the proxy adds the locale). */
type UnprefixedRoute = WithParams<StripLocale<AppRoutes>>;

/** The same route with one of the configured language codes prefixed. */
type PrefixedRoute<T extends string = UnprefixedRoute> = T extends string
  ? `/${LanguageCode}${T}`
  : never;

export type AppRoute = UnprefixedRoute | PrefixedRoute;

/** A route target, optionally carrying a query string or a hash. */
export type AppHref =
  | AppRoute
  | `${AppRoute}?${string}`
  | `${AppRoute}#${string}`;
