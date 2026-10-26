"use client";

import { EU_COUNTRIES, type EUCountryCode } from "@greendex/config/eu-countries";
import { ORPCError } from "@orpc/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type SyntheticEvent } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { CheckInbox } from "@/features/authentication/components/check-inbox";
import { SignOutButton } from "@/features/authentication/components/sign-out-button";
import {
  OnboardingInputSchema,
  type OnboardingDecision,
  type OnboardingInput,
} from "@/features/authentication/onboarding-decision";
import { CreateOrganizationInputSchema } from "@/features/authentication/validation-schemas";
import { slugifyOrganizationName } from "@/features/organizations/slug";
import { EntityCombobox } from "@/features/projects/components/entity-combobox";
import { authClient } from "@/lib/auth-client";
import { getSafeErrorSituation } from "@/lib/orpc/error-contract";
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";
import { createSituationErrors } from "@/lib/orpc/errors";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";

const searchHosted = (search: string) => orpc.projects.searchHosted({ search });

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
    <Alert data-setup-error={state} variant="destructive">
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
    <Card data-testid="setup-link-creator">
      <CardHeader>
        <CardTitle>Partner Organization Setup Link</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p>
          Share this recipient-bound link privately. It does not grant Hosting
          Organization membership.
        </p>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={create}>
          <div data-testid="hosted-project-picker" className="space-y-2">
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
              data-testid="setup-email"
              required
              type="email"
              value={recipientEmail}
              onChange={(event) => setRecipientEmail(event.target.value)}
            />
          </div>
          <div>
            <Button
              data-testid="create-setup-link"
              disabled={pending || !projectId}
              type="submit"
            >
              {pending ? "Neuer Link…" : "Neuer Link"}
            </Button>
          </div>
        </form>
        {error && <p role="alert">{error}</p>}
        <section
          data-testid="setup-links"
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
                    <TableCell
                      data-link-status={
                        !existing.enabled
                          ? "closed"
                          : existing.consumedAt
                            ? "used"
                            : existing.expired
                              ? "expired"
                              : "open"
                      }
                    >
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
                        data-testid="close-setup-link"
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
            <Input
              id="recipient-link"
              data-testid="recipient-link"
              readOnly
              value={link}
            />
            <Button
              data-testid="copy-setup-link"
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

type RecoveryCheckpoint = NonNullable<OnboardingInput["setupRecovery"]>;

function readRecovery(key: string): RecoveryCheckpoint | undefined {
  const raw = localStorage.getItem(key);
  return raw
    ? OnboardingInputSchema.shape.setupRecovery.parse(JSON.parse(raw))
    : undefined;
}

type SetupChoice =
  | { kind: "new"; name: string; country: EUCountryCode | "" }
  | { kind: "existing"; organizationId: string };
type ChoiceDecision = Extract<
  OnboardingDecision,
  { nextStep: "choose-organization" }
>;

function SetupOrganizationForm({
  decision,
  pending,
  onConsume,
}: {
  decision: ChoiceDecision;
  pending: boolean;
  onConsume: (choice: SetupChoice) => Promise<void>;
}) {
  const create = decision.availableActions.some(
    (action) => action.kind === "create-organization",
  );
  const owned = [...decision.availableActions].find(
    (action) => action.kind === "choose-owned-organization",
  );
  const [kind, setKind] = useState<"new" | "existing">(
    create ? "new" : "existing",
  );
  const [name, setName] = useState("");
  const [country, setCountry] = useState<EUCountryCode | "">("");
  const [organizationId, setOrganizationId] = useState("");
  const existing = !create || kind === "existing";
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
        {create && owned && (
          <fieldset disabled={pending} className="flex flex-col gap-3">
            <legend>Choose an Organization</legend>
            <label>
              <input
                type="radio"
                name="setup-kind"
                checked={!existing}
                onChange={() => setKind("new")}
              />{" "}
              New Organization
            </label>
            <label>
              <input
                type="radio"
                name="setup-kind"
                checked={existing}
                data-testid="setup-existing-organization"
                onChange={() => setKind("existing")}
              />{" "}
              Existing Organization
            </label>
          </fieldset>
        )}
        {existing && owned ? (
          <Field data-testid="setup-organization-picker">
            <FieldLabel>Organization</FieldLabel>
            <EntityCombobox
              label="Organization"
              disabled={pending}
              value={organizationId}
              onChange={setOrganizationId}
              preload={owned.organizations}
            />
          </Field>
        ) : (
          <>
            <Field>
              <FieldLabel htmlFor="setup-name">New Organization name</FieldLabel>
              <Input
                id="setup-name"
                data-testid="setup-name"
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
                data-testid="setup-country"
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
                    {new Intl.DisplayNames(["en"], { type: "region" }).of(code)}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
        <Button
          data-testid="complete-setup"
          disabled={
            pending ||
            (existing
              ? !organizationId
              : !slugifyOrganizationName(name) || !country)
          }
          type="submit"
        >
          {pending ? "Completing…" : "Complete setup"}
        </Button>
      </FieldGroup>
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
  const [decision, setDecision] = useState<OnboardingDecision>();
  const [error, setError] = useState<SetupError>();
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const recovery = useRef<RecoveryCheckpoint | undefined>(undefined);
  const recoveryKey = `partner-setup:${userId}:${id}`;
  const returnTo = `/setup-links/${id}${secret ? `?secret=${encodeURIComponent(secret)}` : ""}`;

  function retain(checkpoint: RecoveryCheckpoint) {
    // This checkpoint prevents duplicate mutations after uncertain responses. It grants no actions.
    localStorage.setItem(recoveryKey, JSON.stringify(checkpoint));
    recovery.current = checkpoint;
  }

  async function resolve() {
    const next = await orpc.authentication.onboardingNextStep({
      returnTo,
      setupRecovery: recovery.current,
    });
    setDecision(next);
    return next;
  }

  useEffect(() => {
    let active = true;
    try {
      recovery.current = readRecovery(recoveryKey);
    } catch {
      recovery.current = { phase: "creating" };
    }
    void orpc.authentication
      .onboardingNextStep({ returnTo, setupRecovery: recovery.current })
      .then((next) => {
        if (active) setDecision(next);
      })
      .catch((cause: unknown) => {
        if (active) setError(setupError(cause));
      });
    return () => {
      active = false;
    };
  }, [recoveryKey, returnTo]);

  async function bind(next: OnboardingDecision) {
    if (next.nextStep !== "bind-partnership" || !secret) return;
    await orpc.projectPartnerships.consumeSetupLink({
      id,
      secret,
      organizationId: next.availableActions[0].organizationId,
    });
    await resolve();
  }

  async function consume(choice?: SetupChoice) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(undefined);
    try {
      let next = await resolve();
      if (next.nextStep === "choose-organization" && choice) {
        if (choice.kind === "new") {
          if (
            !next.availableActions.some(
              (action) => action.kind === "create-organization",
            )
          )
            return;
          const input = CreateOrganizationInputSchema.safeParse({
            name: choice.name.trim(),
            slug: slugifyOrganizationName(choice.name.trim()),
            country: choice.country,
          });
          if (!input.success) {
            setError("create");
            return;
          }
          retain({ phase: "creating" });
          try {
            const created = await orpc.authentication.createOrganization(
              input.data,
            );
            retain({ phase: "created", organizationId: created.organizationId });
          } catch (cause) {
            const reason =
              cause instanceof ORPCError
                ? getSafeErrorSituation(cause)?.reason
                : undefined;
            if (
              reason === "ORGANIZATION_SLUG_TAKEN_BEFORE_CREATION" ||
              reason === "ORGANIZATION_NAME_TAKEN_BEFORE_CREATION"
            ) {
              localStorage.removeItem(recoveryKey);
              recovery.current = undefined;
            }
            setError("create");
            await resolve();
            return;
          }
        } else {
          const owned = [...next.availableActions].find(
            (action) => action.kind === "choose-owned-organization",
          );
          if (
            !owned?.organizations.some(
              (organization) => organization.id === choice.organizationId,
            )
          )
            return;
          retain({ phase: "selected", organizationId: choice.organizationId });
        }
        next = await resolve();
      }
      await bind(next);
    } catch (cause) {
      setError(setupError(cause));
      // An uncertain binding is inspected on the next explicit retry, never repeated blindly.
      setDecision(undefined);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  async function recheck() {
    setPending(true);
    setError(undefined);
    try {
      if (
        decision?.nextStep === "setup-recovery" &&
        recovery.current?.phase === "selected"
      )
        retain({ phase: "creating" });
      await resolve();
    } catch (cause) {
      setError(setupError(cause));
    } finally {
      setPending(false);
    }
  }

  async function select(organizationId: string) {
    if (decision?.nextStep !== "select-organization" || pending) return;
    setPending(true);
    setError(undefined);
    try {
      const response = await authClient.organization.setActive({
        organizationId,
      });
      if (response.error) throw createSituationErrors().selectOrganization();
      await queryClient.invalidateQueries();
      await resolve();
      router.refresh();
    } catch {
      setError("generic");
    } finally {
      setPending(false);
    }
  }

  if (decision?.nextStep === "verify-email")
    return (
      <>
        <CheckInbox email={decision.email} />
        <SignOutButton />
      </>
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Partner Organization setup</h1>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5" aria-busy={pending}>
        <p>
          Continue with the email address this setup link was sent to. This
          connects your Organization to the Project; it does not grant Hosting
          Organization membership.
        </p>
        {decision?.nextStep === "choose-organization" ? (
          <SetupOrganizationForm
            key={JSON.stringify(decision.availableActions)}
            decision={decision}
            pending={pending}
            onConsume={consume}
          />
        ) : decision?.nextStep === "bind-partnership" ? (
          <>
            <Alert variant="info">
              <AlertTitle>Organization retained</AlertTitle>
              <AlertDescription>
                Your Organization is ready. Continue to connect it to the Project.
                No new Organization will be created.
              </AlertDescription>
            </Alert>
            <Button
              data-testid="retry-retained-setup"
              disabled={pending}
              onClick={() => void consume()}
            >
              Retry setup with retained Organization
            </Button>
          </>
        ) : decision?.nextStep === "setup-recovery" ? (
          <>
            <SetupStatus state={knownErrors[decision.reason] ?? "generic"} />
            <Button
              data-testid="inspect-setup"
              disabled={pending}
              onClick={recheck}
            >
              Inspect setup result
            </Button>
          </>
        ) : decision?.nextStep === "select-organization" ? (
          <>
            <Alert variant="info" data-relationship="project-partnership">
              <AlertTitle>Project Partnership created</AlertTitle>
              <AlertDescription>
                Select your Organization before opening its Project.
              </AlertDescription>
            </Alert>
            {decision.availableActions[0].organizations.map((organization) => (
              <Button
                data-testid={`use-setup-organization-${organization.id}`}
                key={organization.id}
                disabled={pending}
                onClick={() => void select(organization.id)}
              >
                Use this Organization
              </Button>
            ))}
          </>
        ) : decision?.nextStep === "continue" ? (
          <Link
            data-testid="open-partner-project"
            className={buttonVariants()}
            prefetch={false}
            href={decision.availableActions[0].destination}
          >
            Open Partner Project
          </Link>
        ) : decision?.nextStep === "authenticate" ? (
          <Link
            className={buttonVariants()}
            href={`/login?next=${encodeURIComponent(decision.availableActions[0].returnTo ?? returnTo)}`}
          >
            Sign in to continue
          </Link>
        ) : !error ? (
          <output>Checking setup link…</output>
        ) : null}
        {error && (
          <>
            <SetupStatus state={error} />
            <Button
              data-testid="inspect-setup"
              disabled={pending}
              onClick={recheck}
            >
              Inspect setup result
            </Button>
          </>
        )}
        {decision?.availableActions.some(
          (action) => action.kind === "sign-out",
        ) && <SignOutButton />}
      </CardContent>
    </Card>
  );
}
