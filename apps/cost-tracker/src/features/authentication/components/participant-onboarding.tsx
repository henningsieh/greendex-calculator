"use client";

import { ORPCError } from "@orpc/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type SyntheticEvent } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  isPublishedAgreement,
  type ParticipantAgreementVersion,
} from "@/features/authentication/participant-agreement";
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";
import { orpc } from "@/lib/orpc/orpc";

type Agreement = ParticipantAgreementVersion & { content?: string };
type JoinSource =
  | { kind: "link"; id: string; secret: string }
  | { kind: "invitation"; invitationId: string };
type Projects = Awaited<
  ReturnType<typeof orpc.participantOnboarding.listMyProjects>
>;
type DashboardState = "loading" | "profile" | "agreement" | "ready" | "error";

// A published hash alone is not displayable legal copy; acceptance stays disabled
// until approved content is also supplied. The deployed version is PENDING.
function hasAgreementCopy(
  agreement: Agreement,
): agreement is Agreement & { content: string } {
  return isPublishedAgreement(agreement) && Boolean(agreement.content?.trim());
}

function AgreementUnavailable() {
  return (
    <Alert>
      <AlertTitle>Participant agreement is not yet available</AlertTitle>
      <AlertDescription>
        Joining and Participant actions are paused until the approved agreement is
        published.
      </AlertDescription>
    </Alert>
  );
}

function AgreementAcceptance({
  agreement,
  checked,
  onCheckedChange,
}: {
  agreement: Agreement;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  if (!hasAgreementCopy(agreement)) return <AgreementUnavailable />;
  return (
    <div className="space-y-3">
      <h2 className="font-heading text-lg font-semibold">
        EU–Erasmus Participant agreement ({agreement.id})
      </h2>
      <div
        className="max-h-64 overflow-auto rounded-md border p-4 whitespace-pre-wrap"
        aria-label="Participant agreement text"
      >
        {agreement.content}
      </div>
      <label className="flex items-start gap-2">
        <input
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
          required
          type="checkbox"
        />
        I accept the current Participant agreement
      </label>
    </div>
  );
}

export function ParticipantJoin({
  source,
  agreement,
}: {
  source: JoinSource | null;
  agreement: Agreement;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const available = hasAgreementCopy(agreement);

  async function join(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!source || !available || !accepted || pending) return;
    setPending(true);
    setError(undefined);
    try {
      await orpc.participantOnboarding.join({
        source,
        profile: { fullName: name },
        agreement: { accepted: true },
      });
      router.replace("/participant");
      router.refresh();
    } catch (cause) {
      setError(getORPCRequestErrorMessage(cause).text);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join as a Project Participant</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p>
          Your account must use a verified email address. The server checks the
          Participant Invitation or Participant Registration Link before granting
          access.
        </p>
        {!source ? (
          <Alert variant="destructive">
            <AlertTitle>
              Complete Participant Invitation or Participant Registration Link
              required
            </AlertTitle>
            <AlertDescription>
              Open the complete link shared with you. If it does not work, ask the
              sender for a new link.
            </AlertDescription>
          </Alert>
        ) : (
          <form className="space-y-5" onSubmit={join}>
            <div className="space-y-2">
              <Label htmlFor="participant-name">Full name</Label>
              <Input
                id="participant-name"
                autoComplete="name"
                maxLength={200}
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <AgreementAcceptance
              agreement={agreement}
              checked={accepted}
              onCheckedChange={setAccepted}
            />
            <Button disabled={!available || !accepted || pending} type="submit">
              {pending ? "Joining…" : "Join Project"}
            </Button>
            {error && <p role="alert">{error}</p>}
          </form>
        )}
      </CardContent>
    </Card>
  );
}

const missingProfile =
  "Complete your Participant profile before accessing Projects.";
const staleAgreement =
  "Accept the current Participant agreement before accessing Projects.";

export function ParticipantDashboard({ agreement }: { agreement: Agreement }) {
  const [state, setState] = useState<DashboardState>("loading");
  const [projects, setProjects] = useState<Projects>([]);
  const [name, setName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const available = hasAgreementCopy(agreement);

  const loaded = useCallback((result: Projects) => {
    setProjects(result);
    setState("ready");
  }, []);
  const failed = useCallback((cause: unknown) => {
    if (
      cause instanceof ORPCError &&
      cause.code === "FORBIDDEN" &&
      cause.message === missingProfile
    ) {
      setState("profile");
    } else if (
      cause instanceof ORPCError &&
      cause.code === "FORBIDDEN" &&
      cause.message === staleAgreement
    ) {
      setState("agreement");
    } else {
      setError(getORPCRequestErrorMessage(cause).text);
      setState("error");
    }
  }, []);
  const load = useCallback(async () => {
    try {
      loaded(await orpc.participantOnboarding.listMyProjects());
    } catch (cause) {
      failed(cause);
    }
  }, [loaded, failed]);

  useEffect(() => {
    if (!available) return;
    void orpc.participantOnboarding.listMyProjects().then(loaded, failed);
  }, [available, loaded, failed]);

  async function saveProfile(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      await orpc.participantOnboarding.saveProfile({ fullName: name });
      await load();
    } catch (cause) {
      setError(getORPCRequestErrorMessage(cause).text);
    } finally {
      setPending(false);
    }
  }

  async function accept(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!available || !accepted || pending) return;
    setPending(true);
    setError(undefined);
    try {
      await orpc.participantOnboarding.acceptAgreement({ accepted: true });
      await load();
    } catch (cause) {
      setError(getORPCRequestErrorMessage(cause).text);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Project Participations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {!available ? (
          <>
            <AgreementUnavailable />
            <Button disabled type="button">
              Accept agreement
            </Button>
          </>
        ) : state === "loading" ? (
          <output>Loading your Projects…</output>
        ) : state === "profile" ? (
          <>
            <p>Complete your profile before Participant actions are available.</p>
            <form className="space-y-4" onSubmit={saveProfile}>
              <div className="space-y-2">
                <Label htmlFor="profile-name">Full name</Label>
                <Input
                  id="profile-name"
                  autoComplete="name"
                  maxLength={200}
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <Button disabled={pending} type="submit">
                {pending ? "Saving…" : "Save profile"}
              </Button>
            </form>
          </>
        ) : state === "agreement" ? (
          <>
            <p>
              Accept the current agreement before Participant actions are
              available.
            </p>
            <form className="space-y-4" onSubmit={accept}>
              <AgreementAcceptance
                agreement={agreement}
                checked={accepted}
                onCheckedChange={setAccepted}
              />
              <Button disabled={!accepted || pending} type="submit">
                {pending ? "Accepting…" : "Accept agreement"}
              </Button>
            </form>
          </>
        ) : state === "error" ? (
          <Button
            type="button"
            onClick={() => {
              setState("loading");
              setError(undefined);
              void load();
            }}
          >
            Retry loading Projects
          </Button>
        ) : projects.length === 0 ? (
          <p>
            No Projects yet. Join through a Participant Invitation or Participant
            Registration Link to see your Participations here.
          </p>
        ) : (
          <ul className="space-y-4">
            {projects.map((project) => (
              <li className="rounded-md border p-4" key={project.participationId}>
                <h2 className="font-heading text-lg font-semibold">
                  {project.projectName}
                </h2>
                <p>Representing: {project.representedOrganizationName}</p>
                <p>Hosted by: {project.hostingOrganizationName}</p>
              </li>
            ))}
          </ul>
        )}
        {error && <p role="alert">{error}</p>}
      </CardContent>
    </Card>
  );
}
