import { createMiddleware } from "@greendex/i18n/server";
import { NextRequest, type NextResponse } from "next/server";

import { isSupportedLocale } from "@/lib/i18n/locales";
import { routing } from "@/lib/i18n/routing";

const nextIntlMiddleware = createMiddleware(routing);

export function proxy(request: NextRequest): NextResponse {
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
