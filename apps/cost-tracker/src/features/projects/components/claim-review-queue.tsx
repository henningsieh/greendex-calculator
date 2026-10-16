"use client";

import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { isClaimAwaitingReview } from "@/features/projects/claim-lifecycle";
import { orpcQuery } from "@/lib/orpc/orpc";

export function ClaimReviewQueue() {
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
    <Card>
      <CardHeader>
        <CardTitle>Submitted Claims awaiting review</CardTitle>
      </CardHeader>
      <CardContent>
        {submitted.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No submitted Claims available for review.</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="flex flex-col gap-1">
            {submitted.map((item) => (
              <li key={item.id}>
                <Link
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
