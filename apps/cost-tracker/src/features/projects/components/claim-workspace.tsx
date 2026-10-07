"use client";

import { PARTICIPANT_TRANSPORT_EMISSION_PROFILES } from "@greendex/config/transport-emission-profiles";
import { ORPCError } from "@orpc/client";
import { useQueryClient, useSuspenseQueries } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useParticipantEntryAccess } from "@/features/authentication/participant-entry-access";
import { canPartnerEditClaim } from "@/features/projects/claim-lifecycle";
import {
  ClaimBand,
  ClaimCostTable,
  PayoutAccountLines,
  claimStatusLabel,
} from "@/features/projects/components/claim-document";
import { ClaimHistory } from "@/features/projects/components/claim-review";
import { ClaimSubmission } from "@/features/projects/components/claim-submission";
import { getSafeErrorSituation } from "@/lib/orpc/error-contract";
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";
import { getErrorStatus } from "@/lib/orpc/error-status";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";
import type { Outputs } from "@/lib/orpc/router";

type Participation =
  Outputs["participations"]["listPartnership"]["participations"][number];
type Cost = Outputs["costs"]["list"]["entries"][number];
type FieldErrors = Record<string, string>;

function errorsFor(error: unknown, root: string): FieldErrors {
  const errors: FieldErrors = {};
  if (error instanceof ORPCError && error.code === "BAD_REQUEST") {
    const data: unknown = error.data;
    if (
      data &&
      typeof data === "object" &&
      "issues" in data &&
      Array.isArray(data.issues)
    ) {
      for (const issue of data.issues) {
        if (
          issue &&
          typeof issue === "object" &&
          "path" in issue &&
          Array.isArray(issue.path) &&
          "message" in issue &&
          typeof issue.message === "string"
        ) {
          const path = issue.path.map(String).join(".");
          if (path) errors[path] = issue.message;
        }
      }
    }
    const situation = getSafeErrorSituation(error);
    if (situation?.reason === "JOURNEY_ALREADY_EXISTS")
      errors[root] = situation.message;
    if (situation?.reason === "PAYOUT_ACCOUNT_REQUIRED")
      errors.payoutAccount = situation.message;
  }
  if (!Object.keys(errors).length)
    errors[root] = getORPCRequestErrorMessage(error).text;
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

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
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
  const [editing, setEditing] = useState(false);
  const [origin, setOrigin] = useState(journey.origin);
  const [destination, setDestination] = useState(journey.destination);
  const [tripType, setTripType] = useState(journey.tripType);
  const [distance, setDistance] = useState(journey.erasmusDistanceKm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const id = `correction-${journey.id}`;

  async function update(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    try {
      await orpc.journeys.update({
        partnershipId,
        projectParticipantId: journey.projectParticipantId,
        origin,
        destination,
        tripType,
        erasmusDistanceKm: distance,
      });
      await refresh();
      setEditing(false);
    } catch (error) {
      setErrors(errorsFor(error, "journey"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
      <div className="min-w-0 wrap-anywhere">
        <p className="font-semibold">{name}</p>
        <p>
          {journey.origin} → {journey.destination}
        </p>
        <p className="text-sm text-muted-foreground">
          {journey.tripType},{" "}
          <span className="font-mono">{journey.erasmusDistanceKm}</span> km
          (calculator distance)
        </p>
      </div>
      {!editing ? (
        <Button
          size="lg"
          variant="outline"
          type="button"
          onClick={() => setEditing(true)}
        >
          Correct {name}&apos;s journey
        </Button>
      ) : (
        <form className="space-y-4" onSubmit={update} noValidate>
          <FieldError message={errors.journey} />
          <div>
            <Label htmlFor={`${id}-origin`}>Origin for {name}</Label>
            <Input
              variant="accounting"
              id={`${id}-origin`}
              value={origin}
              onChange={(event) => setOrigin(event.target.value)}
            />
            <FieldError message={errors.origin} />
          </div>
          <div>
            <Label htmlFor={`${id}-destination`}>Destination for {name}</Label>
            <Input
              variant="accounting"
              id={`${id}-destination`}
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
            />
            <FieldError message={errors.destination} />
          </div>
          <div>
            <Label htmlFor={`${id}-type`}>Trip type for {name}</Label>
            <select
              id={`${id}-type`}
              className="min-h-11 w-full min-w-0 rounded-sm border border-input bg-card p-2 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
              value={tripType}
              onChange={(event) =>
                setTripType(event.target.value as typeof tripType)
              }
            >
              <option value="one-way">One-way</option>
              <option value="round-trip">Round-trip</option>
            </select>
            <FieldError message={errors.tripType} />
          </div>
          <div>
            <Label htmlFor={`${id}-distance`}>
              Erasmus Distance-Calculator distance (km) for {name}
            </Label>
            <Input
              variant="accounting"
              id={`${id}-distance`}
              inputMode="decimal"
              value={distance}
              onChange={(event) => setDistance(event.target.value)}
            />
            <FieldError message={errors.erasmusDistanceKm} />
          </div>
          <Button size="lg" variant="default" type="submit" disabled={pending}>
            Save correction
          </Button>
          <Button
            variant="default"
            size="lg"
            type="button"
            disabled={pending}
            onClick={() => {
              setOrigin(journey.origin);
              setDestination(journey.destination);
              setTripType(journey.tripType);
              setDistance(journey.erasmusDistanceKm);
              setErrors({});
              setEditing(false);
            }}
          >
            Cancel
          </Button>
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
  const [person, setPerson] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [tripType, setTripType] = useState<"one-way" | "round-trip">("one-way");
  const [distance, setDistance] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const existing = new Set(saved.map((journey) => journey.projectParticipantId));
  async function save(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    try {
      await orpc.journeys.save({
        partnershipId,
        projectParticipantId: person,
        origin,
        destination,
        tripType,
        erasmusDistanceKm: distance,
      });
      setPerson("");
      setOrigin("");
      setDestination("");
      setDistance("");
      await refresh();
    } catch (error) {
      setErrors(errorsFor(error, "projectParticipantId"));
    } finally {
      setPending(false);
    }
  }
  return (
    <Card variant="document">
      <CardHeader>
        <CardTitle as="h2">Participant Journeys</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5" id="claim-journeys">
        {saved.length === 0 ? (
          <p>No journeys saved yet.</p>
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
                    )?.displayName ?? "Participant"}
                    : {journey.origin} → {journey.destination}, {journey.tripType}
                    , {journey.erasmusDistanceKm} km (calculator distance; saved,
                    read-only)
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {participants.some((item) => !existing.has(item.id)) && (
          <ul aria-label="Participations needing Journeys">
            {participants
              .filter((item) => !existing.has(item.id))
              .map((item) => (
                <li key={item.id} id={`journey-gap-${item.id}`}>
                  {item.displayName}: no Participant Journey saved.
                </li>
              ))}
          </ul>
        )}
        {editable && (
          <form
            className="grid gap-4 sm:grid-cols-2 [&>button]:justify-self-start [&>fieldset]:col-span-full [&>p]:col-span-full"
            onSubmit={save}
            noValidate
          >
            <div>
              <Label htmlFor="journey-person">Participation</Label>
              <select
                id="journey-person"
                className="min-h-11 w-full min-w-0 rounded-sm border border-input bg-card p-2 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
                value={person}
                onChange={(event) => setPerson(event.target.value)}
              >
                <option value="">Select Participation</option>
                {participants
                  .filter((item) => !existing.has(item.id))
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.displayName}
                    </option>
                  ))}
              </select>
              <FieldError message={errors.projectParticipantId} />
            </div>
            <div>
              <Label htmlFor="journey-origin">Origin</Label>
              <Input
                variant="accounting"
                id="journey-origin"
                value={origin}
                onChange={(event) => setOrigin(event.target.value)}
              />
              <FieldError message={errors.origin} />
            </div>
            <div>
              <Label htmlFor="journey-destination">Destination</Label>
              <Input
                variant="accounting"
                id="journey-destination"
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
              />
              <FieldError message={errors.destination} />
            </div>
            <div>
              <Label htmlFor="journey-type">Trip type</Label>
              <select
                id="journey-type"
                className="min-h-11 w-full min-w-0 rounded-sm border border-input bg-card p-2 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
                value={tripType}
                onChange={(event) =>
                  setTripType(event.target.value as typeof tripType)
                }
              >
                <option value="one-way">One-way</option>
                <option value="round-trip">Round-trip</option>
              </select>
              <FieldError message={errors.tripType} />
            </div>
            <div>
              <Label htmlFor="journey-distance">
                Erasmus Distance-Calculator distance (km)
              </Label>
              <Input
                variant="figure"
                id="journey-distance"
                inputMode="decimal"
                value={distance}
                onChange={(event) => setDistance(event.target.value)}
              />
              <FieldError message={errors.erasmusDistanceKm} />
            </div>
            <Button
              size="lg"
              variant="default"
              type="submit"
              disabled={pending || !person}
            >
              Save journey
            </Button>
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
  const [entryId, setEntryId] = useState<string>();
  const [profile, setProfile] = useState<string>(
    PARTICIPANT_TRANSPORT_EMISSION_PROFILES[0],
  );
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"equal" | "percentage" | "amount">(
    "equal",
  );
  const [shares, setShares] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  function edit(entry: Cost) {
    setEntryId(entry.id);
    setProfile(entry.transportProfile);
    setAmount(entry.amountEur);
    setMethod(entry.allocationMethod);
    setSelected(entry.allocations.map((item) => item.projectParticipantId));
    setShares(
      Object.fromEntries(
        entry.allocations.map((item) => [
          item.projectParticipantId,
          entry.allocationMethod === "percentage"
            ? (item.percentage ?? "")
            : entry.allocationMethod === "amount"
              ? (item.amountEur ?? "")
              : "",
        ]),
      ),
    );
    setErrors({});
  }
  async function save(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    try {
      await orpc.costs.save({
        partnershipId,
        entryId,
        transportProfile: profile,
        amountEur: amount,
        allocationMethod: method,
        allocations: selected.map((id) => ({
          projectParticipantId: id,
          ...(method === "percentage"
            ? { percentage: shares[id] ?? "" }
            : method === "amount"
              ? { amountEur: shares[id] ?? "" }
              : {}),
        })),
      });
      setEntryId(undefined);
      setAmount("");
      setSelected([]);
      setShares({});
      await refresh();
    } catch (error) {
      setErrors(errorsFor(error, "allocations"));
    } finally {
      setPending(false);
    }
  }
  return (
    <Card variant="document">
      <CardHeader>
        <CardTitle as="h2">Travel Cost Entries</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5" id="claim-costs">
        {entries.length === 0 ? (
          <p>No costs saved yet.</p>
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
                    <li key={share.projectParticipantId}>
                      {participants.find(
                        (item) => item.id === share.projectParticipantId,
                      )?.displayName ?? "Participant"}
                      :{" "}
                      <span className="font-mono tabular-nums">
                        {entry.allocationMethod === "percentage"
                          ? `${share.percentage}%`
                          : `${share.amountEur} EUR`}
                      </span>
                      {entry.allocationMethod === "equal" && " (computed)"}
                    </li>
                  ))}
                </ul>
              ),
              documents: entry.proofDocumentIds.length ? (
                <ul className="space-y-2">
                  {entry.proofDocumentIds.map((id) => (
                    <li key={id}>
                      {documents.find((document) => document.id === id)
                        ?.originalFileName ?? "Document"}
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
                  Edit cost
                </Button>
              ) : undefined,
            }))}
          />
        )}
        {editable && (
          <form
            className="grid gap-4 sm:grid-cols-2 [&>button]:justify-self-start [&>fieldset]:col-span-full [&>p]:col-span-full"
            onSubmit={save}
            noValidate
          >
            <p>{entryId ? "Edit saved cost" : "Add cost"}</p>
            <div>
              <Label htmlFor="cost-profile">Transport</Label>
              <select
                id="cost-profile"
                className="min-h-11 w-full min-w-0 rounded-sm border border-input bg-card p-2 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
                value={profile}
                onChange={(event) => setProfile(event.target.value)}
              >
                {PARTICIPANT_TRANSPORT_EMISSION_PROFILES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <FieldError message={errors.transportProfile} />
            </div>
            <div>
              <Label htmlFor="cost-amount">Exact total (EUR)</Label>
              <Input
                variant="figure"
                id="cost-amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <FieldError message={errors.amountEur} />
            </div>
            <div>
              <Label htmlFor="cost-method">Allocation method</Label>
              <select
                id="cost-method"
                className="min-h-11 w-full min-w-0 rounded-sm border border-input bg-card p-2 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
                value={method}
                onChange={(event) =>
                  setMethod(event.target.value as typeof method)
                }
              >
                <option value="equal">Equal</option>
                <option value="percentage">Percentage</option>
                <option value="amount">Amount (EUR)</option>
              </select>
              <FieldError message={errors.allocationMethod} />
            </div>
            <fieldset className="space-y-2">
              <legend>Covered Participations</legend>
              {participants.map((item) => {
                const index = selected.indexOf(item.id);
                return (
                  <div key={item.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={index !== -1}
                        onChange={(event) =>
                          setSelected((old) =>
                            event.target.checked
                              ? [...old, item.id]
                              : old.filter((id) => id !== item.id),
                          )
                        }
                      />{" "}
                      {item.displayName}
                    </label>
                    {index !== -1 && (
                      <FieldError
                        message={
                          errors[`allocations.${index}.projectParticipantId`] ??
                          (method === "equal"
                            ? errors[`allocations.${index}`]
                            : undefined)
                        }
                      />
                    )}
                    {index !== -1 && method !== "equal" && (
                      <div>
                        <Label htmlFor={`share-${item.id}`}>
                          {item.displayName}{" "}
                          {method === "percentage" ? "percentage" : "EUR share"}
                        </Label>
                        <Input
                          variant="figure"
                          id={`share-${item.id}`}
                          inputMode="decimal"
                          value={shares[item.id] ?? ""}
                          onChange={(event) =>
                            setShares((old) => ({
                              ...old,
                              [item.id]: event.target.value,
                            }))
                          }
                        />
                        <FieldError
                          message={
                            errors[
                              `allocations.${index}.${method === "percentage" ? "percentage" : "amountEur"}`
                            ] ?? errors[`allocations.${index}`]
                          }
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              <FieldError message={errors.allocations} />
            </fieldset>
            <p aria-live="polite">
              {method === "equal"
                ? `Equal split across ${selected.length} Participations; exact EUR shares computed by the server after save.`
                : `Entered shares total: ${enteredShareTotal(
                    selected.map((id) => shares[id] || "0"),
                    method,
                  )} ${method === "percentage" ? "% of 100%" : `EUR of ${amount || "0"} EUR`} (display only; server validates)`}
            </p>
            <Button size="lg" variant="default" type="submit" disabled={pending}>
              Save cost
            </Button>
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
  const [progress, setProgress] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
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
        let text = "Upload failed. Please try again.";
        try {
          const body: unknown = JSON.parse(request.responseText);
          if (
            body &&
            typeof body === "object" &&
            "code" in body &&
            typeof body.code === "string" &&
            "reason" in body
          ) {
            const situation = getSafeErrorSituation({
              code: body.code,
              data: { reason: body.reason },
            });
            if (situation && getErrorStatus(situation.code) === request.status)
              text = situation.message;
          }
        } catch {
          // A malformed response must not expose remote prose or guessed causes.
        }
        setFeedback(text);
      }
    };
    request.onerror = () => {
      setBusy(false);
      setFeedback("Upload failed. Please try again.");
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
      setFeedback(getORPCRequestErrorMessage(error).text);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card variant="document">
      <CardHeader>
        <CardTitle as="h2">Proof Documents</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4" id="claim-proofs">
        {documents.length === 0 ? (
          <p>No Proof Documents in this Claim.</p>
        ) : (
          <ul>
            {documents.map((document) => (
              <li key={document.id} className="wrap-anywhere">
                {document.originalFileName} ({document.byteSize} bytes)
              </li>
            ))}
          </ul>
        )}
        {editable && (
          <form className="space-y-4" onSubmit={upload}>
            <Label htmlFor="proof-file">
              Upload Proof Document (PDF, JPEG, PNG; up to 10 MB)
            </Label>
            <Input
              variant="accounting"
              id="proof-file"
              name="file"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
            />
            <Button size="lg" variant="default" type="submit" disabled={busy}>
              Upload document
            </Button>
          </form>
        )}
        {progress !== null && (
          <progress
            className="w-full accent-primary"
            value={progress}
            max={100}
            aria-label="Upload progress"
          >
            Upload: {progress}%
          </progress>
        )}
        {feedback && <output>{feedback}</output>}
        {entries.map((entry) => (
          <div key={entry.id} id={`proof-${entry.id}`}>
            <p>
              {entry.transportProfile}{" "}
              <span className="font-mono tabular-nums">
                {entry.amountEur} EUR
              </span>
            </p>
            <p className="wrap-anywhere">
              Linked:{" "}
              {entry.proofDocumentIds
                .map(
                  (id) =>
                    documents.find((document) => document.id === id)
                      ?.originalFileName ?? "Document",
                )
                .join(", ") || "None"}
            </p>
            {editable && (
              <div>
                <Label htmlFor={`link-${entry.id}`}>
                  Link a Proof Document to this cost
                </Label>
                <select
                  id={`link-${entry.id}`}
                  className="min-h-11 w-full min-w-0 rounded-sm border border-input bg-card p-2 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  disabled={busy}
                  defaultValue=""
                  onChange={(event) => {
                    if (event.target.value)
                      void link(entry.id, event.target.value);
                    event.target.value = "";
                  }}
                >
                  <option value="">Select Claim document</option>
                  {documents
                    .filter(
                      (document) => !entry.proofDocumentIds.includes(document.id),
                    )
                    .map((document) => (
                      <option key={document.id} value={document.id}>
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
  const account = payout.accounts.find(
    (item) => item.id === payout.selectedPayoutAccountId,
  );
  if (!payout.selectedPayoutAccountId) return null;
  return account ? (
    <div className="my-5 space-y-3">
      <p>Selected Payout Account:{editable && " change using the selector"}</p>
      <PayoutAccountLines account={account} />
    </div>
  ) : (
    <p>
      Selected Payout Account: Unavailable
      {editable && " · change using the selector"}
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
  if (!draft) return null;
  if (draft.status === "correction_requested")
    return (
      <Alert>
        <AlertDescription>
          Correction requested:{" "}
          {history.findLast((event) => event.eventType === "correction_requested")
            ?.reason ?? "See Claim history for the correction request."}
          <p>
            Correct the Claim data and Proof Documents, then resubmit for Hosting
            review.
          </p>
        </AlertDescription>
      </Alert>
    );
  if (draft.status === "rejected")
    return (
      <Alert>
        <AlertDescription>
          Rejected:{" "}
          {history.findLast((event) => event.eventType === "rejected")?.reason ??
            "See Claim history for the rejection reason."}
          <p>
            This Claim is locked and unpaid. Only Hosting staff may reopen it;
            reopening does not unlock Partner edits.
          </p>
        </AlertDescription>
      </Alert>
    );
  if (draft.status === "approved")
    return (
      <Alert>
        <AlertDescription>
          Approved · unpaid. The full transfer has not been recorded.
        </AlertDescription>
      </Alert>
    );
  if (draft.status === "paid")
    return (
      <Alert>
        <AlertDescription>
          Paid. The full transfer was recorded separately from approval.
        </AlertDescription>
      </Alert>
    );
  return null;
}

export function ClaimWorkspace({ partnershipId }: { partnershipId: string }) {
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
  const [feedback, setFeedback] = useState("");
  const [pending, setPending] = useState(false);
  const [accountHolder, setAccountHolder] = useState("");
  const [iban, setIban] = useState("");
  const [bic, setBic] = useState("");
  const [accountErrors, setAccountErrors] = useState<FieldErrors>({});
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
    await Promise.all(
      [
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
    );
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
      setFeedback(getORPCRequestErrorMessage(error).text);
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
        errorsFor(error, "draft").payoutAccount ??
          getORPCRequestErrorMessage(error).text,
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="min-w-0" aria-label="Claim workspace">
      <ClaimBand title="Claim workspace" status={draft?.status} />
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
              aria-label="Submission"
            >
              <ClaimSubmission
                partnershipId={partnershipId}
                preview={preview}
                refresh={refresh}
              />
            </aside>
          )}
          <div className="min-w-0 min-[961px]:col-start-1 min-[961px]:row-start-1">
            <Card variant="document">
              <CardHeader>
                <CardTitle as="h2">Claim draft</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  {draft
                    ? `Claim ${claimStatusLabel(draft.status)} / saved`
                    : "No Claim has been created. Opening this workspace saves nothing."}
                </p>
                <div id="claim-payout">
                  <Label htmlFor="claim-payout-select">Payout Account</Label>
                  {payout.accounts.length ? (
                    <select
                      id="claim-payout-select"
                      className="min-h-11 w-full min-w-0 rounded-sm border border-input bg-card p-2 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
                      disabled={!editable || pending}
                      value={payout.selectedPayoutAccountId ?? ""}
                      onChange={(event) => void selectAccount(event.target.value)}
                    >
                      <option value="">Select account</option>
                      {payout.accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.accountHolder} · {account.iban}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p>No Payout Accounts available. Create one below.</p>
                  )}
                  <SelectedClaimPayout payout={payout} editable={editable} />
                  {editable && (
                    <form
                      className="grid gap-4 sm:grid-cols-2 [&>button]:justify-self-start [&>p]:col-span-full"
                      onSubmit={addAccount}
                      noValidate
                    >
                      <p>Create Payout Account</p>
                      <FieldError message={accountErrors.account} />
                      <div className="sm:col-span-2">
                        <Label htmlFor="account-holder">Account holder</Label>
                        <Input
                          variant="accounting"
                          id="account-holder"
                          value={accountHolder}
                          onChange={(event) =>
                            setAccountHolder(event.target.value)
                          }
                          disabled={pending}
                        />
                        <FieldError message={accountErrors.accountHolder} />
                      </div>
                      <div>
                        <Label htmlFor="account-iban">IBAN</Label>
                        <Input
                          variant="figure"
                          id="account-iban"
                          value={iban}
                          onChange={(event) => setIban(event.target.value)}
                          disabled={pending}
                        />
                        <FieldError message={accountErrors.iban} />
                      </div>
                      <div>
                        <Label htmlFor="account-bic">BIC (optional)</Label>
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
                      >
                        Create Payout Account
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
                    onClick={() => void saveDraft()}
                  >
                    Save Claim draft
                  </Button>
                )}
                {feedback && <output>{feedback}</output>}
              </CardContent>
            </Card>
            <ClaimStateNotice draft={draft} history={history} />
            {draft && !editable && (
              <Alert>
                <AlertDescription>
                  This Claim is locked for Partner editing. Only a Hosting-side
                  correction request can reopen it.
                  {draft.approvedAmountEur &&
                    ` Calculated payable: ${draft.approvedAmountEur} EUR (computed by the server).`}
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
            <AlertDescription>
              Select a Payout Account and explicitly save a Claim draft to add
              costs or Proof Documents. Journeys can be prepared separately.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </section>
  );
}
