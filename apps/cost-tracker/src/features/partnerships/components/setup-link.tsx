"use client";

import { EU_COUNTRIES, type EUCountryCode } from "@greendex/config/eu-countries";
import { useTranslations } from "@greendex/i18n/client";
import { ORPCError } from "@orpc/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type SyntheticEvent } from "react";

import { EntityCombobox } from "@/components/entity-combobox";
import {
  ErrorPresentation,
  ErrorReason,
} from "@/components/error-presentation/error-presentation";
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
import { InvitationAcceptance } from "@/features/authentication/components/invitation-acceptance";
import { SignOutButton } from "@/features/authentication/components/sign-out-button";
import {
  OnboardingInputSchema,
  type OnboardingDecision,
  type OnboardingInput,
} from "@/features/authentication/onboarding-decision";
import { CreateOrganizationInputSchema } from "@/features/authentication/validation-schemas";
import { slugifyOrganizationName } from "@/features/organizations/slug";
import { authClient } from "@/lib/auth-client";
import { getSafeErrorSituation } from "@/lib/orpc/error-contract";
import { createSituationErrors } from "@/lib/orpc/errors";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";

const searchHosted = (search: string) => orpc.projects.searchHosted({ search });

type SetupFeedback = { error: unknown };

function SetupStatus({ error }: SetupFeedback) {
  const t = useTranslations("partnerships.setup");
  return (
    <Alert variant="destructive">
      <AlertTitle>{t("partnerSetup")}</AlertTitle>
      <AlertDescription>
        <ErrorPresentation error={error} />
      </AlertDescription>
    </Alert>
  );
}

export function SetupLinkCreator() {
  const client = useQueryClient();
  const t = useTranslations("partnerships.setup");
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
      setError(<ErrorPresentation error={cause} />);
    } finally {
      setClosingId(undefined);
    }
  }
  const [projectId, setProjectId] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState<React.ReactNode>("");
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
      setError(<ErrorPresentation error={cause} />);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card data-testid="setup-link-creator">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p>{t("description")}</p>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={create}>
          <div data-testid="hosted-project-picker" className="space-y-2">
            <span className="text-sm font-medium">{t("hostedProject")}</span>
            <EntityCombobox
              label={t("hostedProject")}
              value={projectId}
              onChange={setProjectId}
              search={searchHosted}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="setup-email">{t("recipientEmail")}</Label>
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
              {pending ? t("creatingLink") : t("createLink")}
            </Button>
          </div>
        </form>
        {error && <div role="alert">{error}</div>}
        <section
          data-testid="setup-links"
          aria-label={t("existingLinks")}
          className="space-y-3"
        >
          <h3 className="font-semibold">{t("existingLinks")}</h3>
          <p>{t("existingLinksHint")}</p>
          {existingLinks.isPending ? (
            <output>{t("loading")}</output>
          ) : existingLinks.isError ? (
            <Alert variant="destructive">
              <AlertTitle>{t("loadError")}</AlertTitle>
              <AlertDescription>
                {<ErrorPresentation error={existingLinks.error} />}
              </AlertDescription>
              <Button
                type="button"
                variant="outline"
                onClick={() => void existingLinks.refetch()}
              >
                {t("retry")}
              </Button>
            </Alert>
          ) : existingLinks.data.length === 0 ? (
            <p>{t("empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("hostedProject")}</TableHead>
                  <TableHead>{t("recipientEmail")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("expires")}</TableHead>
                  <TableHead>{t("action")}</TableHead>
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
                        ? t("closed")
                        : existing.consumedAt
                          ? t("used")
                          : existing.expired
                            ? t("expired")
                            : t("open")}
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
                          ? t("closing")
                          : t("closeLink")}
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
            <Label htmlFor="recipient-link">{t("recipientLink")}</Label>
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
                  setError(t("copyError"));
                }
              }}
            >
              {t("copy")}
            </Button>
            {copied && <output>{t("copied")}</output>}
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
  const t = useTranslations("partnerships.setup");
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
            <legend>{t("chooseOrganization")}</legend>
            <label>
              <input
                type="radio"
                name="setup-kind"
                checked={!existing}
                onChange={() => setKind("new")}
              />{" "}
              {t("newOrganization")}
            </label>
            <label>
              <input
                type="radio"
                name="setup-kind"
                checked={existing}
                data-testid="setup-existing-organization"
                onChange={() => setKind("existing")}
              />{" "}
              {t("existingOrganization")}
            </label>
          </fieldset>
        )}
        {existing && owned ? (
          <Field data-testid="setup-organization-picker">
            <FieldLabel>{t("organization")}</FieldLabel>
            <EntityCombobox
              label={t("organization")}
              disabled={pending}
              value={organizationId}
              onChange={setOrganizationId}
              preload={owned.organizations}
            />
          </Field>
        ) : (
          <>
            <Field>
              <FieldLabel htmlFor="setup-name">
                {t("newOrganizationName")}
              </FieldLabel>
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
                {t("organizationCountry")}
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
                  {t("countryPlaceholder")}
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
          {pending ? t("completing") : t("complete")}
        </Button>
      </FieldGroup>
    </form>
  );
}

function SetupOrganizationAccess({
  decision,
  pending,
  returnTo,
  select,
  error,
}: {
  decision: OnboardingDecision | undefined;
  pending: boolean;
  returnTo: string;
  select: (id: string) => Promise<void>;
  error: SetupFeedback | undefined;
}) {
  const t = useTranslations("partnerships.setup");
  return decision?.nextStep === "select-organization" ? (
    <>
      <Alert variant="info" data-relationship="project-partnership">
        <AlertTitle>{t("created")}</AlertTitle>
        <AlertDescription>{t("selectOrganization")}</AlertDescription>
      </Alert>
      {decision.availableActions[0].organizations.map((organization) => (
        <Button
          data-testid={`use-setup-organization-${organization.id}`}
          key={organization.id}
          disabled={pending}
          onClick={() => void select(organization.id)}
        >
          {t("useOrganization")}
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
      {t("openPartnerProject")}
    </Link>
  ) : decision?.nextStep === "authenticate" ? (
    <Link
      className={buttonVariants()}
      href={`/login?next=${encodeURIComponent(decision.availableActions[0].returnTo ?? returnTo)}`}
    >
      {t("signIn")}
    </Link>
  ) : !error ? (
    <output>{t("checking")}</output>
  ) : null;
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
  const t = useTranslations("partnerships.setup");
  const [rejectedOrganization, setRejectedOrganization] = useState<string>();
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<OnboardingDecision>();
  const [error, setError] = useState<SetupFeedback>();
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const recovery = useRef<RecoveryCheckpoint | undefined>(undefined);
  const [recoverySnapshot, setRecoverySnapshot] = useState<RecoveryCheckpoint>();
  const recoveryKey = `partner-setup:${userId}:${id}`;
  const returnTo = `/setup-links/${id}${secret ? `?secret=${encodeURIComponent(secret)}` : ""}`;

  function retain(checkpoint: RecoveryCheckpoint) {
    // This checkpoint prevents duplicate mutations after uncertain responses. It grants no actions.
    localStorage.setItem(recoveryKey, JSON.stringify(checkpoint));
    recovery.current = checkpoint;
    setRecoverySnapshot(checkpoint);
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
        if (active) {
          setRecoverySnapshot(recovery.current);
          setDecision(next);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setRecoverySnapshot(recovery.current);
          setError({ error: cause });
        }
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
            setError({ error: createSituationErrors().badInput() });
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
              reason === "ORGANIZATION_CREATION_DENIED_BEFORE_CREATION" ||
              reason === "ORGANIZATION_SLUG_TAKEN_BEFORE_CREATION" ||
              reason === "ORGANIZATION_NAME_TAKEN_BEFORE_CREATION"
            ) {
              localStorage.removeItem(recoveryKey);
              recovery.current = undefined;
              setRecoverySnapshot(undefined);
            }
            setError({ error: cause });
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
      setError({ error: cause });
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
      setError({ error: cause });
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
    } catch (cause) {
      setError({ error: cause });
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
          <h1>{t("partnerSetup")}</h1>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5" aria-busy={pending}>
        <p>{t("continueEmail")}</p>
        {rejectedOrganization && (
          <output data-testid="setup-invitation-rejected">
            {t("invitationRejected", { organization: rejectedOrganization })}
          </output>
        )}
        {decision?.nextStep === "resolve-invitation" ? (
          <InvitationAcceptance
            returnTo={returnTo}
            setupRecovery={recoverySnapshot}
            initialDecision={decision}
            onDecision={setDecision}
            onRejected={setRejectedOrganization}
          />
        ) : decision?.nextStep === "choose-organization" ? (
          <SetupOrganizationForm
            key={JSON.stringify(decision.availableActions)}
            decision={decision}
            pending={pending}
            onConsume={consume}
          />
        ) : decision?.nextStep === "bind-partnership" ? (
          <>
            <Alert variant="info">
              <AlertTitle>{t("retained")}</AlertTitle>
              <AlertDescription>{t("retainedDescription")}</AlertDescription>
            </Alert>
            <Button
              data-testid="retry-retained-setup"
              disabled={pending}
              onClick={() => void consume()}
            >
              {t("retryRetained")}
            </Button>
          </>
        ) : decision?.nextStep === "setup-recovery" ? (
          <>
            <Alert variant="destructive" data-setup-reason={decision.reason}>
              <AlertTitle>{t("partnerSetup")}</AlertTitle>
              <AlertDescription>
                <ErrorReason reason={decision.reason} />
              </AlertDescription>
            </Alert>
            <Button
              data-testid="inspect-setup"
              disabled={pending}
              onClick={recheck}
            >
              {t("inspect")}
            </Button>
          </>
        ) : (
          <SetupOrganizationAccess
            decision={decision}
            pending={pending}
            returnTo={returnTo}
            select={select}
            error={error}
          />
        )}
        {error && (
          <>
            <SetupStatus {...error} />
            <Button
              data-testid="inspect-setup"
              disabled={pending}
              onClick={recheck}
            >
              {t("inspect")}
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
