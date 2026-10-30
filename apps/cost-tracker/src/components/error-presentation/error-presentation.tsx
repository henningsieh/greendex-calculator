"use client";

import { useTranslations } from "@greendex/i18n/client";

import { SafeFieldIssueSchema } from "@/lib/orpc/error-contract";
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
  return <>{translate(t, `details.${parsed.data.id}`, parsed.data.message)}</>;
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
