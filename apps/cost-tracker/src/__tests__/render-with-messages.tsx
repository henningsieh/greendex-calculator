import { NextIntlClientProvider } from "@greendex/i18n/client";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement } from "react";

import german from "@/messages/de";
import messages from "@/messages/en-GB";
import slovenian from "@/messages/sl";

export function renderWithMessages(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper"> & {
    locale?: "en-GB" | "de" | "sl";
  },
) {
  const { locale = "en-GB", ...renderOptions } = options ?? {};
  return render(ui, {
    ...renderOptions,
    wrapper: ({ children }) => (
      <NextIntlClientProvider
        locale={locale}
        messages={
          locale === "de" ? german : locale === "sl" ? slovenian : messages
        }
      >
        {children}
      </NextIntlClientProvider>
    ),
  });
}
