"use client";

import { PARTICIPANT_TRANSPORT_EMISSION_PROFILES } from "@greendex/config/transport-emission-profiles";
import { ORPCError } from "@orpc/client";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";
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
    if (error.message === "This Participation already has a Participant Journey.")
      errors[root] = error.message;
    if (
      error.message === "Select a Partner Payout Account before saving the Claim."
    )
      errors.payoutAccount = error.message;
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

function JourneyEditor({
  partnershipId,
  participants,
  saved,
  editable,
  refresh,
}: {
  partnershipId: string;
  participants: Participation[];
  saved: Outputs["journeys"]["list"];
  editable: boolean;
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
    <Card>
      <CardHeader>
        <CardTitle>Participant Journeys</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {saved.length === 0 ? (
          <p>No journeys saved yet.</p>
        ) : (
          <ul>
            {saved.map((journey) => (
              <li key={journey.id}>
                {participants.find(
                  (item) => item.id === journey.projectParticipantId,
                )?.displayName ?? "Participant"}
                : {journey.origin} → {journey.destination}, {journey.tripType},{" "}
                {journey.erasmusDistanceKm} km (calculator distance; saved,
                read-only)
              </li>
            ))}
          </ul>
        )}
        {editable && (
          <form className="space-y-4" onSubmit={save} noValidate>
            <div>
              <Label htmlFor="journey-person">Participation</Label>
              <select
                id="journey-person"
                className="w-full rounded-md border bg-background p-2"
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
                id="journey-origin"
                value={origin}
                onChange={(event) => setOrigin(event.target.value)}
              />
              <FieldError message={errors.origin} />
            </div>
            <div>
              <Label htmlFor="journey-destination">Destination</Label>
              <Input
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
                className="w-full rounded-md border bg-background p-2"
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
                id="journey-distance"
                inputMode="decimal"
                value={distance}
                onChange={(event) => setDistance(event.target.value)}
              />
              <FieldError message={errors.erasmusDistanceKm} />
            </div>
            <Button type="submit" disabled={pending || !person}>
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
  editable,
  refresh,
}: {
  partnershipId: string;
  participants: Participation[];
  entries: Cost[];
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
    <Card>
      <CardHeader>
        <CardTitle>Travel Cost Entries</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {entries.length === 0 ? (
          <p>No costs saved yet.</p>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => (
              <li key={entry.id}>
                <p>
                  {entry.transportProfile}: {entry.amountEur} EUR ·{" "}
                  {entry.allocationMethod}
                </p>
                <ul>
                  {entry.allocations.map((share) => (
                    <li key={share.projectParticipantId}>
                      {participants.find(
                        (item) => item.id === share.projectParticipantId,
                      )?.displayName ?? "Participant"}
                      :{" "}
                      {entry.allocationMethod === "percentage"
                        ? `${share.percentage}%`
                        : `${share.amountEur} EUR`}
                      {entry.allocationMethod === "equal" && " (computed)"}
                    </li>
                  ))}
                </ul>
                {editable && (
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => edit(entry)}
                  >
                    Edit cost
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {editable && (
          <form className="space-y-4" onSubmit={save} noValidate>
            <p>{entryId ? "Edit saved cost" : "Add cost"}</p>
            <div>
              <Label htmlFor="cost-profile">Transport</Label>
              <select
                id="cost-profile"
                className="w-full rounded-md border bg-background p-2"
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
                className="w-full rounded-md border bg-background p-2"
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
            <Button type="submit" disabled={pending}>
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
      } else
        setFeedback(
          "Upload failed. Choose a PDF, JPEG, or PNG under 10 MB for an editable Claim.",
        );
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
    <Card>
      <CardHeader>
        <CardTitle>Proof Documents</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {documents.length === 0 ? (
          <p>No Proof Documents in this Claim.</p>
        ) : (
          <ul>
            {documents.map((document) => (
              <li key={document.id}>
                {document.originalFileName} ({document.byteSize} bytes)
              </li>
            ))}
          </ul>
        )}
        {editable && (
          <form onSubmit={upload}>
            <Label htmlFor="proof-file">
              Upload Proof Document (PDF, JPEG, PNG; up to 10 MB)
            </Label>
            <Input
              id="proof-file"
              name="file"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
            />
            <Button type="submit" disabled={busy}>
              Upload document
            </Button>
          </form>
        )}
        {progress !== null && (
          <progress value={progress} max={100} aria-label="Upload progress">
            Upload: {progress}%
          </progress>
        )}
        {feedback && <output>{feedback}</output>}
        {entries.map((entry) => (
          <div key={entry.id}>
            <p>
              {entry.transportProfile} · {entry.amountEur} EUR
            </p>
            <p>
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
                  className="w-full rounded-md border bg-background p-2"
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

export function ClaimWorkspace({ partnershipId }: { partnershipId: string }) {
  const client = useQueryClient();
  const input = { partnershipId };
  const options = { input, meta: { costTrackerORPC: true } } as const;
  const { data: draft } = useSuspenseQuery(
    orpcQuery.claims.getDraft.queryOptions(options),
  );
  const { data: payout } = useSuspenseQuery(
    orpcQuery.claims.listPayoutAccounts.queryOptions(options),
  );
  const { data: people } = useSuspenseQuery(
    orpcQuery.participations.listPartnership.queryOptions(options),
  );
  const { data: journeys } = useSuspenseQuery(
    orpcQuery.journeys.list.queryOptions(options),
  );
  const { data: costs } = useSuspenseQuery(
    orpcQuery.costs.list.queryOptions(options),
  );
  const { data: documents } = useSuspenseQuery(
    orpcQuery.documents.list.queryOptions(options),
  );
  const [feedback, setFeedback] = useState("");
  const [pending, setPending] = useState(false);
  const editable =
    !draft ||
    draft.status === "editable" ||
    draft.status === "correction_requested";
  async function refresh() {
    await Promise.all(
      [
        orpcQuery.claims.getDraft,
        orpcQuery.claims.listPayoutAccounts,
        orpcQuery.journeys.list,
        orpcQuery.costs.list,
        orpcQuery.documents.list,
      ].map((query) =>
        client.invalidateQueries({ queryKey: query.queryKey({ input }) }),
      ),
    );
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
    <section className="space-y-6" aria-label="Claim workspace">
      <Card>
        <CardHeader>
          <CardTitle>Claim draft</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            {draft
              ? `Claim ${draft.status} · saved`
              : "No Claim has been created. Opening this workspace saves nothing."}
          </p>
          <div>
            <Label htmlFor="claim-payout">Payout Account</Label>
            {payout.accounts.length ? (
              <select
                id="claim-payout"
                className="w-full rounded-md border bg-background p-2"
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
              <p>
                No Payout Accounts available. Contact your Organization admin to
                set one up.
              </p>
            )}
            {payout.selectedPayoutAccountId && (
              <p>
                Selected Payout Account:{" "}
                {payout.accounts.find(
                  (account) => account.id === payout.selectedPayoutAccountId,
                )?.accountHolder ?? "Unavailable"}
                {editable && " · change using the selector"}
              </p>
            )}
          </div>
          {editable && !draft && (
            <Button
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
      <JourneyEditor
        partnershipId={partnershipId}
        participants={people.participations}
        saved={journeys}
        editable={editable}
        refresh={refresh}
      />
      {draft && (
        <>
          <CostEditor
            partnershipId={partnershipId}
            participants={people.participations}
            entries={costs.entries}
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
      {!draft && (
        <Alert>
          <AlertDescription>
            Select a Payout Account and explicitly save a Claim draft to add costs
            or Proof Documents. Journeys can be prepared separately.
          </AlertDescription>
        </Alert>
      )}
    </section>
  );
}
