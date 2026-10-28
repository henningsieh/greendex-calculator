"use client";

import { useTranslations } from "@greendex/i18n/client";
import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { isClaimAwaitingReview } from "@/features/claims/claim-lifecycle";
import { orpcQuery } from "@/lib/orpc/orpc";

export function ClaimReviewQueue() {
  const t = useTranslations("claims.queue");
  const { data: partnerships } = useSuspenseQuery(
    orpcQuery.projectPartnerships.list.queryOptions({
      meta: { costTrackerORPC: true },
    }),
  );
  const claims = useSuspenseQueries({
    queries: partnerships.map((item) => ({
      ...orpcQuery.claims.getDraft.queryOptions({
        input: { partnershipId: item.id },
        meta: { costTrackerORPC: true },
      }),
    })),
  });
  // The queue shows the same awaiting-review status the server enforces;
  // it keeps no status-to-action rule of its own.
  const submitted = partnerships.filter((_, index) =>
    isClaimAwaitingReview(claims[index].data?.status),
  );
  return (
    <Card data-testid="review-queue">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {submitted.length === 0 ? (
          <Empty data-testid="review-queue-empty">
            <EmptyHeader>
              <EmptyTitle>{t("empty")}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="flex flex-col gap-1">
            {submitted.map((item) => (
              <li key={item.id}>
                <Link
                  data-testid={`review-claim-${item.id}`}
                  className="block rounded-md px-3 py-2 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  href={`/claims/review/${encodeURIComponent(item.id)}`}
                >
                  {item.projectName} · {item.organizationName}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
