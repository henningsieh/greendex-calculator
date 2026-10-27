import { NextIntlClientProvider } from "@greendex/i18n/client";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

import messages from "@/messages/en.json";

export function renderWithMessages(ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}
