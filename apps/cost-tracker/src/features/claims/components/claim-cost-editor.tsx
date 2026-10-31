"use client";

import { PARTICIPANT_TRANSPORT_EMISSION_PROFILES } from "@greendex/config/transport-emission-profiles";
import { useTranslations } from "@greendex/i18n/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

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
import { ClaimCostTable } from "@/features/claims/components/claim-document";
import { CostSaveInputSchema } from "@/features/claims/cost-validation";
import { getORPCErrorPresentation } from "@/lib/orpc/error-message";
import { orpc } from "@/lib/orpc/orpc";
import type { Outputs } from "@/lib/orpc/router";

type Participation =
  Outputs["participations"]["listPartnership"]["participations"][number];
type Cost = Outputs["costs"]["list"]["entries"][number];

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

export function CostEditor({
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
                  const shareError =
                    rowError?.percentage ||
                    rowError?.amountEur ||
                    rowError?.message;
                  const shareMessage = [
                    rowError?.percentage?.message,
                    rowError?.amountEur?.message,
                    rowError?.message,
                  ].find((message) => message != null);
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
                        <Field data-invalid={!!shareError}>
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
                            aria-invalid={!!shareError}
                            aria-describedby={
                              shareError ? `share-${item.id}-error` : undefined
                            }
                            {...register(
                              `allocations.${index}.${method === "percentage" ? "percentage" : "amountEur"}`,
                            )}
                          />
                          {shareError && (
                            <FormFieldError id={`share-${item.id}-error`}>
                              <FieldErrorMessage message={shareMessage} />
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
