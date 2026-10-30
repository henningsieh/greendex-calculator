import { NextIntlClientProvider } from "@greendex/i18n/client";
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

import { ClaimSubmission } from "@/features/claims/components/claim-submission";
import { createSafeFieldIssue } from "@/lib/orpc/error-contract";
import german from "@/messages/de";
import english from "@/messages/en";

vi.mock("@/lib/orpc/orpc", () => ({ orpc: { claims: { submit: vi.fn() } } }));

it.each([
  [
    "en",
    english,
    "Select a Partner Payout Account.",
    "Link a Proof Document belonging to this Claim.",
  ],
  [
    "de",
    german,
    "Wähle einen Payout Account der Partnerorganisation aus.",
    "Verknüpfe einen zu diesem Claim gehörenden Nachweis.",
  ],
] as const)(
  "renders actionable preview gaps in %s",
  (locale, messages, account, proof) => {
    const markup = renderToStaticMarkup(
      <NextIntlClientProvider locale={locale} messages={messages}>
        <ClaimSubmission
          partnershipId="partnership"
          refresh={async () => undefined}
          preview={{
            items: [
              {
                key: "payoutAccount",
                passed: false,
                gaps: [
                  createSafeFieldIssue("payoutAccountRequired", [
                    "payoutAccount",
                  ]),
                ],
              },
              {
                key: "proofDocuments",
                passed: false,
                gaps: [
                  createSafeFieldIssue("proofDocumentRequired", [
                    "entries",
                    "entry",
                    "proofDocuments",
                  ]),
                ],
              },
            ],
            calculatedPayableEur: null,
          }}
        />
      </NextIntlClientProvider>,
    );
    expect(markup).toContain(account);
    expect(markup).toContain(proof);
    expect(markup).toContain('href="#claim-payout"');
    expect(markup).toContain('href="#proof-entry"');
    const document = new DOMParser().parseFromString(markup, "text/html");
    expect(
      document
        .querySelector('[data-testid="claim-submit"]')
        ?.getAttribute("disabled"),
    ).toBe("");
  },
);

it.each([
  null,
  undefined,
  { id: "payoutAccountRequired", message: "Select a Partner Payout Account." },
  {
    id: "payoutAccountRequired",
    path: 1,
    message: "Select a Partner Payout Account.",
  },
  { id: "unknown", path: ["payoutAccount"], message: "private server failure" },
  {
    id: "payoutAccountRequired",
    path: ["payoutAccount"],
    message: "private server failure",
  },
])("renders malformed preview gap %j safely without navigation", (gap) => {
  const preview: ComponentProps<typeof ClaimSubmission>["preview"] = {
    items: [
      {
        key: "payoutAccount",
        passed: false,
        gaps: [createSafeFieldIssue("payoutAccountRequired", ["payoutAccount"])],
      },
    ],
    calculatedPayableEur: null,
  };
  Reflect.set(preview.items[0].gaps, 0, gap);
  const markup = renderToStaticMarkup(
    <NextIntlClientProvider locale="de" messages={german}>
      <ClaimSubmission
        partnershipId="partnership"
        refresh={async () => undefined}
        preview={preview}
      />
    </NextIntlClientProvider>,
  );
  const document = new DOMParser().parseFromString(markup, "text/html");
  expect(markup).toContain(
    "Die Anfrage konnte nicht abgeschlossen werden. Versuche es erneut.",
  );
  expect(markup).not.toContain("private server failure");
  expect(document.querySelector("a")).toBeNull();
  expect(
    document
      .querySelector('[data-testid="claim-submit"]')
      ?.getAttribute("disabled"),
  ).toBe("");
});
