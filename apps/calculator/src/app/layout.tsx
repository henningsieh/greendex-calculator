import "./globals.css"; // Global CSS import
import "@/lib/orpc/client.server"; // Initialize server-side oRPC client for pre-rendering
import {
  ANDROID_PACKAGE,
  APP_NAME,
  BASE_URL,
  DESCRIPTION,
  FACEBOOK_APP_ID,
  IOS_APP_STORE_ID,
  KEYWORDS,
  LOGO_PATH,
  TITLE,
} from "@greendex/config/metadata";
import type { Metadata } from "next";

import { JsonLd } from "@/components/json-ld";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  metadataBase: new URL(BASE_URL),
  title: TITLE,
  description: DESCRIPTION,
  keywords: KEYWORDS,
  authors: [
    {
      name: APP_NAME,
      url: BASE_URL,
    },
  ],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: BASE_URL,
    siteName: APP_NAME,
    type: "website",
    images: [LOGO_PATH],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [LOGO_PATH],
  },
  facebook:
    FACEBOOK_APP_ID && FACEBOOK_APP_ID.length > 0
      ? { appId: FACEBOOK_APP_ID }
      : undefined,
  appLinks: {
    ios:
      !!IOS_APP_STORE_ID &&
      (typeof IOS_APP_STORE_ID === "number" ||
        (typeof IOS_APP_STORE_ID === "string" && IOS_APP_STORE_ID.length > 0))
        ? {
            url: BASE_URL,
            app_name: APP_NAME,
            app_store_id: IOS_APP_STORE_ID,
          }
        : undefined,
    android:
      ANDROID_PACKAGE && ANDROID_PACKAGE.length > 0
        ? {
            url: BASE_URL,
            app_name: APP_NAME,
            package: ANDROID_PACKAGE,
          }
        : undefined,
  },
  icons: {
    icon: [
      { url: "/favicon/favicon.ico", sizes: "any" },
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/favicon/apple-touch-icon.png",
  },
  manifest: "/favicon/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning>
      <body className="antialiased">
        <JsonLd />
        {children}
      </body>
    </html>
  );
}
