import { NextIntlClientProvider } from "@greendex/i18n/client";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement } from "react";

import messages from "@/messages/en";

export function renderWithMessages(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, {
    ...options,
    wrapper: ({ children }) => (
      <NextIntlClientProvider locale="en" messages={messages}>
        {children}
      </NextIntlClientProvider>
    ),
  });
}
