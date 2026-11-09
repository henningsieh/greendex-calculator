import { createMiddleware } from "@greendex/i18n/server";
import { NextRequest, NextResponse } from "next/server";

import { isSupportedLocale } from "@/lib/i18n/locales";
import { routing } from "@/lib/i18n/routing";

const nextIntlMiddleware = createMiddleware(routing);

/**
 * First path segment of every route that renders without a session.
 *
 * The list is deliberately explicit: a new protected route is gated by
 * default, and a new public route has to be added here on purpose.
 */
const PUBLIC_SEGMENTS = new Set([
  "",
  "accept-invitation",
  "design-system",
  "login",
  "participant",
  "participant-invitations",
  "participant-links",
  "register",
  "setup-links",
]);

/**
 * Better Auth's session cookie under its default prefix, which gains
 * `__Secure-` when the cookie is served over HTTPS.
 */
const SESSION_COOKIES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
] as const;

/** The route segment after an optional locale prefix. */
function routeSegment(pathname: string): string {
  const [first = "", second = ""] = pathname.split("/").filter(Boolean);
  return isSupportedLocale(first) ? second : first;
}

/**
 * Optimistic gate for anonymous requests, per the Next.js authentication
 * guide: this reads cookie presence only and never touches the database, so it
 * stays cheap on every prefetch. `ProtectedShell` keeps the authoritative
 * `getSession()` check, which also catches an expired session whose cookie is
 * still present.
 *
 * Without this gate the shell streams first and redirects from the client, so
 * an anonymous visitor receives a 200 plus the whole App Shell before landing
 * on `/login`.
 */
export function proxy(request: NextRequest): NextResponse {
  const anonymous = !SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (anonymous && !PUBLIC_SEGMENTS.has(routeSegment(request.nextUrl.pathname)))
    return NextResponse.redirect(new URL("/login", request.url));

  const response = nextIntlMiddleware(request);
  const location = response.headers.get("location");
  const locale = request.nextUrl.pathname.split("/")[1];

  // Keep legacy unprefixed links, auth callbacks and bookmarked URLs unchanged.
  // Run the localized request through next-intl to retain its locale header,
  // detection and cookie behavior, but rewrite rather than redirect the browser.
  if (location && !isSupportedLocale(locale)) {
    const localizedResponse = nextIntlMiddleware(
      new NextRequest(location, request),
    );
    localizedResponse.headers.set("x-middleware-rewrite", location);
    return localizedResponse;
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)", "/accept-invitation/:path*"],
};
