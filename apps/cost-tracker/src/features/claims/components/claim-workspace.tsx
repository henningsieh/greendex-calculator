"use client";

import { PARTICIPANT_TRANSPORT_EMISSION_PROFILES } from "@greendex/config/transport-emission-profiles";
import { useTranslations } from "@greendex/i18n/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient, useSuspenseQueries } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import {
  ErrorDetail,
  ErrorPresentation,
  FieldErrorMessage,
} from "@/components/error-presentation/error-presentation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError as FormFieldError,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { canPartnerEditClaim } from "@/features/claims/claim-lifecycle";
import {
  ClaimBand,
  ClaimCostTable,
  PayoutAccountLines,
  claimStatusLabel,
} from "@/features/claims/components/claim-document";
import { ClaimHistory } from "@/features/claims/components/claim-review";
import { ClaimSubmission } from "@/features/claims/components/claim-submission";
import { CostSaveInputSchema } from "@/features/claims/cost-validation";
import { useParticipantEntryAccess } from "@/features/participant-onboarding/hooks/use-participant-entry-access";
import { JourneyInputSchema } from "@/features/participations/validation-schemas";
import { getORPCErrorPresentation } from "@/lib/orpc/error-message";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";
import type { Outputs } from "@/lib/orpc/router";

type Participation =
  Outputs["participations"]["listPartnership"]["participations"][number];
type Cost = Outputs["costs"]["list"]["entries"][number];
type FieldErrors = Record<string, React.ReactNode>;

function errorsFor(error: unknown, root: string): FieldErrors {
  const presentation = getORPCErrorPresentation(error);
  const errors: FieldErrors = {};
  for (const issue of presentation.issues ?? []) {
    const path = issue.path.join(".");
    if (path) errors[path] = <ErrorDetail issue={issue} />;
  }
  if (presentation.key === "PAYOUT_ACCOUNT_REQUIRED")
    errors.payoutAccount = <ErrorPresentation error={error} />;
  if (!Object.keys(errors).length)
    errors[root] = <ErrorPresentation error={error} />;
  return errors;
}

// Display-only sum; the server remains the authority for exact share validation.
function enteredShareTotal(values: string[], method: "percentage" | "amount") {
  const precision = method === "percentage" ? 6 : 2;
  const units = values.reduce((sum, value) => {
    if (!/^\d+(?:\.\d+)?$/.test(value)) return sum;
    const [whole, fraction = ""] = value.split(".");
    return (
      sum +
      BigInt(whole) * BigInt(10) ** BigInt(precision) +
      BigInt(fraction.slice(0, precision).padEnd(precision, "0"))
    );
  }, BigInt(0));
  return `${units / BigInt(10) ** BigInt(precision)}.${String(units % BigInt(10) ** BigInt(precision)).padStart(precision, "0")}`;
}

function FieldError({ message }: { message?: React.ReactNode }) {
  return message ? (
    <div role="alert" className="text-sm text-destructive">
      {message}
    </div>
  ) : null;
}

function JourneyCorrection({
  partnershipId,
  journey,
  name,
  refresh,
}: {
  partnershipId: string;
  journey: Outputs["journeys"]["list"][number];
  name: string;
  refresh: () => Promise<void>;
}) {
  const t = useTranslations("claims.workspace");
  const [editing, setEditing] = useState(false);
  const [serverError, setServerError] = useState<unknown>(null);
  const defaults = {
    partnershipId,
    projectParticipantId: journey.projectParticipantId,
    origin: journey.origin,
    destination: journey.destination,
    tripType: journey.tripType,
    erasmusDistanceKm: journey.erasmusDistanceKm,
  };
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(JourneyInputSchema),
    defaultValues: defaults,
  });
  const id = `correction-${journey.id}`;

  const update = handleSubmit(async (values) => {
    try {
      await orpc.journeys.update(values);
      await refresh();
      setEditing(false);
    } catch (error) {
      setServerError(error);
      const presentation = getORPCErrorPresentation(error);
      let mapped = false;
      for (const issue of presentation.issues ?? []) {
        const field = issue.path.length === 1 ? issue.path[0] : undefined;
        if (
          field === "origin" ||
          field === "destination" ||
          field === "tripType" ||
          field === "erasmusDistanceKm"
        ) {
          setError(
            field,
            { type: "server", message: issue.id },
            { shouldFocus: !mapped },
          );
          mapped = true;
        }
      }
      if (!mapped) setError("root.server", { type: "server" });
    }
  });

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
      <div className="min-w-0 wrap-anywhere">
        <p className="font-semibold">{name}</p>
        <p>
          {journey.origin} → {journey.destination}
        </p>
        <p className="text-sm text-muted-foreground">
          {journey.tripType},{" "}
          <span className="font-mono">{journey.erasmusDistanceKm}</span>{" "}
          {t("journey.distanceSuffix")}
        </p>
      </div>
      {!editing ? (
        <Button
          size="lg"
          variant="outline"
          type="button"
          onClick={() => setEditing(true)}
          data-testid={`correct-journey-${journey.projectParticipantId}`}
        >
          {t("journey.correctFor", { name })}
        </Button>
      ) : (
        <form onSubmit={update} noValidate>
          <FieldGroup>
            {errors.root?.server && (
              <FormFieldError>
                <ErrorPresentation error={serverError} />
              </FormFieldError>
            )}
            <Field data-invalid={!!errors.origin}>
              <FieldLabel htmlFor={`${id}-origin`}>
                {t("journey.originFor", { name })}
              </FieldLabel>
              <Input
                variant="accounting"
                id={`${id}-origin`}
                data-testid={`journey-correction-${journey.projectParticipantId}-origin`}
                {...register("origin")}
                aria-invalid={!!errors.origin}
                aria-describedby={
                  errors.origin ? `${id}-origin-error` : undefined
                }
              />
              {errors.origin && (
                <FormFieldError id={`${id}-origin-error`}>
                  <FieldErrorMessage message={errors.origin.message} />
                </FormFieldError>
              )}
            </Field>
            <Field data-invalid={!!errors.destination}>
              <FieldLabel htmlFor={`${id}-destination`}>
                {t("journey.destinationFor", { name })}
              </FieldLabel>
              <Input
                variant="accounting"
                id={`${id}-destination`}
                data-testid={`journey-correction-${journey.projectParticipantId}-destination`}
                {...register("destination")}
                aria-invalid={!!errors.destination}
                aria-describedby={
                  errors.destination ? `${id}-destination-error` : undefined
                }
              />
              {errors.destination && (
                <FormFieldError id={`${id}-destination-error`}>
                  <FieldErrorMessage message={errors.destination.message} />
                </FormFieldError>
              )}
            </Field>
            <Field data-invalid={!!errors.tripType}>
              <FieldLabel htmlFor={`${id}-type`}>
                {t("journey.tripTypeFor", { name })}
              </FieldLabel>
              <select
                id={`${id}-type`}
                data-testid={`journey-correction-${journey.projectParticipantId}-type`}
                className="min-h-11 w-full min-w-0 rounded-sm border border-input bg-card p-2 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
                {...register("tripType")}
                aria-invalid={!!errors.tripType}
                aria-describedby={
                  errors.tripType ? `${id}-type-error` : undefined
                }
              >
                <option value="one-way">{t("journey.oneWay")}</option>
                <option value="round-trip">{t("journey.roundTrip")}</option>
              </select>
              {errors.tripType && (
                <FormFieldError id={`${id}-type-error`}>
                  <FieldErrorMessage message={errors.tripType.message} />
                </FormFieldError>
              )}
            </Field>
            <Field data-invalid={!!errors.erasmusDistanceKm}>
              <FieldLabel htmlFor={`${id}-distance`}>
                {t("journey.distanceFor", { name })}
              </FieldLabel>
              <Input
                variant="accounting"
                id={`${id}-distance`}
                data-testid={`journey-correction-${journey.projectParticipantId}-distance`}
                inputMode="decimal"
                {...register("erasmusDistanceKm")}
                aria-invalid={!!errors.erasmusDistanceKm}
                aria-describedby={
                  errors.erasmusDistanceKm ? `${id}-distance-error` : undefined
                }
              />
              {errors.erasmusDistanceKm && (
                <FormFieldError id={`${id}-distance-error`}>
                  <FieldErrorMessage message={errors.erasmusDistanceKm.message} />
                </FormFieldError>
              )}
            </Field>
            <Button
              size="lg"
              variant="default"
              type="submit"
              disabled={isSubmitting}
              data-testid="journey-correction-save"
            >
              {t("journey.saveCorrection")}
            </Button>
            <Button
              data-testid="cancel-journey-correction"
              variant="default"
              size="lg"
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                reset(defaults);
                setServerError(null);
                setEditing(false);
              }}
            >
              {t("common.cancel")}
            </Button>
          </FieldGroup>
        </form>
      )}
    </div>
  );
}

function JourneyEditor({
  partnershipId,
  participants,
  saved,
  editable,
  corrections,
  refresh,
}: {
  partnershipId: string;
  participants: Participation[];
  saved: Outputs["journeys"]["list"];
  editable: boolean;
  corrections: boolean;
  refresh: () => Promise<void>;
}) {
  const t = useTranslations("claims.workspace");
  const [serverError, setServerError] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(JourneyInputSchema),
    defaultValues: {
      partnershipId,
      projectParticipantId: "",
      origin: "",
      destination: "",
      tripType: "one-way" as "one-way" | "round-trip",
      erasmusDistanceKm: "",
    },
  });
  const existing = new Set(saved.map((journey) => journey.projectParticipantId));
  const save = handleSubmit(async (values) => {
    try {
      await orpc.journeys.save(values);
      await refresh();
      reset({
        partnershipId,
        projectParticipantId: "",
        origin: "",
        destination: "",
        tripType: values.tripType,
        erasmusDistanceKm: "",
      });
    } catch (error) {
      setServerError(error);
      const presentation = getORPCErrorPresentation(error);
      let mapped = false;
      for (const issue of presentation.issues ?? []) {
        const [field] = issue.path;
        if (
          issue.path.length === 1 &&
          (field === "projectParticipantId" ||
            field === "origin" ||
            field === "destination" ||
            field === "tripType" ||
            field === "erasmusDistanceKm")
        ) {
          setError(
            field,
            { type: "server", message: issue.id },
            { shouldFocus: !mapped },
          );
          mapped = true;
        }
      }
      if (!mapped) {
        if (presentation.key === "JOURNEY_ALREADY_EXISTS") {
          setError(
            "projectParticipantId",
            { type: "situation" },
            { shouldFocus: true },
          );
        } else {
          setError("root.server", { type: "server" });
        }
      }
    }
  });
  return (
    <Card variant="document">
      <CardHeader>
        <CardTitle as="h2">{t("journey.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5" id="claim-journeys">
        {saved.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{t("journey.empty")}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="space-y-4">
            {saved.map((journey) => (
              <li key={journey.id} id={`journey-${journey.projectParticipantId}`}>
                {corrections ? (
                  <JourneyCorrection
                    key={`${journey.id}-${journey.origin}-${journey.destination}-${journey.tripType}-${journey.erasmusDistanceKm}`}
                    partnershipId={partnershipId}
                    journey={journey}
                    name={
                      participants.find(
                        (item) => item.id === journey.projectParticipantId,
                      )?.displayName ?? "Participant"
                    }
                    refresh={refresh}
                  />
                ) : (
                  <>
                    {participants.find(
                      (item) => item.id === journey.projectParticipantId,
                    )?.displayName ?? t("copy.participant")}
                    : {journey.origin} → {journey.destination}, {journey.tripType}
                    , {journey.erasmusDistanceKm}{" "}
                    {t("journey.savedDistanceSuffix")}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {participants.some((item) => !existing.has(item.id)) && (
          <ul aria-label={t("journey.gapsLabel")} data-testid="journey-gaps">
            {participants
              .filter((item) => !existing.has(item.id))
              .map((item) => (
                <li key={item.id} id={`journey-gap-${item.id}`}>
                  {t("journey.missing", { name: item.displayName })}
                </li>
              ))}
          </ul>
        )}
        {editable && (
          <form onSubmit={save} noValidate>
            <FieldGroup className="grid gap-4 sm:grid-cols-2 [&>button]:justify-self-start">
              {errors.root?.server && (
                <FormFieldError>
                  <ErrorPresentation error={serverError} />
                </FormFieldError>
              )}
              <Field data-invalid={!!errors.projectParticipantId}>
                <FieldLabel htmlFor="journey-person">
                  {t("journey.participation")}
                </FieldLabel>
                <select
                  id="journey-person"
                  data-testid="journey-person"
                  className="min-h-11 w-full min-w-0 rounded-sm border border-input bg-card p-2 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  {...register("projectParticipantId")}
                  aria-invalid={!!errors.projectParticipantId}
                  aria-describedby={
                    errors.projectParticipantId
                      ? "journey-person-error"
                      : undefined
                  }
                >
                  <option value="">{t("journey.selectParticipation")}</option>
                  {participants
                    .filter((item) => !existing.has(item.id))
                    .map((item) => (
                      <option
                        data-testid={`journey-option-${item.id}`}
                        key={item.id}
                        value={item.id}
                      >
                        {item.displayName}
                      </option>
                    ))}
                </select>
                {errors.projectParticipantId && (
                  <FormFieldError id="journey-person-error">
                    {errors.projectParticipantId.type === "situation" ? (
                      <ErrorPresentation error={serverError} />
                    ) : errors.projectParticipantId.type === "server" ? (
                      <FieldErrorMessage
                        message={errors.projectParticipantId.message}
                      />
                    ) : (
                      t("journey.selectParticipation")
                    )}
                  </FormFieldError>
                )}
              </Field>
              <Field data-invalid={!!errors.origin}>
                <FieldLabel htmlFor="journey-origin">
                  {t("journey.origin")}
                </FieldLabel>
                <Input
                  variant="accounting"
                  id="journey-origin"
                  data-testid="journey-origin"
                  {...register("origin")}
                  aria-invalid={!!errors.origin}
                  aria-describedby={
                    errors.origin ? "journey-origin-error" : undefined
                  }
                />
                {errors.origin && (
                  <FormFieldError id="journey-origin-error">
                    <FieldErrorMessage message={errors.origin.message} />
                  </FormFieldError>
                )}
              </Field>
              <Field data-invalid={!!errors.destination}>
                <FieldLabel htmlFor="journey-destination">
                  {t("journey.destination")}
                </FieldLabel>
                <Input
                  variant="accounting"
                  id="journey-destination"
                  {...register("destination")}
                  aria-invalid={!!errors.destination}
                  aria-describedby={
                    errors.destination ? "journey-destination-error" : undefined
                  }
                />
                {errors.destination && (
                  <FormFieldError id="journey-destination-error">
                    <FieldErrorMessage message={errors.destination.message} />
                  </FormFieldError>
                )}
              </Field>
              <Field data-invalid={!!errors.tripType}>
                <FieldLabel htmlFor="journey-type">
                  {t("journey.tripType")}
                </FieldLabel>
                <select
                  id="journey-type"
                  className="min-h-11 w-full min-w-0 rounded-sm border border-input bg-card p-2 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  {...register("tripType")}
                  aria-invalid={!!errors.tripType}
                  aria-describedby={
                    errors.tripType ? "journey-type-error" : undefined
                  }
                >
                  <option value="one-way">{t("journey.oneWay")}</option>
                  <option value="round-trip">{t("journey.roundTrip")}</option>
                </select>
                {errors.tripType && (
                  <FormFieldError id="journey-type-error">
                    <FieldErrorMessage message={errors.tripType.message} />
                  </FormFieldError>
                )}
              </Field>
              <Field data-invalid={!!errors.erasmusDistanceKm}>
                <FieldLabel htmlFor="journey-distance">
                  {t("journey.distance")}
                </FieldLabel>
                <Input
                  variant="figure"
                  id="journey-distance"
                  data-testid="journey-distance"
                  inputMode="decimal"
                  {...register("erasmusDistanceKm")}
                  aria-invalid={!!errors.erasmusDistanceKm}
                  aria-describedby={
                    errors.erasmusDistanceKm
                      ? "journey-distance-error"
                      : undefined
                  }
                />
                {errors.erasmusDistanceKm && (
                  <FormFieldError id="journey-distance-error">
                    <FieldErrorMessage
                      message={errors.erasmusDistanceKm.message}
                    />
                  </FormFieldError>
                )}
              </Field>
              <Button
                size="lg"
                variant="default"
                type="submit"
                disabled={isSubmitting}
                data-testid="journey-save"
              >
                {t("journey.save")}
              </Button>
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function CostEditor({
  partnershipId,
  participants,
  entries,
  documents,
  editable,
  refresh,
}: {
  partnershipId: string;
  participants: Participation[];
  entries: Cost[];
  documents: Outputs["documents"]["list"];
  editable: boolean;
  refresh: () => Promise<void>;
}) {
  const t = useTranslations("claims.workspace");
  const [serverError, setServerError] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    clearErrors,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(CostSaveInputSchema),
    defaultValues: {
      partnershipId,
      entryId: undefined as string | undefined,
      transportProfile: PARTICIPANT_TRANSPORT_EMISSION_PROFILES[0],
      amountEur: "",
      allocationMethod: "equal" as "equal" | "percentage" | "amount",
      allocations: [] as {
        projectParticipantId: string;
        percentage?: string;
        amountEur?: string;
      }[],
    },
  });
  const entryId = useWatch({ control, name: "entryId" });
  const amount = useWatch({ control, name: "amountEur" });
  const method = useWatch({ control, name: "allocationMethod" });
  const allocations = useWatch({ control, name: "allocations" });
  function edit(entry: Cost) {
    reset({
      partnershipId,
      entryId: entry.id,
      transportProfile: entry.transportProfile,
      amountEur: entry.amountEur,
      allocationMethod: entry.allocationMethod,
      allocations: entry.allocations.map((item) => ({
        projectParticipantId: item.projectParticipantId,
        ...(entry.allocationMethod === "percentage"
          ? { percentage: item.percentage ?? "" }
          : entry.allocationMethod === "amount"
            ? { amountEur: item.amountEur ?? "" }
            : {}),
      })),
    });
    setServerError(null);
  }
  const save = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await orpc.costs.save(values);
      reset({
        partnershipId,
        entryId: undefined,
        transportProfile: values.transportProfile,
        amountEur: "",
        allocationMethod: values.allocationMethod,
        allocations: [],
      });
      await refresh();
    } catch (error) {
      setServerError(error);
      const issues = getORPCErrorPresentation(error).issues ?? [];
      let mapped = false;
      for (const issue of issues) {
        const path = issue.path;
        if (
          path.length === 1 &&
          (path[0] === "amountEur" ||
            path[0] === "transportProfile" ||
            path[0] === "allocationMethod" ||
            path[0] === "allocations")
        ) {
          setError(
            path[0],
            { type: "server", message: issue.id },
            { shouldFocus: !mapped },
          );
          mapped = true;
        } else if (
          path[0] === "allocations" &&
          typeof path[1] === "number" &&
          path[1] >= 0 &&
          path[1] < values.allocations.length &&
          path.length === 2
        ) {
          setError(`allocations.${path[1]}`, {
            type: "server",
            message: issue.id,
          });
          mapped = true;
        } else if (
          path[0] === "allocations" &&
          typeof path[1] === "number" &&
          path[1] >= 0 &&
          path[1] < values.allocations.length &&
          path.length === 3 &&
          (path[2] === "percentage" ||
            path[2] === "amountEur" ||
            path[2] === "projectParticipantId")
        ) {
          setError(
            `allocations.${path[1]}.${path[2]}`,
            { type: "server", message: issue.id },
            { shouldFocus: !mapped },
          );
          mapped = true;
        }
      }
      if (!mapped) setError("root.server", { type: "server" });
    }
  });
  const shareTotal =
    method === "equal"
      ? undefined
      : enteredShareTotal(
          allocations.map(
            (item) =>
              (method === "percentage" ? item.percentage : item.amountEur) || "0",
          ),
          method,
        );
  return (
    <Card variant="document">
      <CardHeader>
        <CardTitle as="h2">{t("cost.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5" id="claim-costs">
        {entries.length === 0 ? (
          <Empty data-testid="costs-empty">
            <EmptyHeader>
              <EmptyTitle>{t("cost.empty")}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <ClaimCostTable
            actions={editable}
            rows={entries.map((entry) => ({
              id: entry.id,
              transportProfile: entry.transportProfile,
              amountEur: entry.amountEur,
              allocationMethod: entry.allocationMethod,
              allocations: (
                <ul className="space-y-2">
                  {entry.allocations.map((share) => (
                    <li
                      key={share.projectParticipantId}
                      data-amount-eur={share.amountEur}
                    >
                      {participants.find(
                        (item) => item.id === share.projectParticipantId,
                      )?.displayName ?? t("copy.participant")}
                      :{" "}
                      <span className="font-mono tabular-nums">
                        {entry.allocationMethod === "percentage"
                          ? `${share.percentage}%`
                          : t("copy.eurAmount", {
                              amount: String(share.amountEur),
                            })}
                      </span>
                      {entry.allocationMethod === "equal" && (
                        <> {t("copy.computed")}</>
                      )}
                    </li>
                  ))}
                </ul>
              ),
              documents: entry.proofDocumentIds.length ? (
                <ul className="space-y-2">
                  {entry.proofDocumentIds.map((id) => (
                    <li key={id}>
                      {documents.find((document) => document.id === id)
                        ?.originalFileName ?? t("copy.document")}
                    </li>
                  ))}
                </ul>
              ) : (
                "None"
              ),
              action: editable ? (
                <Button
                  size="lg"
                  variant="outline"
                  type="button"
                  onClick={() => edit(entry)}
                >
                  {t("cost.edit")}
                </Button>
              ) : undefined,
            }))}
          />
        )}
        {editable && (
          <form onSubmit={save} noValidate>
            <FieldGroup className="grid gap-4 sm:grid-cols-2 [&>button]:justify-self-start [&>fieldset]:col-span-full [&>p]:col-span-full">
              <p>{entryId ? t("copy.editCost") : t("copy.addCost")}</p>
              {errors.root?.server && (
                <FormFieldError>
                  <ErrorPresentation error={serverError} />
                </FormFieldError>
              )}
              <Field data-invalid={!!errors.transportProfile}>
                <FieldLabel htmlFor="cost-profile">
                  {t("cost.transport")}
                </FieldLabel>
                <select
                  id="cost-profile"
                  className="min-h-11 w-full min-w-0 rounded-sm border border-input bg-card p-2 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  aria-invalid={!!errors.transportProfile}
                  aria-describedby={
                    errors.transportProfile ? "cost-profile-error" : undefined
                  }
                  {...register("transportProfile")}
                >
                  {PARTICIPANT_TRANSPORT_EMISSION_PROFILES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                {errors.transportProfile && (
                  <FormFieldError id="cost-profile-error">
                    <FieldErrorMessage
                      message={errors.transportProfile.message}
                    />
                  </FormFieldError>
                )}
              </Field>
              <Field data-invalid={!!errors.amountEur}>
                <FieldLabel htmlFor="cost-amount">
                  {t("cost.exactTotal")}
                </FieldLabel>
                <Input
                  variant="figure"
                  id="cost-amount"
                  data-testid="cost-amount"
                  inputMode="decimal"
                  aria-invalid={!!errors.amountEur}
                  aria-describedby={
                    errors.amountEur ? "cost-amount-error" : undefined
                  }
                  {...register("amountEur")}
                />
                {errors.amountEur && (
                  <FormFieldError id="cost-amount-error">
                    <FieldErrorMessage message={errors.amountEur.message} />
                  </FormFieldError>
                )}
              </Field>
              <Field data-invalid={!!errors.allocationMethod}>
                <FieldLabel htmlFor="cost-method">
                  {t("cost.allocationMethod")}
                </FieldLabel>
                <select
                  id="cost-method"
                  data-testid="cost-method"
                  className="min-h-11 w-full min-w-0 rounded-sm border border-input bg-card p-2 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  aria-invalid={!!errors.allocationMethod}
                  aria-describedby={
                    errors.allocationMethod ? "cost-method-error" : undefined
                  }
                  {...register("allocationMethod", {
                    onChange: (event) => {
                      const next = event.target.value;
                      clearErrors("allocations");
                      setValue(
                        "allocations",
                        allocations.map((item) => ({
                          projectParticipantId: item.projectParticipantId,
                          ...(next === "percentage"
                            ? {
                                percentage:
                                  item.percentage ?? item.amountEur ?? "",
                              }
                            : next === "amount"
                              ? {
                                  amountEur:
                                    item.amountEur ?? item.percentage ?? "",
                                }
                              : {}),
                        })),
                        { shouldDirty: true, shouldValidate: true },
                      );
                    },
                  })}
                >
                  <option value="equal">{t("cost.equal")}</option>
                  <option value="percentage">{t("cost.percentage")}</option>
                  <option value="amount">{t("cost.amount")}</option>
                </select>
                {errors.allocationMethod && (
                  <FormFieldError id="cost-method-error">
                    <FieldErrorMessage
                      message={errors.allocationMethod.message}
                    />
                  </FormFieldError>
                )}
              </Field>
              <fieldset data-testid="cost-participations" className="space-y-2">
                <legend>{t("cost.coveredParticipations")}</legend>
                {participants.map((item) => {
                  const index = allocations.findIndex(
                    (allocation) => allocation.projectParticipantId === item.id,
                  );
                  const rowError =
                    index >= 0 ? errors.allocations?.[index] : undefined;
                  return (
                    <div key={item.id}>
                      <label>
                        <input
                          data-testid={`cost-participation-${item.id}`}
                          type="checkbox"
                          checked={index !== -1}
                          onChange={(event) => {
                            clearErrors("allocations");
                            setValue(
                              "allocations",
                              event.target.checked
                                ? [
                                    ...allocations,
                                    {
                                      projectParticipantId: item.id,
                                      ...(method === "percentage"
                                        ? {
                                            percentage: "",
                                          }
                                        : method === "amount"
                                          ? {
                                              amountEur: "",
                                            }
                                          : {}),
                                    },
                                  ]
                                : allocations.filter(
                                    (allocation) =>
                                      allocation.projectParticipantId !== item.id,
                                  ),
                              { shouldDirty: true, shouldValidate: true },
                            );
                          }}
                        />{" "}
                        {item.displayName}
                      </label>
                      {rowError?.projectParticipantId && (
                        <FormFieldError>
                          <FieldErrorMessage
                            message={rowError.projectParticipantId.message}
                          />
                        </FormFieldError>
                      )}
                      {method === "equal" && rowError?.message && (
                        <FormFieldError>
                          <FieldErrorMessage message={rowError.message} />
                        </FormFieldError>
                      )}
                      {index !== -1 && method !== "equal" && (
                        <Field
                          data-invalid={
                            !!(
                              rowError?.percentage ||
                              rowError?.amountEur ||
                              rowError?.message
                            )
                          }
                        >
                          <FieldLabel htmlFor={`share-${item.id}`}>
                            {item.displayName}{" "}
                            {method === "percentage"
                              ? t("copy.percentage")
                              : t("copy.eurShare")}
                          </FieldLabel>
                          <Input
                            variant="figure"
                            id={`share-${item.id}`}
                            data-testid={`cost-share-${item.id}`}
                            inputMode="decimal"
                            aria-invalid={
                              !!(
                                rowError?.percentage ||
                                rowError?.amountEur ||
                                rowError?.message
                              )
                            }
                            aria-describedby={
                              rowError?.percentage ||
                              rowError?.amountEur ||
                              rowError?.message
                                ? `share-${item.id}-error`
                                : undefined
                            }
                            {...register(
                              `allocations.${index}.${method === "percentage" ? "percentage" : "amountEur"}`,
                            )}
                          />
                          {(rowError?.percentage ||
                            rowError?.amountEur ||
                            rowError?.message) && (
                            <FormFieldError id={`share-${item.id}-error`}>
                              <FieldErrorMessage
                                message={
                                  rowError.percentage?.message ??
                                  rowError.amountEur?.message ??
                                  rowError.message
                                }
                              />
                            </FormFieldError>
                          )}
                        </Field>
                      )}
                    </div>
                  );
                })}
                {(errors.allocations?.message ||
                  errors.allocations?.root?.message) && (
                  <FormFieldError>
                    <FieldErrorMessage
                      message={
                        errors.allocations.message ??
                        errors.allocations.root?.message
                      }
                    />
                  </FormFieldError>
                )}
              </fieldset>
              <p aria-live="polite" data-share-total={shareTotal}>
                {method === "equal"
                  ? t("copy.equalSplit", { count: allocations.length })
                  : method === "percentage"
                    ? t("copy.percentageTotal", { total: String(shareTotal) })
                    : t("copy.amountTotal", {
                        total: String(shareTotal),
                        amount: amount || "0",
                      })}
              </p>
              <Button
                size="lg"
                variant="default"
                type="submit"
                disabled={isSubmitting}
                data-testid="cost-save"
              >
                {t("cost.save")}
              </Button>
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function ProofEditor({
  partnershipId,
  entries,
  documents,
  editable,
  refresh,
}: {
  partnershipId: string;
  entries: Cost[];
  documents: Outputs["documents"]["list"];
  editable: boolean;
  refresh: () => Promise<void>;
}) {
  const t = useTranslations("claims.workspace");
  const [progress, setProgress] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<React.ReactNode>("");
  const [busy, setBusy] = useState(false);
  function upload(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("file");
    const file =
      fileInput instanceof HTMLInputElement ? fileInput.files?.[0] : undefined;
    if (!file?.size) return;
    setBusy(true);
    setFeedback("");
    setProgress(0);
    const data = new FormData();
    data.set("partnershipId", partnershipId);
    data.set("file", file);
    const request = new XMLHttpRequest();
    request.open("POST", "/api/proof-documents");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable)
        setProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      setBusy(false);
      if (request.status === 201) {
        setProgress(100);
        setFeedback("Proof Document uploaded.");
        form.reset();
        void refresh();
      } else {
        let body: unknown;
        try {
          body = JSON.parse(request.responseText);
        } catch {
          body = undefined;
        }
        setFeedback(
          <ErrorPresentation error={body} httpStatus={request.status} />,
        );
      }
    };
    request.onerror = () => {
      setBusy(false);
      setFeedback(<ErrorPresentation error={undefined} />);
    };
    request.send(data);
  }
  async function link(entryId: string, proofDocumentId: string) {
    setFeedback("");
    setBusy(true);
    try {
      await orpc.costs.linkDocument({ partnershipId, entryId, proofDocumentId });
      setFeedback("Proof Document linked.");
      await refresh();
    } catch (error) {
      setFeedback(<ErrorPresentation error={error} />);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card variant="document">
      <CardHeader>
        <CardTitle as="h2">{t("proof.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4" id="claim-proofs">
        {documents.length === 0 ? (
          <p>{t("proof.empty")}</p>
        ) : (
          <ul>
            {documents.map((document) => (
              <li key={document.id} className="wrap-anywhere">
                {document.originalFileName} ({document.byteSize}{" "}
                {t("proof.bytes")})
              </li>
            ))}
          </ul>
        )}
        {editable && (
          <form className="space-y-4" onSubmit={upload}>
            <Label htmlFor="proof-file">{t("proof.uploadLabel")}</Label>
            <Input
              variant="accounting"
              id="proof-file"
              data-testid="proof-file"
              name="file"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
            />
            <Button
              size="lg"
              variant="default"
              type="submit"
              disabled={busy}
              data-testid="proof-upload"
            >
              {t("proof.upload")}
            </Button>
          </form>
        )}
        {progress !== null && (
          <progress
            className="w-full accent-primary"
            value={progress}
            max={100}
            aria-label={t("proof.progressLabel")}
          >
            {t("proof.uploadProgress")} {progress}%
          </progress>
        )}
        {feedback && (
          <div data-testid="proof-feedback" aria-live="polite" aria-atomic="true">
            {feedback}
          </div>
        )}
        {entries.map((entry) => (
          <div key={entry.id} id={`proof-${entry.id}`}>
            <p>
              {entry.transportProfile}{" "}
              <span className="font-mono tabular-nums">
                {entry.amountEur} {t("proof.currencyEur")}
              </span>
            </p>
            <p className="wrap-anywhere">
              {t("proof.linked")}{" "}
              {entry.proofDocumentIds
                .map(
                  (id) =>
                    documents.find((document) => document.id === id)
                      ?.originalFileName ?? "Document",
                )
                .join(", ") || t("copy.none")}
            </p>
            {editable && (
              <div>
                <Label htmlFor={`link-${entry.id}`}>{t("proof.linkLabel")}</Label>
                <select
                  id={`link-${entry.id}`}
                  data-testid={`link-proof-${entry.id}`}
                  className="min-h-11 w-full min-w-0 rounded-sm border border-input bg-card p-2 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  disabled={busy}
                  defaultValue=""
                  onChange={(event) => {
                    if (event.target.value)
                      void link(entry.id, event.target.value);
                    event.target.value = "";
                  }}
                >
                  <option value="">{t("proof.selectDocument")}</option>
                  {documents
                    .filter(
                      (document) => !entry.proofDocumentIds.includes(document.id),
                    )
                    .map((document) => (
                      <option
                        data-testid={`proof-option-${document.id}`}
                        key={document.id}
                        value={document.id}
                      >
                        {document.originalFileName}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SelectedClaimPayout({
  payout,
  editable,
}: {
  payout: Outputs["claims"]["listPayoutAccounts"];
  editable: boolean;
}) {
  const t = useTranslations("claims.workspace");
  const account = payout.accounts.find(
    (item) => item.id === payout.selectedPayoutAccountId,
  );
  if (!payout.selectedPayoutAccountId) return null;
  return account ? (
    <div className="my-5 space-y-3">
      <p>
        {t("payout.selected")}
        {editable && ` ${t("payout.changeHint")}`}
      </p>
      <PayoutAccountLines account={account} />
    </div>
  ) : (
    <p>
      {t("payout.unavailable")}
      {editable && ` · ${t("payout.changeHint")}`}
    </p>
  );
}

function ClaimStateNotice({
  draft,
  history,
}: {
  draft: Outputs["claims"]["getDraft"];
  history: Outputs["claims"]["getHistory"];
}) {
  const t = useTranslations("claims.workspace");

  if (!draft) return null;
  if (draft.status === "correction_requested")
    return (
      <Alert data-testid="claim-correction-notice">
        <AlertDescription>
          {t("notice.correctionRequested")}{" "}
          {history.findLast((event) => event.eventType === "correction_requested")
            ?.reason ?? t("copy.correctionHistory")}
          <p>{t("notice.correctionBody")}</p>
        </AlertDescription>
      </Alert>
    );
  if (draft.status === "rejected")
    return (
      <Alert>
        <AlertDescription>
          {t("notice.rejected")}{" "}
          {history.findLast((event) => event.eventType === "rejected")?.reason ??
            t("copy.rejectionHistory")}
          <p>{t("notice.rejectedBody")}</p>
        </AlertDescription>
      </Alert>
    );
  if (draft.status === "approved")
    return (
      <Alert>
        <AlertDescription>{t("notice.approved")}</AlertDescription>
      </Alert>
    );
  if (draft.status === "paid")
    return (
      <Alert>
        <AlertDescription>{t("notice.paid")}</AlertDescription>
      </Alert>
    );
  return null;
}

function ClaimDraftEditor({
  partnershipId,
  draft,
  payout,
  editable,
  refresh,
}: {
  partnershipId: string;
  draft: Outputs["claims"]["getDraft"];
  payout: Outputs["claims"]["listPayoutAccounts"];
  editable: boolean;
  refresh: () => Promise<void>;
}) {
  const t = useTranslations("claims.workspace");
  const client = useQueryClient();
  const input = { partnershipId };
  const [feedback, setFeedback] = useState<React.ReactNode>("");
  const [pending, setPending] = useState(false);
  const [accountHolder, setAccountHolder] = useState("");
  const [iban, setIban] = useState("");
  const [bic, setBic] = useState("");
  const [accountErrors, setAccountErrors] = useState<FieldErrors>({});
  async function addAccount(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFeedback("");
    setAccountErrors({});
    try {
      await orpc.claims.createPayoutAccount({
        partnershipId,
        accountHolder,
        iban,
        bic,
      });
      await client.invalidateQueries({
        queryKey: orpcQuery.claims.listPayoutAccounts.queryKey({ input }),
      });
      setAccountHolder("");
      setIban("");
      setBic("");
      setFeedback("Payout Account created. Select it to use it for this Claim.");
    } catch (error) {
      setAccountErrors(errorsFor(error, "account"));
    } finally {
      setPending(false);
    }
  }
  async function selectAccount(id: string) {
    if (!id) return;
    setPending(true);
    setFeedback("");
    try {
      await orpc.claims.selectPayoutAccount({
        partnershipId,
        payoutAccountId: id,
      });
      await refresh();
      setFeedback("Payout Account selected.");
    } catch (error) {
      setFeedback(<ErrorPresentation error={error} />);
    } finally {
      setPending(false);
    }
  }
  async function saveDraft() {
    setPending(true);
    setFeedback("");
    try {
      await orpc.claims.saveDraft(input);
      await refresh();
      setFeedback("Claim draft saved.");
    } catch (error) {
      setFeedback(
        errorsFor(error, "draft").payoutAccount ?? (
          <ErrorPresentation error={error} />
        ),
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Card variant="document">
      <CardHeader>
        <CardTitle as="h2">{t("draft.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p data-draft-status={draft?.status ?? "none"}>
          {draft
            ? t("copy.savedClaim", { status: claimStatusLabel(draft.status) })
            : t("copy.noClaim")}
        </p>
        <div id="claim-payout">
          <Label htmlFor="claim-payout-select">{t("payout.title")}</Label>
          {payout.accounts.length ? (
            <select
              id="claim-payout-select"
              data-testid="claim-payout-select"
              className="min-h-11 w-full min-w-0 rounded-sm border border-input bg-card p-2 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
              disabled={!editable || pending}
              value={payout.selectedPayoutAccountId ?? ""}
              onChange={(event) => void selectAccount(event.target.value)}
            >
              <option value="">{t("payout.selectAccount")}</option>
              {payout.accounts.map((account) => (
                <option
                  data-testid={`payout-option-${account.id}`}
                  key={account.id}
                  value={account.id}
                >
                  {account.accountHolder} · {account.iban}
                </option>
              ))}
            </select>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{t("payout.empty")}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}
          <SelectedClaimPayout payout={payout} editable={editable} />
          {editable && (
            <form
              className="grid gap-4 sm:grid-cols-2 [&>button]:justify-self-start [&>p]:col-span-full"
              onSubmit={addAccount}
              noValidate
            >
              <p>{t("payout.create")}</p>
              <FieldError message={accountErrors.account} />
              <div className="sm:col-span-2">
                <Label htmlFor="account-holder">
                  {t("payout.accountHolder")}
                </Label>
                <Input
                  variant="accounting"
                  id="account-holder"
                  data-testid="account-holder"
                  value={accountHolder}
                  onChange={(event) => setAccountHolder(event.target.value)}
                  disabled={pending}
                />
                <FieldError message={accountErrors.accountHolder} />
              </div>
              <div>
                <Label htmlFor="account-iban">{t("payout.iban")}</Label>
                <Input
                  variant="figure"
                  id="account-iban"
                  data-testid="account-iban"
                  value={iban}
                  onChange={(event) => setIban(event.target.value)}
                  disabled={pending}
                />
                <FieldError message={accountErrors.iban} />
              </div>
              <div>
                <Label htmlFor="account-bic">{t("payout.bic")}</Label>
                <Input
                  variant="figure"
                  id="account-bic"
                  value={bic}
                  onChange={(event) => setBic(event.target.value)}
                  disabled={pending}
                />
                <FieldError message={accountErrors.bic} />
              </div>
              <Button
                size="lg"
                variant="default"
                type="submit"
                disabled={pending}
                data-testid="payout-account-create"
              >
                {t("payout.create")}
              </Button>
            </form>
          )}
        </div>
        {editable && !draft && (
          <Button
            variant="default"
            size="lg"
            type="button"
            disabled={pending || !payout.selectedPayoutAccountId}
            data-testid="claim-draft-save"
            onClick={() => void saveDraft()}
          >
            {t("payout.saveDraft")}
          </Button>
        )}
        {feedback && (
          <div aria-live="polite" aria-atomic="true">
            {feedback}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ClaimWorkspace({ partnershipId }: { partnershipId: string }) {
  const t = useTranslations("claims.workspace");
  const client = useQueryClient();
  const input = { partnershipId };
  const options = { input, meta: { costTrackerORPC: true } } as const;
  const [
    draftQuery,
    payoutQuery,
    peopleQuery,
    journeysQuery,
    costsQuery,
    documentsQuery,
    previewQuery,
    historyQuery,
  ] = useSuspenseQueries({
    queries: [
      orpcQuery.claims.getDraft.queryOptions(options),
      orpcQuery.claims.listPayoutAccounts.queryOptions(options),
      orpcQuery.participations.listPartnership.queryOptions(options),
      orpcQuery.journeys.list.queryOptions(options),
      orpcQuery.costs.list.queryOptions(options),
      orpcQuery.documents.list.queryOptions(options),
      orpcQuery.claims.previewSubmission.queryOptions(options),
      orpcQuery.claims.getHistory.queryOptions(options),
    ],
  });
  const draft = draftQuery.data;
  const payout = payoutQuery.data;
  const people = peopleQuery.data;
  const journeys = journeysQuery.data;
  const costs = costsQuery.data;
  const documents = documentsQuery.data;
  const preview = previewQuery.data;
  const history = historyQuery.data;
  // The one Partner editing rule (ADR-0017), evaluated with the status the
  // server authorized: add and correct while the Claim is unsubmitted or
  // returned for correction. The screen keeps no status-to-action copy.
  const access = useParticipantEntryAccess(people.entryContext);
  const editable = access.permitted && canPartnerEditClaim(draft?.status);
  // Adding a journey needs no Claim; correcting a saved one needs the Claim that
  // records the correction, so the rule applies once a Claim exists.
  const corrections = Boolean(draft) && editable;
  const refresh = useCallback(async () => {
    const input = { partnershipId };
    await Promise.all([
      ...[
        orpcQuery.claims.getDraft,
        orpcQuery.claims.getHistory,
        orpcQuery.claims.previewSubmission,
        orpcQuery.claims.listPayoutAccounts,
        orpcQuery.journeys.list,
        orpcQuery.costs.list,
        orpcQuery.documents.list,
      ].map((query) =>
        client.invalidateQueries({ queryKey: query.queryKey({ input }) }),
      ),
      client.invalidateQueries({
        queryKey: orpcQuery.projects.get.key({ type: "query" }),
      }),
    ]);
  }, [client, partnershipId]);

  useEffect(() => {
    // History can replay the pre-mutation HTML/RSC snapshot into a new QueryClient.
    // Its hydration timestamp is not evidence that the Claim is still editable.
    const navigation = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (navigation?.type === "back_forward") void refresh();

    function revalidateRestoredPage(event: PageTransitionEvent) {
      if (event.persisted) void refresh();
    }
    window.addEventListener("pageshow", revalidateRestoredPage);
    return () => window.removeEventListener("pageshow", revalidateRestoredPage);
  }, [refresh]);

  return (
    <section className="min-w-0" aria-label={t("label")}>
      <ClaimBand title={t("bandTitle")} status={draft?.status} />
      <div className="min-w-0 border border-t-0 bg-card">
        <div
          className={
            editable && preview
              ? "grid min-w-0 min-[961px]:grid-cols-[minmax(0,1fr)_340px]"
              : "min-w-0"
          }
        >
          {editable && preview && (
            <aside
              className="min-w-0 border-b bg-muted min-[961px]:col-start-2 min-[961px]:row-start-1 min-[961px]:border-b-0 min-[961px]:border-l"
              aria-label={t("submissionLabel")}
              data-testid="claim-submission"
            >
              <ClaimSubmission
                partnershipId={partnershipId}
                preview={preview}
                refresh={refresh}
              />
            </aside>
          )}
          <div className="min-w-0 min-[961px]:col-start-1 min-[961px]:row-start-1">
            <ClaimDraftEditor
              partnershipId={partnershipId}
              draft={draft}
              payout={payout}
              editable={editable}
              refresh={refresh}
            />
            <ClaimStateNotice draft={draft} history={history} />
            {draft && !editable && (
              <Alert data-testid="claim-locked">
                <AlertDescription>
                  {t("locked")}
                  {draft.approvedAmountEur && (
                    <> {t("copy.payable", { amount: draft.approvedAmountEur })}</>
                  )}
                </AlertDescription>
              </Alert>
            )}
            <JourneyEditor
              partnershipId={partnershipId}
              participants={people.participations}
              saved={journeys}
              editable={editable}
              corrections={corrections}
              refresh={refresh}
            />
          </div>
        </div>
        {draft && (
          <>
            <CostEditor
              partnershipId={partnershipId}
              participants={people.participations}
              entries={costs.entries}
              documents={documents}
              editable={editable}
              refresh={refresh}
            />
            <ProofEditor
              partnershipId={partnershipId}
              entries={costs.entries}
              documents={documents}
              editable={editable}
              refresh={refresh}
            />
          </>
        )}

        {draft && <ClaimHistory events={history} />}
        {!draft && (
          <Alert>
            <AlertDescription>{t("noDraft")}</AlertDescription>
          </Alert>
        )}
      </div>
    </section>
  );
}
