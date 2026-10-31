"use client";

import { useTranslations } from "@greendex/i18n/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import {
  ErrorPresentation,
  FieldErrorMessage,
} from "@/components/error-presentation/error-presentation";
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
import { JourneyInputSchema } from "@/features/participations/validation-schemas";
import { getORPCErrorPresentation } from "@/lib/orpc/error-message";
import { orpc } from "@/lib/orpc/orpc";
import type { Outputs } from "@/lib/orpc/router";

type Participation =
  Outputs["participations"]["listPartnership"]["participations"][number];

function JourneyCorrection({
  partnershipId,
  journey,
  name,
  refresh,
  t,
}: {
  t: ReturnType<typeof useTranslations<"claims.workspace">>;
  partnershipId: string;
  journey: Outputs["journeys"]["list"][number];
  name: string;
  refresh: () => Promise<void>;
}) {
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

export function JourneyEditor({
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
                    t={t}
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
