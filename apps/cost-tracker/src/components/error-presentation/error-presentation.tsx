"use client";

import { useTranslations } from "@greendex/i18n/client";

import {
  ErrorReasonSchema,
  FieldIssueIdSchema,
  hasComposedCopy,
  SafeFieldIssueSchema,
  situationCatalog,
} from "@/lib/orpc/error-contract";
import {
  getHTTPErrorPresentation,
  getORPCErrorPresentation,
} from "@/lib/orpc/error-message";
import english from "@/messages/en/apiErrors.json";

type Translator = ReturnType<typeof useTranslations<"apiErrors">>;

function translate(
  t: Translator,
  key: Parameters<Translator>[0],
  fallback: string,
) {
  if (!t.has(key)) return fallback;
  try {
    const text = t(key);
    return text === key || text === `apiErrors.${key}` ? fallback : text;
  } catch {
    return fallback;
  }
}

export function ErrorDetail({ issue }: { issue: unknown }) {
  const t = useTranslations("apiErrors");
  const parsed = SafeFieldIssueSchema.safeParse(issue);
  if (!parsed.success)
    return (
      <>
        {translate(
          t,
          "fallback.internalFailure",
          english.apiErrors.fallback.internalFailure,
        )}
      </>
    );
  return (
    <>
      {translate(
        t,
        `details.${parsed.data.id}`,
        english.apiErrors.details[parsed.data.id],
      )}
    </>
  );
}

export function FieldErrorMessage({ message }: { message: unknown }) {
  const t = useTranslations("apiErrors");
  const id = FieldIssueIdSchema.safeParse(message);
  if (!id.success)
    return (
      <>
        {translate(
          t,
          "fallback.internalFailure",
          english.apiErrors.fallback.internalFailure,
        )}
      </>
    );
  return (
    <>{translate(t, `details.${id.data}`, english.apiErrors.details[id.data])}</>
  );
}

export function ErrorReason({ reason }: { reason: unknown }) {
  const t = useTranslations("apiErrors");
  const parsed = ErrorReasonSchema.safeParse(reason);
  const situation = parsed.success
    ? Object.values(situationCatalog).find(
        (entry) => entry.reason === parsed.data,
      )
    : undefined;
  if (
    !parsed.success ||
    !situation ||
    situation.reason === "INTERNAL_FAILURE" ||
    hasComposedCopy(situation)
  )
    return (
      <>
        {translate(
          t,
          "fallback.internalFailure",
          english.apiErrors.fallback.internalFailure,
        )}
      </>
    );
  return <>{translate(t, parsed.data, english.apiErrors[parsed.data])}</>;
}

export function ErrorPresentation({
  error,
  httpStatus,
}: {
  error: unknown;
  httpStatus?: number;
}) {
  const t = useTranslations("apiErrors");
  const presentation =
    httpStatus === undefined
      ? getORPCErrorPresentation(error)
      : getHTTPErrorPresentation(error, httpStatus);

  if (presentation.blockers?.length) {
    return (
      <>
        {translate(t, "completion.summary", english.apiErrors.completion.summary)}
        <ul className="block">
          {presentation.blockers.map((blocker, index) => {
            const status = blocker.status ?? "none";
            return (
              <li className="block" key={`${blocker.name}-${index}`}>
                {blocker.name} (
                {translate(
                  t,
                  `completion.status.${status}`,
                  english.apiErrors.completion.status[status],
                )}
                )
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  return (
    <>
      {translate(t, presentation.key, presentation.text)}
      {presentation.issues?.length ? (
        <ul className="block">
          {presentation.issues.map((issue, index) => (
            <li
              className="block"
              key={`${issue.id}-${issue.path.join(".")}-${index}`}
            >
              <ErrorDetail issue={issue} />
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
