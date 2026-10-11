import "@/lib/orpc/client.server";
import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";

import { NuqsProvider } from "@/components/nuqs-provider";
import { QueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  applicationName: "Cost Tracker",
  title: {
    default: "Cost Tracker",
    template: "%s | Cost Tracker",
  },
  description:
    "Organize Project travel costs, Proof Documents, and Cost Allocations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("font-sans antialiased", fontMono.variable, geist.variable)}
    >
      <body>
        <Toaster>
          <ThemeProvider>
            <NuqsProvider>
              <QueryProvider>{children}</QueryProvider>
            </NuqsProvider>
          </ThemeProvider>
        </Toaster>
      </body>
    </html>
  );
}
