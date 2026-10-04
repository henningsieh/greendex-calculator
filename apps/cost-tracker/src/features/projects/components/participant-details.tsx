"use client";

import {
  EU_COUNTRIES,
  EU_COUNTRY_CODES,
  type EUCountryCode,
} from "@greendex/config/eu-countries";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  participantEntryDenialMessage,
  useParticipantEntryAccess,
} from "@/features/authentication/participant-entry-access";
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";

/** The single EU set a `country` may hold, shared with the server's input schema. */
function asCountry(value: string | null): EUCountryCode | "" {
  return EU_COUNTRY_CODES.find((code) => code === value) ?? "";
}

function CountryCorrection({
  partnershipId,
  participationId,
  displayName,
  country,
}: {
  partnershipId: string;
  participationId: string;
  displayName: string;
  country: string | null;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<EUCountryCode | "">(
    asCountry(country),
  );
  const [feedback, setFeedback] = useState<{
    title: string;
    description: string;
  }>();
  const details = orpcQuery.participations.get.queryOptions({
    input: { partnershipId, id: participationId },
    meta: { costTrackerORPC: true },
  });
  const update = useMutation({
    mutationFn: () =>
      orpc.participations.update({
        partnershipId,
        id: participationId,
        country: selected || null,
      }),
    onSuccess: async () => {
      setFeedback({
        title: "Country saved",
        description: `The corrected country is stored for ${displayName}.`,
      });
      await queryClient.invalidateQueries({
        queryKey: details.queryKey,
      });
      await queryClient.invalidateQueries({
        queryKey: orpcQuery.participations.listPartnership.queryKey({
          input: { partnershipId },
        }),
      });
    },
    onError: (error) =>
      setFeedback({
        title: "Unable to save country",
        description: getORPCRequestErrorMessage(error).text,
      }),
  });
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="participation-country">Country for {displayName}</Label>
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          disabled={update.isPending}
          id="participation-country"
          onChange={(event) => {
            setFeedback(undefined);
            setSelected(asCountry(event.target.value));
          }}
          value={selected}
        >
          <option value="">Not set</option>
          {EU_COUNTRIES.map((country) => (
            <option key={country.code} value={country.code}>
              {country.code}
            </option>
          ))}
        </select>
      </div>
      <Button
        disabled={update.isPending}
        onClick={() => {
          setFeedback(undefined);
          update.mutate();
        }}
        type="button"
        variant="outline"
      >
        Save country for {displayName}
      </Button>
      {feedback && (
        <Alert>
          <AlertTitle>{feedback.title}</AlertTitle>
          <AlertDescription>{feedback.description}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/**
 * One Project Participation, read and — for the Partner Organization only —
 * corrected here (ADR-0016). The page holds no role matrix: the shared
 * Project-scope policy decides whether the correction control renders, and the
 * procedure enforces the same decision again on every request.
 */
export function ParticipantDetails({
  partnershipId,
  participationId,
}: {
  partnershipId: string;
  participationId: string;
}) {
  const { data } = useSuspenseQuery(
    orpcQuery.participations.get.queryOptions({
      input: { partnershipId, id: participationId },
      meta: { costTrackerORPC: true },
    }),
  );
  const correction = useParticipantEntryAccess(data.correctionContext);
  const denial = participantEntryDenialMessage(correction);
  const { participation } = data;
  return (
    <section className="space-y-6" aria-label="Participant details">
      <div className="space-y-2">
        <Link
          className={buttonVariants({ variant: "ghost" })}
          href={`/partnerships/${encodeURIComponent(partnershipId)}/participants`}
        >
          Back to Project Participations
        </Link>
        <p className="text-sm text-muted-foreground">
          Project: {data.projectName}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{participation.displayName}</CardTitle>
          <CardDescription>
            Project Participation {participation.id}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p>{participation.email ?? "No email recorded"}</p>
          <p className="flex flex-wrap items-center gap-3 text-sm">
            <span>Country</span>
            <Badge variant="secondary">
              {participation.country ?? "Not set"}
            </Badge>
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Correct country</CardTitle>
          <CardDescription>
            The Participant sets this when joining. Only the Partner Organization
            may correct it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {correction.permitted ? (
            <CountryCorrection
              partnershipId={partnershipId}
              participationId={participation.id}
              displayName={participation.displayName}
              country={participation.country}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {denial ?? "You cannot correct this Project Participation."}
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
