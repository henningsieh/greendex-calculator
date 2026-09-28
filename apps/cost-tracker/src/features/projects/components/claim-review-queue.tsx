"use client";

import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const submitted = partnerships.filter(
    (_, index) => claims[index].data?.status === "submitted",
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Submitted Claims awaiting review</CardTitle>
      </CardHeader>
      <CardContent>
        {submitted.length === 0 ? (
          <p>No submitted Claims available for review.</p>
        ) : (
          <ul className="space-y-3">
            {submitted.map((item) => (
              <li key={item.id}>
                <Link href={`/claims/review/${encodeURIComponent(item.id)}`}>
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
