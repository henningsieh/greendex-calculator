"use client";

import { ORPCError } from "@orpc/client";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { EntityCombobox } from "@/features/projects/components/entity-combobox";
import { getSafeErrorSituation } from "@/lib/orpc/error-contract";
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";
import type { Outputs } from "@/lib/orpc/router";

type Participation =
  Outputs["participations"]["listPartnership"]["participations"][number];
const countries = [
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
] as const;
type Country = (typeof countries)[number];

function isCountry(value: string): value is Country {
  return countries.some((country) => country === value);
}

const duplicateMessage =
  "Identity already participates in this Project; request merge review.";

function mutationFeedback(error: unknown) {
  if (
    error instanceof ORPCError &&
    error.code === "BAD_REQUEST" &&
    error.message === duplicateMessage
  ) {
    return {
      title: "Review request",
      description:
        "This Registered User may already participate in this Project. Open Review Tasks to review the duplicate identity, then contact the Hosting Organization to request a merge review if needed. No new Project Participation was added.",
    };
  }
  if (error instanceof ORPCError && error.code === "FORBIDDEN") {
    return {
      title: "Access denied",
      description: getORPCRequestErrorMessage(error).text,
    };
  }
  return {
    title: "Unable to save Participation",
    description: getORPCRequestErrorMessage(error).text,
  };
}

function CountryEditor({
  participant,
  partnershipId,
  onSaved,
  onError,
}: {
  participant: Participation;
  partnershipId: string;
  onSaved: () => Promise<void>;
  onError: (error: unknown) => void;
}) {
  const [country, setCountry] = useState<Country | "">(
    participant.country && isCountry(participant.country)
      ? participant.country
      : "",
  );
  const update = useMutation({
    mutationFn: () =>
      orpc.participations.update({
        partnershipId,
        id: participant.id,
        country: country || null,
      }),
    onSuccess: onSaved,
    onError,
  });
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-2">
        <Label htmlFor={`country-${participant.id}`}>
          Country for {participant.displayName}
        </Label>
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          id={`country-${participant.id}`}
          onChange={(event) =>
            setCountry(isCountry(event.target.value) ? event.target.value : "")
          }
          value={country}
        >
          <option value="">Not set</option>
          {countries.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <Button
        disabled={update.isPending}
        onClick={() => update.mutate()}
        type="button"
        variant="outline"
      >
        Save country for {participant.displayName}
      </Button>
    </div>
  );
}

type ReviewTask = Outputs["duplicateReviews"]["list"][number];
type ReviewDecision = NonNullable<ReviewTask["decision"]>;
const reviewDecisions: { value: ReviewDecision; label: string }[] = [
  { value: "same_person", label: "Same person" },
  { value: "distinct_persons", label: "Distinct persons" },
  { value: "dismiss", label: "Dismiss" },
];

function ReviewTaskControls({
  task,
  refresh,
  onFeedback,
}: {
  task: ReviewTask;
  refresh: () => Promise<void>;
  onFeedback: (message: string) => void;
}) {
  const [decision, setDecision] = useState<ReviewDecision>("same_person");
  const onError = (error: unknown) =>
    onFeedback(
      error instanceof ORPCError && error.code === "BAD_REQUEST"
        ? "The Review Task is no longer available for this action. Only its assigned Registered User may resolve it with the existing Project Participation. Refresh the list and try again."
        : getORPCRequestErrorMessage(error).text,
    );
  const assign = useMutation({
    mutationFn: () =>
      orpc.duplicateReviews.assign({
        partnershipId: task.partnershipId,
        id: task.id,
      }),
    onSuccess: async () => {
      onFeedback("Review Task assigned to you.");
      await refresh();
    },
    onError,
  });
  const resolve = useMutation({
    mutationFn: () =>
      orpc.duplicateReviews.resolve({
        partnershipId: task.partnershipId,
        id: task.id,
        decision,
        survivorParticipationId: task.existingParticipationId,
      }),
    onSuccess: async () => {
      onFeedback(
        "Review Task resolved. The existing Project Participation is retained; no merge was performed.",
      );
      await refresh();
    },
    onError,
  });
  return (
    <li className="space-y-3 py-4">
      <p>Registered User: {task.candidateEmail}</p>
      <Badge variant="secondary">Review Task {task.status}</Badge>
      <p className="text-sm">
        Existing Project Participation: {task.existingParticipationId}
      </p>
      {task.assignedToUserId && (
        <p className="text-sm">
          Assigned Registered User: {task.assignedToUserId}
        </p>
      )}
      {task.status === "open" && (
        <Button
          type="button"
          variant="outline"
          disabled={assign.isPending}
          onClick={() => assign.mutate()}
        >
          Assign Review Task to me
        </Button>
      )}
      {task.status === "assigned" && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor={`review-decision-${task.id}`}>
              Review Task decision
            </Label>
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              id={`review-decision-${task.id}`}
              value={decision}
              onChange={(event) => {
                const selected = reviewDecisions.find(
                  (entry) => entry.value === event.target.value,
                );
                if (selected) setDecision(selected.value);
              }}
            >
              {reviewDecisions.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            disabled={resolve.isPending}
            onClick={() => resolve.mutate()}
          >
            Resolve Review Task
          </Button>
        </div>
      )}
      {task.decision && (
        <p>
          Decision:{" "}
          {reviewDecisions.find((entry) => entry.value === task.decision)?.label}
        </p>
      )}
    </li>
  );
}

function ReviewTasks({ partnershipId }: { partnershipId: string }) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState("");
  const options = orpcQuery.duplicateReviews.list.queryOptions({
    input: { partnershipId },
    meta: { costTrackerORPC: true },
    retry: false,
  });
  const tasks = useQuery(options);
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: options.queryKey });
  };
  return (
    <section aria-label="Review Tasks" className="space-y-4">
      {tasks.isPending ? (
        <output>Loading Review Tasks…</output>
      ) : tasks.isError ? (
        <Alert>
          <AlertTitle>Unable to load Review Tasks</AlertTitle>
          <AlertDescription>
            {getORPCRequestErrorMessage(tasks.error).text}
          </AlertDescription>
          <Button
            type="button"
            variant="outline"
            onClick={() => void tasks.refetch()}
          >
            Retry Review Tasks
          </Button>
        </Alert>
      ) : tasks.data.length === 0 ? (
        <p>No Review Tasks are recorded for this Project Partnership.</p>
      ) : (
        <ul className="divide-y">
          {tasks.data.map((task) => (
            <ReviewTaskControls
              key={task.id}
              task={task}
              refresh={refresh}
              onFeedback={setFeedback}
            />
          ))}
        </ul>
      )}
      {feedback && (
        <Alert>
          <AlertTitle>Review Task update</AlertTitle>
          <AlertDescription>{feedback}</AlertDescription>
        </Alert>
      )}
    </section>
  );
}

function PartnerCoordinatorControls({
  partnershipId,
}: {
  partnershipId: string;
}) {
  const queryClient = useQueryClient();
  const [targetUserId, setTargetUserId] = useState("");
  const [feedback, setFeedback] = useState("");
  // This existing read is owner/admin-only; the mutations separately enforce
  // that the active Organization is this Project Partnership's Partner side.
  const members = useQuery(
    orpcQuery.organizations.listMembers.queryOptions({
      input: {},
      meta: { costTrackerORPC: true },
      retry: false,
    }),
  );
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: orpcQuery.projects.listPartner.key({ type: "query" }),
      }),
      queryClient.invalidateQueries({
        queryKey: orpcQuery.projects.scopes.key({ type: "query" }),
      }),
    ]);
  };
  const onError = (error: unknown) =>
    setFeedback(getORPCRequestErrorMessage(error).text);
  const assign = useMutation({
    mutationFn: () =>
      orpc.projectPartnerships.assignPartnerCoordinator({
        partnershipId,
        userId: targetUserId,
      }),
    onSuccess: async () => {
      setFeedback("Group Organizer assigned to this Project Partnership.");
      await refresh();
    },
    onError,
  });
  const revoke = useMutation({
    mutationFn: () =>
      orpc.projectPartnerships.removePartnerCoordinator({
        partnershipId,
        userId: targetUserId,
      }),
    onSuccess: async () => {
      setFeedback(
        "Group Organizer assignment revoked for this Project Partnership. Organization Membership roles are unchanged.",
      );
      await refresh();
    },
    onError,
  });
  if (members.isPending) return <output>Loading Registered Users…</output>;
  if (members.isError)
    return (
      <Alert>
        <AlertTitle>Group Organizer management unavailable</AlertTitle>
        <AlertDescription>
          {getORPCRequestErrorMessage(members.error).text}
        </AlertDescription>
        <Button
          type="button"
          variant="outline"
          onClick={() => void members.refetch()}
        >
          Retry Registered Users
        </Button>
      </Alert>
    );
  const eligible = members.data.members.filter((entry) =>
    entry.role
      .split(",")
      .some((role) =>
        ["owner", "admin", "project-coordinator"].includes(role.trim()),
      ),
  );
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Organization Owners and Organization Admins may assign or revoke a Group
        Organizer for this Project Partnership. Assignment does not change
        Organization Membership roles; the project-coordinator role is required
        for assignment-scoped access.
      </p>
      <div className="space-y-2">
        <Label htmlFor={`group-organizer-${partnershipId}`}>
          Registered User for Group Organizer assignment
        </Label>
        <select
          id={`group-organizer-${partnershipId}`}
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          value={targetUserId}
          disabled={assign.isPending || revoke.isPending}
          onChange={(event) => {
            setTargetUserId(event.target.value);
            setFeedback("");
          }}
        >
          <option value="">Select a Registered User</option>
          {eligible.map((entry) => (
            <option key={entry.userId} value={entry.userId}>
              {entry.name} ({entry.email})
            </option>
          ))}
        </select>
      </div>
      {eligible.length === 0 && (
        <p>No eligible Registered Users in this Organization.</p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          disabled={!targetUserId || assign.isPending || revoke.isPending}
          onClick={() => {
            setFeedback("");
            assign.mutate();
          }}
        >
          Assign Group Organizer
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!targetUserId || assign.isPending || revoke.isPending}
          onClick={() => {
            setFeedback("");
            revoke.mutate();
          }}
        >
          Revoke Group Organizer assignment
        </Button>
      </div>
      {feedback && (
        <Alert>
          <AlertTitle>Group Organizer update</AlertTitle>
          <AlertDescription>{feedback}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/** The list and mutations are scoped by the server's Partnership authorization, not client filtering. */
export function ParticipantCoordination({
  partnershipId,
}: {
  partnershipId: string;
}) {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(
    orpcQuery.participations.listPartnership.queryOptions({
      input: { partnershipId },
      meta: { costTrackerORPC: true },
    }),
  );
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [coordinatorsOpen, setCoordinatorsOpen] = useState(false);
  const [createdLink, setCreatedLink] = useState<{
    partnershipId: string;
    id: string;
    url: string;
  }>();
  const [entryFeedback, setEntryFeedback] = useState<{
    title: string;
    description: string;
  }>();
  const searchOnboarded = (search: string) =>
    orpc.participations.searchOnboarded({ partnershipId, search });
  const [feedback, setFeedback] = useState<{
    title: string;
    description: string;
  }>();
  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: orpcQuery.participations.listPartnership.queryKey({
        input: { partnershipId },
      }),
    });
    if (reviewsOpen)
      await queryClient.invalidateQueries({
        queryKey: orpcQuery.duplicateReviews.list.queryKey({
          input: { partnershipId },
        }),
      });
  };
  const entryError = (error: unknown) =>
    setEntryFeedback({
      title: "Entry point unavailable",
      description: getORPCRequestErrorMessage(error).text,
    });
  const deliveryFeedback = (delivery: "sent" | "failed" | "already-issued") => {
    setEntryFeedback(
      delivery === "sent"
        ? { title: "Invitation sent", description: "Email delivery succeeded." }
        : delivery === "already-issued"
          ? {
              title: "Invitation already issued",
              description: "No new email was sent. Reissue explicitly to resend.",
            }
          : {
              title: "Email delivery failed",
              description:
                "The invitation was created, but email delivery failed. Reissue to try again.",
            },
    );
  };
  const issueInvitation = useMutation({
    mutationFn: () =>
      orpc.participantOnboarding.issueInvitation({ partnershipId, email }),
    onSuccess: async (result) => {
      deliveryFeedback(result.delivery);
      await refresh();
    },
    onError: entryError,
  });
  const reissueInvitation = useMutation({
    mutationFn: (invitationEmail: string) =>
      orpc.participantOnboarding.reissueInvitation({
        partnershipId,
        email: invitationEmail,
      }),
    onSuccess: async (result) => {
      deliveryFeedback(result.delivery);
      await refresh();
    },
    onError: entryError,
  });
  const createLink = useMutation({
    mutationFn: () =>
      orpc.participantOnboarding.createRegistrationLink({ partnershipId }),
    onSuccess: async ({ id, secret }) => {
      setCreatedLink({
        partnershipId,
        id,
        url: `${window.location.origin}/participant-links/${encodeURIComponent(id)}?secret=${encodeURIComponent(secret)}`,
      });
      setEntryFeedback({
        title: "Registration link created",
        description:
          "Copy it now. The secret cannot be recovered after leaving this page.",
      });
      await refresh();
    },
    onError: entryError,
  });
  const closeInvitation = useMutation({
    mutationFn: (invitationId: string) =>
      orpc.participantOnboarding.setInvitationOpen({ invitationId, open: false }),
    onSuccess: async () => {
      setEntryFeedback({
        title: "Invitation closed",
        description: "The invitation can no longer be used.",
      });
      await refresh();
    },
    onError: entryError,
  });
  const closeLink = useMutation({
    mutationFn: (id: string) =>
      orpc.participantOnboarding.setRegistrationLinkOpen({ id, open: false }),
    onSuccess: async (_result, id) => {
      setCreatedLink((current) => (current?.id === id ? undefined : current));
      setEntryFeedback({
        title: "Registration link closed",
        description: "The link can no longer be used.",
      });
      await refresh();
    },
    onError: entryError,
  });
  const reopenLink = useMutation({
    mutationFn: (id: string) =>
      orpc.participantOnboarding.setRegistrationLinkOpen({ id, open: true }),
    onSuccess: async () => {
      setEntryFeedback({
        title: "Registration link reopened",
        description: "The existing link can be used again.",
      });
      await refresh();
    },
    onError: (error) => {
      if (
        error instanceof ORPCError &&
        getSafeErrorSituation(error)?.reason === "REGISTRATION_CLAIM_LOCKED"
      ) {
        setEntryFeedback({
          title: "Registration link cannot be reopened",
          description: "A non-editable Claim prevents reopening registration.",
        });
      } else entryError(error);
    },
  });
  const removeParticipation = useMutation({
    mutationFn: (id: string) => orpc.participations.remove({ partnershipId, id }),
    onSuccess: async () => {
      setFeedback({
        title: "Project Participation removed",
        description: "The scoped list has been refreshed.",
      });
      await refresh();
    },
    onError: (error) => {
      const refusals: Record<string, string> = {
        "Locked Claim prevents Participation removal.":
          "A locked Claim prevents removal of this Project Participation.",
        "Participation is referenced by Claim or merge data; request review instead.":
          "This Project Participation is referenced by a Participant Journey, Claim or merge data. Request review instead.",
        "Participation is referenced; request review instead.":
          "This Project Participation is referenced by other records. Request review instead.",
      };
      setFeedback({
        title: "Unable to remove Project Participation",
        description:
          error instanceof ORPCError && error.code === "BAD_REQUEST"
            ? (refusals[error.message] ?? getORPCRequestErrorMessage(error).text)
            : getORPCRequestErrorMessage(error).text,
      });
    },
  });
  // Hosts may read server-authorized oversight data, but cannot manage Partner
  // Participations here; denied writes show the access-denied surface below.
  const create = useMutation({
    mutationFn: () => orpc.participations.create({ partnershipId, userId }),
    onSuccess: async () => {
      setUserId("");
      setFeedback({
        title: "Participation added",
        description: "The scoped list has been refreshed.",
      });
      await refresh();
    },
    onError: async (error) => {
      setFeedback(mutationFeedback(error));
      if (reviewsOpen) await refresh();
    },
  });

  return (
    <section className="space-y-6" aria-label="Project Participations">
      <p className="text-sm text-muted-foreground">Project: {data.projectName}</p>
      <Card>
        <CardHeader>
          <CardTitle>Add a registered user to this project</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Only add a registered User who has completed profile and agreement
            acceptance. For someone not yet onboarded, send a Participant
            Invitation or create a Participant Registration Link below.
          </p>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              setFeedback(undefined);
              create.mutate();
            }}
          >
            <div className="space-y-2">
              <span className="text-sm font-medium">Registered User</span>
              <EntityCombobox
                label="Registered User"
                value={userId}
                onChange={setUserId}
                search={searchOnboarded}
                searchBy="name, email or ID"
                disabled={create.isPending}
              />
            </div>
            <Button disabled={create.isPending || !userId} type="submit">
              {create.isPending ? "Adding…" : "Add Participation"}
            </Button>
          </form>
          {feedback && (
            <Alert>
              <AlertTitle>{feedback.title}</AlertTitle>
              <AlertDescription>{feedback.description}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Joined Participants</CardTitle>
          {data.participations.length > 0 && (
            <CardDescription>
              {data.participations.length === 1
                ? `1 Participant in ${data.projectName}`
                : `${data.participations.length} Participants in ${data.projectName}`}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {data.participations.length === 0 ? (
            <p>No Participants have joined this Partnership yet.</p>
          ) : (
            <ul className="divide-y">
              {data.participations.map((participant) => (
                <li className="space-y-3 py-4" key={participant.id}>
                  <div className="flex flex-wrap items-center gap-3">
                    <strong>{participant.displayName}</strong>
                    <Badge variant="secondary">Joined</Badge>
                  </div>
                  {participant.email && (
                    <p className="text-sm text-muted-foreground">
                      {participant.email}
                    </p>
                  )}
                  <CountryEditor
                    participant={participant}
                    partnershipId={partnershipId}
                    onSaved={refresh}
                    onError={(error) => setFeedback(mutationFeedback(error))}
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={removeParticipation.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Remove the Project Participation for ${participant.displayName}?`,
                        )
                      ) {
                        setFeedback(undefined);
                        removeParticipation.mutate(participant.id);
                      }
                    }}
                  >
                    Remove Project Participation for {participant.displayName}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Group Organizers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            aria-expanded={coordinatorsOpen}
            onClick={() => setCoordinatorsOpen((open) => !open)}
          >
            {coordinatorsOpen
              ? "Hide Group Organizer management"
              : "Manage Group Organizers"}
          </Button>
          {coordinatorsOpen && (
            <PartnerCoordinatorControls partnershipId={partnershipId} />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Review Tasks</CardTitle>
          <CardDescription>
            Review duplicate Registered User identities. Resolution retains the
            existing Project Participation and does not perform a merge.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setReviewsOpen((open) => !open)}
            aria-expanded={reviewsOpen}
          >
            {reviewsOpen ? "Hide Review Tasks" : "Show Review Tasks"}
          </Button>
          {reviewsOpen && <ReviewTasks partnershipId={partnershipId} />}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Participant Invitations and Registration Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              setEntryFeedback(undefined);
              issueInvitation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="participant-invitation-email">Invitee email</Label>
              <input
                id="participant-invitation-email"
                className="h-9 rounded-md border bg-background px-3 text-sm"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <Button disabled={issueInvitation.isPending} type="submit">
              Send Participant Invitation
            </Button>
          </form>
          <Button
            type="button"
            variant="outline"
            disabled={createLink.isPending}
            onClick={() => {
              setEntryFeedback(undefined);
              createLink.mutate();
            }}
          >
            Create Participant Registration Link
          </Button>
          {createdLink?.partnershipId === partnershipId && (
            <div className="space-y-2">
              <Label htmlFor="new-participant-link">
                New registration link (copy now)
              </Label>
              <input
                id="new-participant-link"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                readOnly
                value={createdLink.url}
                onFocus={(event) => event.currentTarget.select()}
              />
            </div>
          )}
          {entryFeedback && (
            <Alert>
              <AlertTitle>{entryFeedback.title}</AlertTitle>
              <AlertDescription>{entryFeedback.description}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Invitations</CardTitle>
        </CardHeader>
        <CardContent>
          {data.invitations.length === 0 ? (
            <p>No invitations are recorded for this Partnership.</p>
          ) : (
            <ul className="divide-y">
              {data.invitations.map((invitation) => (
                <li
                  className="flex flex-wrap items-center gap-3 py-3"
                  key={invitation.invitationId}
                >
                  <span>{invitation.email}</span>
                  <Badge variant="secondary">
                    {invitation.status === "pending"
                      ? "Invitation pending"
                      : `Invitation ${invitation.status}`}
                  </Badge>
                  {invitation.status === "pending" && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        reissueInvitation.isPending || closeInvitation.isPending
                      }
                      onClick={() => reissueInvitation.mutate(invitation.email)}
                    >
                      Reissue invitation for {invitation.email}
                    </Button>
                  )}
                  {invitation.status === "pending" && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        closeInvitation.isPending || reissueInvitation.isPending
                      }
                      onClick={() =>
                        closeInvitation.mutate(invitation.invitationId)
                      }
                    >
                      Close invitation for {invitation.email}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-sm text-muted-foreground">
            Invitation status does not show profile or agreement progress.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Registration links</CardTitle>
        </CardHeader>
        <CardContent>
          {data.registrationLinks.length === 0 ? (
            <p>No registration links are recorded for this Partnership.</p>
          ) : (
            <ul className="divide-y">
              {data.registrationLinks.map((link) => (
                <li
                  key={link.id}
                  className="flex flex-wrap items-center gap-3 py-3"
                >
                  <span>Link {link.id}</span>
                  <Badge variant="secondary">
                    {link.enabled ? "Open" : "Closed"}
                  </Badge>
                  {link.enabled && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={closeLink.isPending || reopenLink.isPending}
                      onClick={() => closeLink.mutate(link.id)}
                    >
                      Close registration link {link.id}
                    </Button>
                  )}
                  {!link.enabled && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={reopenLink.isPending || closeLink.isPending}
                      onClick={() => {
                        setEntryFeedback(undefined);
                        reopenLink.mutate(link.id);
                      }}
                    >
                      Reopen registration link {link.id}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
