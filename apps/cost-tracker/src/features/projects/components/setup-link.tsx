"use client";

import { EU_COUNTRIES, type EUCountryCode } from "@greendex/config/eu-countries";
import { ORPCError } from "@orpc/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type SyntheticEvent,
} from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { slugifyOrganizationName } from "@/features/organizations/slug";
import { EntityCombobox } from "@/features/projects/components/entity-combobox";
import { authClient } from "@/lib/auth-client";
import { getSafeErrorSituation } from "@/lib/orpc/error-contract";
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";
import { createSituationErrors } from "@/lib/orpc/errors";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";

const searchHosted = (search: string) => orpc.projects.searchHosted({ search });
const searchOwnedOrganizations = (search: string) =>
  orpc.organizations.listMine({ search });

type SetupError =
  | "invalid"
  | "disabled"
  | "expired"
  | "wrong-email"
  | "verify-email"
  | "duplicate"
  | "owner"
  | "unavailable"
  | "host"
  | "create"
  | "generic";

// Local presentation is selected only by validated code/status/reason metadata.
const knownErrors: Readonly<Record<string, SetupError>> = {
  SETUP_LINK_NOT_FOUND: "invalid",
  SETUP_LINK_DISABLED: "disabled",
  SETUP_LINK_EXPIRED: "expired",
  SETUP_LINK_WRONG_EMAIL: "wrong-email",
  SETUP_LINK_USED: "duplicate",
  PARTNERSHIP_ALREADY_ASSIGNED: "duplicate",
  ORGANIZATION_OWNER_REQUIRED: "owner",
  PROJECT_NOT_FOUND: "unavailable",
  SELF_PARTNERSHIP: "host",
  EMAIL_VERIFICATION_REQUIRED: "verify-email",
};

const errorCopy: Record<SetupError, { title: string; description: string }> = {
  invalid: {
    title: "Invalid setup link",
    description: "Check that you opened the complete link shared with you.",
  },
  disabled: {
    title: "Disabled setup link",
    description: "Ask the Hosting Organization for a new link.",
  },
  expired: {
    title: "Expired setup link",
    description: "Ask the Hosting Organization for a new link.",
  },
  "wrong-email": {
    title: "Wrong email address",
    description:
      "Sign in with the verified recipient email address and try again.",
  },
  "verify-email": {
    title: "Verify your email",
    description: "Verify your recipient email address before completing setup.",
  },
  duplicate: {
    title: "Setup already completed",
    description:
      "This Project Partnership cannot be set up again. Contact the Hosting Organization if you need help.",
  },
  owner: {
    title: "Owner verification required",
    description:
      "You must be an Owner of the selected Organization. Choose an Organization you own or ask its Owner to complete setup.",
  },
  unavailable: {
    title: "Project unavailable",
    description:
      "Ask the Hosting Organization whether this Project is still accepting partners.",
  },
  host: {
    title: "Invalid Partner Organization",
    description:
      "Choose a different Organization from the Project's Hosting Organization.",
  },
  create: {
    title: "Could not create Organization",
    description:
      "An Organization with this name may already exist, or your account may already belong to one. Choose an existing Organization or try another name.",
  },
  generic: {
    title: "Could not complete setup",
    description: "Please try again or contact the Hosting Organization.",
  },
};

function setupError(error: unknown): SetupError {
  if (error instanceof ORPCError) {
    const situation = getSafeErrorSituation(error);
    return situation ? (knownErrors[situation.reason] ?? "generic") : "generic";
  }
  return "generic";
}

function SetupStatus({ state }: { state: SetupError }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>{errorCopy[state].title}</AlertTitle>
      <AlertDescription>{errorCopy[state].description}</AlertDescription>
    </Alert>
  );
}

export function SetupLinkCreator() {
  const client = useQueryClient();
  const existingLinks = useQuery(
    orpcQuery.projectPartnerships.listSetupLinks.queryOptions({
      meta: { costTrackerORPC: true },
    }),
  );
  const [closingId, setClosingId] = useState<string>();
  const refreshLinks = () =>
    client.invalidateQueries({
      queryKey: orpcQuery.projectPartnerships.listSetupLinks.key({
        type: "query",
      }),
    });
  async function closeLink(id: string) {
    setError("");
    setClosingId(id);
    try {
      await orpc.projectPartnerships.disableSetupLink({ id });
      await refreshLinks();
    } catch (cause) {
      setError(getORPCRequestErrorMessage(cause).text);
    } finally {
      setClosingId(undefined);
    }
  }
  const [projectId, setProjectId] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);

  async function create(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setLink("");
    setCopied(false);
    setError("");
    setPending(true);
    try {
      const result = await orpc.projectPartnerships.createSetupLink({
        projectId,
        recipientEmail,
      });
      const url = new URL(
        `/setup-links/${encodeURIComponent(result.id)}`,
        window.location.origin,
      );
      url.searchParams.set("secret", result.secret);
      setLink(url.toString());
      await refreshLinks();
    } catch (cause) {
      setError(getORPCRequestErrorMessage(cause).text);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Partner Organization Setup Link</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p>
          Share this recipient-bound link privately. It does not grant Hosting
          Organization membership.
        </p>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={create}>
          <div className="space-y-2">
            <span className="text-sm font-medium">Hosted Project</span>
            <EntityCombobox
              label="Hosted Project"
              value={projectId}
              onChange={setProjectId}
              search={searchHosted}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="setup-email">Recipient email</Label>
            <Input
              id="setup-email"
              required
              type="email"
              value={recipientEmail}
              onChange={(event) => setRecipientEmail(event.target.value)}
            />
          </div>
          <div>
            <Button disabled={pending || !projectId} type="submit">
              {pending ? "Neuer Link…" : "Neuer Link"}
            </Button>
          </div>
        </form>
        {error && <p role="alert">{error}</p>}
        <section
          aria-label="Existing Partner Organization Setup Links"
          className="space-y-3"
        >
          <h3 className="font-semibold">
            Existing Partner Organization Setup Links
          </h3>
          <p>
            Only the newly created link can be copied. Existing link secrets are
            not stored.
          </p>
          {existingLinks.isPending ? (
            <output>Loading Partner Organization Setup Links…</output>
          ) : existingLinks.isError ? (
            <Alert variant="destructive">
              <AlertTitle>
                Unable to load Partner Organization Setup Links
              </AlertTitle>
              <AlertDescription>
                {getORPCRequestErrorMessage(existingLinks.error).text}
              </AlertDescription>
              <Button
                type="button"
                variant="outline"
                onClick={() => void existingLinks.refetch()}
              >
                Retry
              </Button>
            </Alert>
          ) : existingLinks.data.length === 0 ? (
            <p>No Partner Organization Setup Links yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hosted Project</TableHead>
                  <TableHead>Recipient email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {existingLinks.data.map((existing) => (
                  <TableRow key={existing.id} data-setup-link-id={existing.id}>
                    <TableCell>{existing.projectName}</TableCell>
                    <TableCell>{existing.recipientEmail}</TableCell>
                    <TableCell>
                      {!existing.enabled
                        ? "Closed"
                        : existing.consumedAt
                          ? "Used"
                          : existing.expired
                            ? "Expired"
                            : "Open"}
                    </TableCell>
                    <TableCell>
                      {existing.expiresAt.toISOString().slice(0, 10)}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!existing.enabled || !!closingId}
                        onClick={() => void closeLink(existing.id)}
                      >
                        {closingId === existing.id
                          ? "Closing…"
                          : "Close Partner Organization Setup Link"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
        {link && (
          <div className="space-y-2">
            <Label htmlFor="recipient-link">Recipient setup link</Label>
            <Input id="recipient-link" readOnly value={link} />
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setCopied(true);
                } catch {
                  setError(
                    "Could not copy the link. Select and copy it manually.",
                  );
                }
              }}
            >
              Kopieren
            </Button>
            {copied && (
              <output>
                Link kopiert. Teilen Sie ihn nur mit der eingeladenen Person.
              </output>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type RecoveryCheckpoint =
  | { phase: "creating" }
  | { phase: "created" | "selected"; organizationId: string };
type Eligibility = Awaited<
  ReturnType<typeof orpc.projectPartnerships.getSetupLinkEligibility>
>;
type CompletedSetup = Extract<Eligibility, { status: "redeemed" }>;
type RecipientState =
  | { phase: "checking" }
  | { phase: "ready"; recovery?: RecoveryCheckpoint; error?: SetupError }
  | { phase: "inspect"; recovery?: RecoveryCheckpoint }
  | { phase: "refused"; error: SetupError; recovery?: RecoveryCheckpoint }
  | { phase: "completed"; result: CompletedSetup };

function readRecovery(key: string): RecoveryCheckpoint | undefined {
  const raw = localStorage.getItem(key);
  if (!raw) return undefined;
  const value: unknown = JSON.parse(raw);
  if (typeof value !== "object" || value === null || !("phase" in value))
    throw createSituationErrors().internalFailure();
  if (value.phase === "creating") return { phase: "creating" };
  if (
    (value.phase === "created" || value.phase === "selected") &&
    "organizationId" in value &&
    typeof value.organizationId === "string" &&
    value.organizationId
  )
    return { phase: value.phase, organizationId: value.organizationId };
  throw createSituationErrors().internalFailure();
}

type SetupChoice =
  | { kind: "new"; name: string; country: EUCountryCode | "" }
  | { kind: "existing"; organizationId: string };

function SetupOrganizationForm({
  recovery,
  pending,
  error,
  onConsume,
}: {
  recovery?: RecoveryCheckpoint;
  pending: boolean;
  error?: SetupError;
  onConsume: (choice: SetupChoice) => Promise<void>;
}) {
  const [kind, setKind] = useState<"new" | "existing">("new");
  const [name, setName] = useState("");
  const [country, setCountry] = useState<EUCountryCode | "">("");
  const [organizationId, setOrganizationId] = useState(
    recovery?.phase === "selected" ? recovery.organizationId : "",
  );
  const existing =
    kind === "existing" ||
    recovery?.phase === "creating" ||
    recovery?.phase === "selected";
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onConsume(
          existing
            ? { kind: "existing", organizationId }
            : { kind: "new", name, country },
        );
      }}
    >
      <FieldGroup>
        {!recovery && (
          <fieldset disabled={pending} className="flex flex-col gap-3">
            <legend>Choose an Organization</legend>
            <label className="flex items-center gap-2">
              <input
                checked={kind === "new"}
                name="setup-kind"
                onChange={() => setKind("new")}
                type="radio"
              />
              New Organization
            </label>
            <label className="flex items-center gap-2">
              <input
                checked={kind === "existing"}
                name="setup-kind"
                onChange={() => setKind("existing")}
                type="radio"
              />
              Existing Organization
            </label>
          </fieldset>
        )}
        {recovery?.phase === "created" ? null : existing ? (
          <Field>
            <span className="text-sm font-medium">Organization</span>
            <EntityCombobox
              label="Organization"
              value={organizationId}
              onChange={setOrganizationId}
              search={searchOwnedOrganizations}
            />
            <p>
              Only an Owner of this Organization can complete setup. Ownership is
              verified by the server when you submit.
            </p>
          </Field>
        ) : (
          <>
            <Field>
              <FieldLabel htmlFor="setup-name">New Organization name</FieldLabel>
              <Input
                id="setup-name"
                disabled={pending}
                maxLength={100}
                minLength={2}
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="setup-country">
                Organization country
              </FieldLabel>
              <select
                id="setup-country"
                value={country}
                required
                disabled={pending}
                onChange={(event) =>
                  setCountry(event.target.value as EUCountryCode)
                }
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Select an EU country
                </option>
                {EU_COUNTRIES.map(({ code }) => (
                  <option key={code} value={code}>
                    {new Intl.DisplayNames(["en"], {
                      type: "region",
                    }).of(code)}
                  </option>
                ))}
              </select>
              <p>
                This creates your Organization through the normal setup flow and
                makes you its Owner, then connects it to the Project.
              </p>
            </Field>
          </>
        )}
        <Button
          disabled={
            pending ||
            (recovery?.phase === "created"
              ? false
              : existing
                ? !organizationId
                : !slugifyOrganizationName(name) || !country)
          }
          type="submit"
        >
          {pending
            ? "Completing…"
            : recovery?.phase === "created"
              ? "Retry setup with retained Organization"
              : "Complete setup"}
        </Button>
      </FieldGroup>
      {error && <SetupStatus state={error} />}
    </form>
  );
}

export function SetupLinkRecipient({
  id,
  secret,
  userId,
}: {
  id: string;
  secret?: string;
  userId: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [state, setState] = useState<RecipientState>({ phase: "checking" });
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [selecting, startSelection] = useTransition();
  const [selected, setSelected] = useState(false);
  const [selectionError, setSelectionError] = useState(false);
  const recoveryKey = `partner-setup:${userId}:${id}`;

  useEffect(() => {
    let cancelled = false;
    async function inspect() {
      if (!secret) return;
      let recovery: RecoveryCheckpoint | undefined;
      try {
        recovery = readRecovery(recoveryKey);
      } catch {
        recovery = { phase: "creating" };
      }
      try {
        const result = await orpc.projectPartnerships.getSetupLinkEligibility({
          id,
          secret,
        });
        if (!cancelled)
          setState(
            result.status === "redeemed"
              ? { phase: "completed", result }
              : { phase: "ready", recovery },
          );
      } catch (cause) {
        if (!cancelled)
          setState({ phase: "refused", error: setupError(cause), recovery });
      }
    }
    void inspect();
    return () => {
      cancelled = true;
    };
  }, [id, secret, recoveryKey]);

  async function consume(choice: SetupChoice) {
    if (!secret || busy.current || state.phase !== "ready") return;
    busy.current = true;
    setPending(true);
    let recovery = state.recovery;
    try {
      const result = await orpc.projectPartnerships.getSetupLinkEligibility({
        id,
        secret,
      });
      if (result.status === "redeemed") {
        setState({ phase: "completed", result });
        return;
      }
      let targetId =
        recovery?.phase === "created"
          ? recovery.organizationId
          : choice.kind === "existing"
            ? choice.organizationId
            : "";
      if (!recovery && choice.kind === "new") {
        if (!choice.country) return;
        try {
          localStorage.setItem(
            recoveryKey,
            JSON.stringify({ phase: "creating" }),
          );
        } catch {
          setState({ phase: "ready", error: "create" });
          return;
        }
        recovery = { phase: "creating" };
        setState({ phase: "ready", recovery });
        try {
          const created = await orpc.authentication.createOrganization({
            country: choice.country,
            name: choice.name.trim(),
            slug: slugifyOrganizationName(choice.name.trim()),
          });
          targetId = created.organizationId;
          recovery = { phase: "created", organizationId: targetId };
          setState({ phase: "ready", recovery });
          localStorage.setItem(recoveryKey, JSON.stringify(recovery));
        } catch (cause) {
          if (
            cause instanceof ORPCError &&
            getSafeErrorSituation(cause)?.reason ===
              "ORGANIZATION_SLUG_TAKEN_BEFORE_CREATION"
          ) {
            localStorage.removeItem(recoveryKey);
            recovery = undefined;
          }
          setState({ phase: "ready", recovery, error: "create" });
          return;
        }
      }
      if (!targetId) return;
      recovery = {
        phase: recovery?.phase === "created" ? "created" : "selected",
        organizationId: targetId,
      };
      localStorage.setItem(recoveryKey, JSON.stringify(recovery));
      try {
        const redeemed = await orpc.projectPartnerships.consumeSetupLink({
          id,
          secret,
          organizationId: targetId,
        });
        setState({
          phase: "completed",
          result: {
            status: "redeemed",
            projectId: result.projectId,
            ...redeemed,
          },
        });
      } catch (cause) {
        const error = setupError(cause);
        setState(
          error === "generic"
            ? {
                phase: "inspect",
                recovery,
              }
            : { phase: "refused", error, recovery },
        );
      }
    } catch (cause) {
      setState({ phase: "refused", error: setupError(cause), recovery });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  async function inspectResult() {
    if (!secret || busy.current) return;
    busy.current = true;
    setPending(true);
    const recovery = "recovery" in state ? state.recovery : undefined;
    try {
      const result = await orpc.projectPartnerships.getSetupLinkEligibility({
        id,
        secret,
      });
      setState(
        result.status === "redeemed"
          ? { phase: "completed", result }
          : { phase: "ready", recovery },
      );
    } catch (cause) {
      setState({ phase: "refused", error: setupError(cause), recovery });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  function selectOrganization(result: CompletedSetup) {
    setSelectionError(false);
    startSelection(async () => {
      try {
        const response = await authClient.organization.setActive({
          organizationId: result.organizationId,
        });
        if (response.error) throw createSituationErrors().selectOrganization();
        await queryClient.invalidateQueries();
        setSelected(true);
        router.refresh();
      } catch {
        setSelectionError(true);
        setSelected(false);
      }
    });
  }

  const recovery = "recovery" in state ? state.recovery : undefined;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Partner Organization setup</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <p>
          Sign in with the verified email address this link was sent to.
          Completing setup creates a Project Partnership; it does not grant
          Hosting Organization membership.
        </p>
        {!secret ? (
          <SetupStatus state="invalid" />
        ) : state.phase === "checking" ? (
          <output>Checking setup link…</output>
        ) : state.phase === "completed" ? (
          <>
            <Alert>
              <AlertTitle>Project Partnership created</AlertTitle>
              <AlertDescription>
                Your Organization is now connected to the Project. No Hosting
                Organization membership was granted. Choose this Organization
                explicitly before opening its Project.
              </AlertDescription>
            </Alert>
            {!selected || selecting ? (
              <Button
                disabled={selecting}
                onClick={() => selectOrganization(state.result)}
              >
                {selecting ? "Selecting Organization…" : "Use this Organization"}
              </Button>
            ) : (
              <Button
                render={
                  <Link
                    prefetch={false}
                    href={`/projects/${encodeURIComponent(state.result.projectId)}`}
                  />
                }
              >
                Open Partner Project
              </Button>
            )}
            {selectionError && (
              <p role="alert">
                Could not confirm Organization selection. Select it again before
                opening the Project.
              </p>
            )}
          </>
        ) : (
          <>
            {recovery && (
              <Alert>
                <AlertTitle>Organization retained</AlertTitle>
                <AlertDescription>
                  {recovery.phase === "created"
                    ? `Setup is incomplete. Continue with the exact Organization already selected (${recovery.organizationId}). No new Organization will be created.`
                    : recovery.phase === "selected"
                      ? "Continue with the existing Organization you selected, or choose another Organization you own."
                      : "Organization creation may have completed. Inspect your existing Organizations and select the one you created. Do not create it again."}
                </AlertDescription>
              </Alert>
            )}
            {state.phase === "inspect" ? (
              <Alert>
                <AlertTitle>Setup result needs inspection</AlertTitle>
                <AlertDescription>
                  The binding response was not confirmed. Inspect the result
                  before retrying. Your Organization will not be deleted.
                </AlertDescription>
              </Alert>
            ) : state.phase === "refused" ? (
              <SetupStatus state={state.error} />
            ) : (
              <SetupOrganizationForm
                recovery={recovery}
                pending={pending}
                error={state.error}
                onConsume={consume}
              />
            )}
            {(state.phase === "inspect" || state.phase === "refused") && (
              <Button disabled={pending} onClick={() => void inspectResult()}>
                {pending ? "Inspecting…" : "Inspect setup result"}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
