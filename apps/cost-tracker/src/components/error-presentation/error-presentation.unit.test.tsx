import { NextIntlClientProvider } from "@greendex/i18n/client";
import { ORPCError } from "@orpc/client";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { validFieldIssues } from "@/__tests__/field-issue-fixtures";
import {
  ErrorDetail,
  ErrorReason,
  FieldErrorMessage,
  ErrorPresentation,
} from "@/components/error-presentation/error-presentation";
import {
  createSafeFieldIssue,
  fieldIssueCatalog,
  hasComposedCopy,
  situationCatalog,
} from "@/lib/orpc/error-contract";
import { createSituationErrors } from "@/lib/orpc/errors";
import german from "@/messages/de/apiErrors.json";
import english from "@/messages/en/apiErrors.json";

const errors = createSituationErrors();
function present(
  content: ReactNode,
  locale = "en",
  messages: Record<string, unknown> = locale === "de" ? german : english,
) {
  return renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      onError={() => undefined}
    >
      {content}
    </NextIntlClientProvider>,
  );
}

describe("shared localized error presentation", () => {
  it.each(Object.entries(situationCatalog))(
    "renders canonical %s safely in English",
    (_name, situation) => {
      const error = new ORPCError(situation.code, {
        message: "private SQL token",
        data: { reason: situation.reason },
      });
      expect(present(<ErrorPresentation error={error} />)).toBe(
        hasComposedCopy(situation)
          ? "The resource state conflicts with this request. Reload and try again."
          : situation.reason === "INTERNAL_FAILURE"
            ? "The request could not be completed. Try again."
            : renderToStaticMarkup(<>{situation.message}</>),
      );
    },
  );

  it.each([
    [errors.setupLinkExpired(), "Dieser Einrichtungslink ist abgelaufen."],
    [errors.setupLinkUsed(), "Dieser Einrichtungslink wurde bereits verwendet."],
    [errors.setupLinkDisabled(), "Dieser Einrichtungslink ist deaktiviert."],
    [
      errors.unauthenticated(),
      "Deine Sitzung fehlt oder ist abgelaufen. Melde dich an, um fortzufahren.",
    ],
    [
      errors.internalFailure(),
      "Die Anfrage konnte nicht abgeschlossen werden. Versuche es erneut.",
    ],
    [
      new Error("private"),
      "Der Server oder das Netzwerk ist nicht erreichbar. Prüfe deine Verbindung und versuche es erneut.",
    ],
  ])("renders German refusals and safe overrides", (error, expected) => {
    expect(present(<ErrorPresentation error={error} />, "de")).toBe(expected);
  });

  const detailMatrix = [
    [
      "journeyDistanceOutsideBands",
      "Journey distance must have exactly one frozen funding band.",
      "Die Reiseentfernung muss genau einer festgeschriebenen Entfernungsstufe für die Förderung zugeordnet sein.",
    ],
    [
      "payoutAccountRequired",
      "Select a Partner Payout Account.",
      "Wähle einen Payout Account der Partnerorganisation aus.",
    ],
    [
      "entryRequired",
      "Add at least one Travel Cost Entry.",
      "Füge mindestens einen Reisekosteneintrag hinzu.",
    ],
    [
      "entryRequiredForCheck",
      "Add a Travel Cost Entry to check this requirement.",
      "Füge einen Reisekosteneintrag hinzu, um diese Anforderung zu prüfen.",
    ],
    [
      "participationOutsidePartnership",
      "Covered Participation must belong to this Project Partnership.",
      "Die berücksichtigte Projektteilnahme muss zu dieser Projektpartnerschaft gehören.",
    ],
    [
      "journeyRequired",
      "Add a Participant Journey.",
      "Füge eine Teilnehmendenreise hinzu.",
    ],
    [
      "journeyOriginRequired",
      "Enter a Journey origin.",
      "Gib den Startort der Reise ein.",
    ],
    [
      "journeyDestinationRequired",
      "Enter a Journey destination.",
      "Gib das Reiseziel ein.",
    ],
    [
      "journeyTripTypeRequired",
      "Select a Journey trip type.",
      "Wähle die Reiseart aus.",
    ],
    [
      "journeyDistanceRequired",
      "Enter a positive exact Erasmus distance.",
      "Gib eine positive, genaue Erasmus-Distanz ein.",
    ],
    [
      "transportProfileOutsideRules",
      "Transport choice is not in this Project's frozen rules; replace the entry.",
      "Das Verkehrsmittel gehört nicht zu den eingefrorenen Projektregeln. Ersetze den Eintrag.",
    ],
    [
      "entryAmountRequired",
      "Entry amount must be positive exact EUR.",
      "Der Eintragsbetrag muss ein positiver, genauer EUR-Betrag sein.",
    ],
    [
      "allocationRequired",
      "Allocate this entry to at least one Participation.",
      "Ordne diesen Eintrag mindestens einer Projektteilnahme zu.",
    ],
    [
      "allocationSharesInvalid",
      "Use positive exact shares of the chosen method that total the entry amount (or 100%).",
      "Verwende positive, genaue Anteile der gewählten Methode, die den Eintragsbetrag oder 100 % ergeben.",
    ],
    [
      "proofDocumentRequired",
      "Link a Proof Document belonging to this Claim.",
      "Verknüpfe einen zu diesem Claim gehörenden Nachweis.",
    ],
    [
      "fundingRulesRequired",
      "Project has no complete frozen funding rules; save a Participant Journey first.",
      "Das Projekt hat keine vollständigen eingefrorenen Förderregeln. Speichere zuerst eine Teilnehmendenreise.",
    ],
  ] as const;

  it("covers every field detail in the bilingual matrix", () => {
    expect(detailMatrix.map(([id]) => id).sort()).toEqual(
      Object.keys(fieldIssueCatalog).sort(),
    );
  });

  it.each(detailMatrix)(
    "renders %s details in English and German",
    (id, en, de) => {
      const issue = validFieldIssues.find((candidate) => candidate.id === id);
      expect(present(<ErrorDetail issue={issue} />)).toBe(
        renderToStaticMarkup(<>{en}</>),
      );
      expect(present(<ErrorDetail issue={issue} />, "de")).toBe(
        renderToStaticMarkup(<>{de}</>),
      );
    },
  );

  it("renders string field IDs without exposing unknown messages", () => {
    expect(
      present(<FieldErrorMessage message="journeyOriginRequired" />, "de"),
    ).toBe("Gib den Startort der Reise ein.");
    expect(
      present(<FieldErrorMessage message="journeyOriginRequired" />, "de", {
        apiErrors: {},
      }),
    ).toBe("Enter a Journey origin.");
    expect(present(<FieldErrorMessage message="vendor secret" />)).toBe(
      "The request could not be completed. Try again.",
    );
  });

  it("renders the complete checklist summary and localized corrections", () => {
    const error = errors.submissionIncomplete([
      createSafeFieldIssue("payoutAccountRequired", ["payoutAccount"]),
      createSafeFieldIssue("journeyOriginRequired", [
        "participations",
        "person",
        "journey",
        "origin",
      ]),
    ]);
    expect(present(<ErrorPresentation error={error} />, "de")).toBe(
      'Die Checkliste zur Einreichung des Claims ist unvollständig.<ul class="block"><li class="block">Wähle einen Payout Account der Partnerorganisation aus.</li><li class="block">Gib den Startort der Reise ein.</li></ul>',
    );
  });

  it("completes the Project refusal and escapes names as data", () => {
    const error = errors.projectCompletionBlocked([
      { name: "<Gruppe Süd>", status: "submitted" },
      { name: "Nord", status: null },
    ]);
    expect(present(<ErrorPresentation error={error} />, "de")).toBe(
      'Das Projekt kann noch nicht abgeschlossen werden. Prüfe die folgenden Projektpartnerschaften.<ul class="block"><li class="block">&lt;Gruppe Süd&gt; (Eingereicht)</li><li class="block">Nord (Kein Claim)</li></ul>',
    );
  });

  it.each([
    { reason: "UNKNOWN" },
    { reason: "SESSION_REQUIRED" },
    {
      reason: "CLAIM_SUBMISSION_INCOMPLETE",
      issues: [{ id: "unknown", path: ["entries"], message: "private" }],
    },
    {
      reason: "JOURNEY_DISTANCE_OUTSIDE_BANDS",
      issues: [createSafeFieldIssue("payoutAccountRequired", ["payoutAccount"])],
    },
    { reason: "CLAIM_SUBMISSION_INCOMPLETE", issues: [null] },
  ])("uses generic copy for invalid metadata %j", (data) => {
    expect(
      present(
        <ErrorPresentation
          error={new ORPCError("BAD_REQUEST", { message: "private", data })}
        />,
      ),
    ).toBe(
      "We could not complete that request. Check your details and try again.",
    );
  });

  it.each([
    undefined,
    [],
    [{ name: "Group", status: "unknown" }],
    [{ name: "Group", status: null, secret: "private" }],
  ])("never renders a completion prefix with invalid blockers %j", (blockers) => {
    expect(
      present(
        <ErrorPresentation
          error={
            new ORPCError("CONFLICT", {
              data: { reason: "PROJECT_COMPLETION_BLOCKED", blockers },
            })
          }
        />,
      ),
    ).toBe(
      "The resource state conflicts with this request. Reload and try again.",
    );
  });

  it.each(["Reworded diagnostic.", "private server failure"])(
    "ignores diagnostic prose in details and English fallback %s",
    (message) => {
      const issue = {
        id: "payoutAccountRequired",
        path: ["payoutAccount"],
        message,
      };
      expect(present(<ErrorDetail issue={issue} />, "de")).toBe(
        "Wähle einen Payout Account der Partnerorganisation aus.",
      );
      expect(
        present(<ErrorDetail issue={issue} />, "de", { apiErrors: {} }),
      ).toBe("Select a Partner Payout Account.");
      const error = new ORPCError("BAD_REQUEST", {
        data: { reason: "CLAIM_SUBMISSION_INCOMPLETE", issues: [issue] },
      });
      expect(present(<ErrorPresentation error={error} />, "de")).toBe(
        'Die Checkliste zur Einreichung des Claims ist unvollständig.<ul class="block"><li class="block">Wähle einen Payout Account der Partnerorganisation aus.</li></ul>',
      );
    },
  );

  it.each([
    [
      "SETUP_LINK_EXPIRED",
      "This setup link has expired.",
      "Dieser Einrichtungslink ist abgelaufen.",
    ],
    [
      "SETUP_LINK_USED",
      "This setup link has already been used.",
      "Dieser Einrichtungslink wurde bereits verwendet.",
    ],
    [
      "SETUP_LINK_DISABLED",
      "This setup link is disabled.",
      "Dieser Einrichtungslink ist deaktiviert.",
    ],
  ])(
    "renders validated setup-recovery reason %s in English and German",
    (reason, en, de) => {
      expect(present(<ErrorReason reason={reason} />)).toBe(en);
      expect(present(<ErrorReason reason={reason} />, "de")).toBe(de);
    },
  );

  it.each([["NOT_A_REAL_REASON"], [undefined], [null]])(
    "falls back to safe copy for malformed setup-recovery reason %j",
    (reason) => {
      expect(present(<ErrorReason reason={reason} />)).toBe(
        "The request could not be completed. Try again.",
      );
      expect(present(<ErrorReason reason={reason} />, "de")).toBe(
        "Die Anfrage konnte nicht abgeschlossen werden. Versuche es erneut.",
      );
    },
  );

  it("uses safe English when translations are missing or malformed", () => {
    const missing = { apiErrors: {} };
    expect(
      present(
        <ErrorPresentation error={errors.setupLinkExpired()} />,
        "de",
        missing,
      ),
    ).toBe("This setup link has expired.");
    expect(
      present(
        <ErrorPresentation error={errors.internalFailure()} />,
        "de",
        missing,
      ),
    ).toBe("The request could not be completed. Try again.");
    expect(
      present(<ErrorPresentation error={new Error("private")} />, "de", missing),
    ).toBe(
      "The server or network is unreachable. Check your connection and try again.",
    );
    expect(
      present(
        <ErrorDetail
          issue={createSafeFieldIssue("payoutAccountRequired", ["payoutAccount"])}
        />,
        "de",
        missing,
      ),
    ).toBe("Select a Partner Payout Account.");
    expect(
      present(<ErrorPresentation error={errors.setupLinkExpired()} />, "de", {
        apiErrors: { SETUP_LINK_EXPIRED: "Broken {missing}" },
      }),
    ).toBe("This setup link has expired.");
  });

  it("masks unsafe preview details and preserves valid HTTP upload refusals", () => {
    expect(
      present(
        <ErrorDetail
          issue={{
            id: "payoutAccountRequired",
            path: ["payoutAccount"],
            message: "private",
          }}
        />,
        "de",
      ),
    ).toBe("Wähle einen Payout Account der Partnerorganisation aus.");
    expect(
      present(
        <ErrorPresentation
          error={{
            code: "PAYLOAD_TOO_LARGE",
            reason: "PROOF_FILE_TOO_LARGE",
            error: "private",
          }}
          httpStatus={413}
        />,
      ),
    ).toBe("Choose a Proof Document no larger than 10 MB.");
    expect(
      present(
        <ErrorPresentation
          error={{ code: "PAYLOAD_TOO_LARGE", reason: "PROOF_FILE_TOO_LARGE" }}
          httpStatus={403}
        />,
      ),
    ).toBe("The request could not be completed. Try again.");
  });
});
