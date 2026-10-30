import { NextIntlClientProvider } from "@greendex/i18n/client";
import { ORPCError } from "@orpc/client";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { validFieldIssues } from "@/__tests__/field-issue-fixtures";
import {
  ErrorDetail,
  ErrorPresentation,
} from "@/components/error-presentation/error-presentation";
import {
  createSafeFieldIssue,
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

  it.each(validFieldIssues)(
    "renders the closed $id detail without remote prose",
    (issue) => {
      expect(present(<ErrorDetail issue={issue} />)).toBe(
        renderToStaticMarkup(<>{issue.message}</>),
      );
    },
  );

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
      issues: [{ id: "entryRequired", path: ["entries"], message: "private" }],
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
    ).toBe("Die Anfrage konnte nicht abgeschlossen werden. Versuche es erneut.");
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
