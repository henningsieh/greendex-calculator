"use client";

import { ORPCError } from "@orpc/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type SyntheticEvent } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { EntityCombobox } from "@/features/projects/components/entity-combobox";
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";

const searchHosted = (search: string) => orpc.projects.searchHosted({ search });
const searchOwnedOrganizations = (search: string) =>
  orpc.organizations.listMine({ search });

type SetupError =
  | "invalid"
  | "disabled"
  | "expired"
  | "wrong-email"
  | "duplicate"
  | "owner"
  | "unavailable"
  | "host"
  | "generic";

// #164 reuses BAD_REQUEST and FORBIDDEN for several distinct states. Both code AND
// exact procedure message must match; never display a remote message directly.
const knownErrors: readonly {
  code: string;
  message: string;
  state: SetupError;
}[] = [
  { code: "NOT_FOUND", message: "Setup link not found.", state: "invalid" },
  {
    code: "BAD_REQUEST",
    message: "This setup link is disabled.",
    state: "disabled",
  },
  {
    code: "BAD_REQUEST",
    message: "This setup link has expired.",
    state: "expired",
  },
  {
    code: "FORBIDDEN",
    message: "This setup link belongs to another email address.",
    state: "wrong-email",
  },
  {
    code: "BAD_REQUEST",
    message: "This setup link has already been used for another Organization.",
    state: "duplicate",
  },
  {
    code: "BAD_REQUEST",
    message: "This Organization is already assigned to the Project.",
    state: "duplicate",
  },
  {
    code: "FORBIDDEN",
    message: "You must be an Owner of the selected Organization.",
    state: "owner",
  },
  {
    code: "BAD_REQUEST",
    message: "This Project is no longer available.",
    state: "unavailable",
  },
  {
    code: "BAD_REQUEST",
    message: "The Hosting Organization cannot be its own Partner Organization.",
    state: "host",
  },
];

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
  generic: {
    title: "Could not complete setup",
    description: "Please try again or contact the Hosting Organization.",
  },
};

function setupError(error: unknown): SetupError {
  if (error instanceof ORPCError) {
    return (
      knownErrors.find(
        ({ code, message }) => error.code === code && error.message === message,
      )?.state ?? "generic"
    );
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
                          : existing.expiresAt <= new Date()
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

export function SetupLinkRecipient({
  id,
  secret,
}: {
  id: string;
  secret?: string;
}) {
  const [kind, setKind] = useState<"new" | "existing">("new");
  const [name, setName] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [error, setError] = useState<SetupError>();
  const [completed, setCompleted] = useState(false);
  const [pending, setPending] = useState(false);

  async function consume(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!secret) return;
    setError(undefined);
    setPending(true);
    try {
      await orpc.projectPartnerships.consumeSetupLink({
        id,
        secret,
        organization: kind === "new" ? { kind, name } : { kind, organizationId },
      });
      setCompleted(true);
    } catch (cause) {
      setError(setupError(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Partner Organization setup</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p>
          Sign in with the verified email address this link was sent to.
          Completing setup creates a Project Partnership; it does not grant
          Hosting Organization membership.
        </p>
        {!secret ? (
          <SetupStatus state="invalid" />
        ) : completed ? (
          <Alert>
            <AlertTitle>Project Partnership created</AlertTitle>
            <AlertDescription>
              Your Organization is now connected to the Project. No Hosting
              Organization membership was granted.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <form className="space-y-5" onSubmit={consume}>
              <fieldset className="space-y-3">
                <legend>Choose an Organization</legend>
                <label className="flex items-center gap-2">
                  <input
                    checked={kind === "new"}
                    name="setup-kind"
                    onChange={() => {
                      setKind("new");
                      setError(undefined);
                    }}
                    type="radio"
                  />
                  New Organization
                </label>
                <label className="flex items-center gap-2">
                  <input
                    checked={kind === "existing"}
                    name="setup-kind"
                    onChange={() => {
                      setKind("existing");
                      setError(undefined);
                    }}
                    type="radio"
                  />
                  Existing Organization
                </label>
              </fieldset>
              {kind === "new" ? (
                <div className="space-y-2">
                  <Label htmlFor="setup-name">New Organization name</Label>
                  <Input
                    id="setup-name"
                    maxLength={255}
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="text-sm font-medium">Organization</span>
                  <EntityCombobox
                    label="Organization"
                    value={organizationId}
                    onChange={setOrganizationId}
                    search={searchOwnedOrganizations}
                  />
                  <p>
                    Only an Owner of this Organization can complete setup.
                    Ownership is verified by the server when you submit.
                  </p>
                </div>
              )}
              <Button
                disabled={pending || (kind === "existing" && !organizationId)}
                type="submit"
              >
                {pending ? "Completing…" : "Complete setup"}
              </Button>
            </form>
            {error && <SetupStatus state={error} />}
          </>
        )}
      </CardContent>
    </Card>
  );
}
