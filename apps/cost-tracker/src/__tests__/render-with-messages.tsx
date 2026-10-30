import { NextIntlClientProvider } from "@greendex/i18n/client";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement } from "react";

import german from "@/messages/de";
import messages from "@/messages/en";

export function renderWithMessages(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper"> & { locale?: "en" | "de" },
) {
  const { locale = "en", ...renderOptions } = options ?? {};
  return render(ui, {
    ...renderOptions,
    wrapper: ({ children }) => (
      <NextIntlClientProvider
        locale={locale}
        messages={locale === "de" ? german : messages}
      >
        {children}
      </NextIntlClientProvider>
    ),
  });
}
