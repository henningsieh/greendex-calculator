"use client";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { useTranslations } from "@greendex/i18n/client";
import { ORPCError } from "@orpc/client";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { useConfirmDialog } from "@/components/confirm-dialog";
import { EntityCombobox } from "@/components/entity-combobox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import {
  participantEntryDenialMessage,
  useParticipantEntryAccess,
} from "@/features/participant-onboarding/hooks/use-participant-entry-access";
import { getSafeErrorSituation } from "@/lib/orpc/error-contract";
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";
import type { Outputs } from "@/lib/orpc/router";

/** Copy for a refused Participation creation; the decision itself stays server-side. */
function createFeedback(error: unknown) {
  if (
    error instanceof ORPCError &&
    getSafeErrorSituation(error)?.reason === "PARTICIPATION_DUPLICATE"
  ) {
    return {
      title: "Review request",
      description:
        "This Registered User may already participate in this Project. Open Review Tasks to review the duplicate identity, then contact the Hosting Organization to request a merge review if needed. No new Project Participation was added.",
      outcome: "duplicate-review" as const,
    };
  }
  if (error instanceof ORPCError && error.code === "FORBIDDEN")
    return {
      title: "Access denied",
      description: getORPCRequestErrorMessage(error).text,
      outcome: "access-denied" as const,
    };
  return {
    title: "Unable to add Participation",
    description: getORPCRequestErrorMessage(error).text,
    outcome: "create-failed" as const,
  };
}

function removeRefusalFeedback(error: unknown) {
  const refusals: Record<string, string> = {
    PARTICIPATION_REMOVE_LOCKED:
      "A locked Claim prevents removal of this Project Participation.",
    PARTICIPATION_JOURNEY_OR_COST_REFERENCED:
      "This Project Participation is referenced by a Participant Journey or Cost Allocation. Request review instead.",
    PARTICIPATION_REFERENCED:
      "This Project Participation is referenced by other records. Request review instead.",
  };
  return {
    title: "Unable to remove Project Participation",
    description:
      error instanceof ORPCError && error.code === "BAD_REQUEST"
        ? (refusals[getSafeErrorSituation(error)?.reason ?? ""] ??
          getORPCRequestErrorMessage(error).text)
        : getORPCRequestErrorMessage(error).text,
    outcome: "remove-refused" as const,
  };
}

const reopenRefusedFeedback = {
  title: "Registration link cannot be reopened",
  description: "A non-editable Claim prevents reopening registration.",
  outcome: "reopen-refused",
} as const;

type ReviewTask = Outputs["duplicateReviews"]["list"][number];
type ReviewDecision = NonNullable<ReviewTask["decision"]>;
const reviewDecisions: { value: ReviewDecision; label: string }[] = [
  { value: "same_person", label: "Same person" },
  { value: "distinct_persons", label: "Distinct persons" },
  { value: "dismiss", label: "Dismiss" },
];

function ReviewTaskControls({
  task,
  canMutate,
  refresh,
  onFeedback,
}: {
  task: ReviewTask;
  canMutate: boolean;
  refresh: () => Promise<void>;
  onFeedback: (message: string) => void;
}) {
  const tPart = useTranslations("participations");
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
    <li
      className="space-y-3 py-4"
      data-task-status={task.status}
      data-task-decision={task.decision ?? "none"}
    >
      <p>
        {tPart("review.registeredUser")} {task.candidateEmail}
      </p>
      <Badge variant="secondary">
        {tPart("review.task")} {task.status}
      </Badge>
      <p className="text-sm">
        {tPart("review.existingParticipation")} {task.existingParticipationId}
      </p>
      {task.assignedToUserId && (
        <p className="text-sm">
          {tPart("review.assignedUser")} {task.assignedToUserId}
        </p>
      )}
      {canMutate && task.status === "open" && (
        <Button
          type="button"
          variant="outline"
          disabled={assign.isPending}
          data-testid="review-task-assign"
          onClick={() => assign.mutate()}
        >
          {tPart("review.assignToMe")}
        </Button>
      )}
      {canMutate && task.status === "assigned" && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor={`review-decision-${task.id}`}>
              {tPart("review.decision")}
            </Label>
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              id={`review-decision-${task.id}`}
              data-testid={`review-decision-${task.id}`}
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
            data-testid="review-task-resolve"
            onClick={() => resolve.mutate()}
          >
            {tPart("review.resolve")}
          </Button>
        </div>
      )}
      {task.decision && (
        <p>
          {tPart("review.decisionLabel")}{" "}
          {reviewDecisions.find((entry) => entry.value === task.decision)?.label}
        </p>
      )}
    </li>
  );
}

function ReviewTasks({
  partnershipId,
  canMutate,
}: {
  partnershipId: string;
  canMutate: boolean;
}) {
  const tPart = useTranslations("participations");
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
    <section
      aria-label={tPart("review.tasksLabel")}
      data-testid="review-tasks"
      className="space-y-4"
    >
      {tasks.isPending ? (
        <output>{tPart("review.loading")}</output>
      ) : tasks.isError ? (
        <Alert>
          <AlertTitle>{tPart("review.loadError")}</AlertTitle>
          <AlertDescription>
            {getORPCRequestErrorMessage(tasks.error).text}
          </AlertDescription>
          <Button
            type="button"
            variant="outline"
            onClick={() => void tasks.refetch()}
          >
            {tPart("review.retry")}
          </Button>
        </Alert>
      ) : tasks.data.length === 0 ? (
        <p>{tPart("review.empty")}</p>
      ) : (
        <ul className="divide-y">
          {tasks.data.map((task) => (
            <ReviewTaskControls
              key={task.id}
              task={task}
              canMutate={canMutate}
              refresh={refresh}
              onFeedback={setFeedback}
            />
          ))}
        </ul>
      )}
      {feedback && (
        <Alert>
          <AlertTitle>{tPart("review.update")}</AlertTitle>
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
  const tPart = useTranslations("participations");
  const t = useTranslations("projects.confirmations");
  const { confirm, dialog } = useConfirmDialog();
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
  if (members.isPending)
    return <output>{tPart("groupOrganizer.loadingUsers")}</output>;
  if (members.isError)
    return (
      <Alert>
        <AlertTitle>{tPart("groupOrganizer.unavailable")}</AlertTitle>
        <AlertDescription>
          {getORPCRequestErrorMessage(members.error).text}
        </AlertDescription>
        <Button
          type="button"
          variant="outline"
          onClick={() => void members.refetch()}
        >
          {tPart("groupOrganizer.retryUsers")}
        </Button>
      </Alert>
    );
  const eligible = members.data.members.filter((entry) =>
    entry.role
      .split(",")
      .some((role) =>
        [
          ORGANIZATION_ROLES.OrganizationOwner,
          ORGANIZATION_ROLES.OrganizationAdmin,
          ORGANIZATION_ROLES.ProjectCoordinator,
        ].some((knownRole) => knownRole === role.trim()),
      ),
  );
  return (
    <div className="space-y-4">
      {dialog}
      <p className="text-sm text-muted-foreground">
        {tPart("groupOrganizer.description")}
      </p>
      <div className="space-y-2">
        <Label htmlFor={`group-organizer-${partnershipId}`}>
          {tPart("groupOrganizer.registeredUserLabel")}
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
          <option value="">{tPart("groupOrganizer.selectUser")}</option>
          {eligible.map((entry) => (
            <option key={entry.userId} value={entry.userId}>
              {entry.name} ({entry.email})
            </option>
          ))}
        </select>
      </div>
      {eligible.length === 0 && <p>{tPart("groupOrganizer.noEligible")}</p>}
      <div className="flex flex-wrap gap-3">
        <Button
          data-testid="assign-group-organizer"
          type="button"
          disabled={!targetUserId || assign.isPending || revoke.isPending}
          onClick={() => {
            setFeedback("");
            assign.mutate();
          }}
        >
          {tPart("groupOrganizer.assign")}
        </Button>
        <Button
          data-testid="revoke-group-organizer"
          type="button"
          variant="outline"
          disabled={!targetUserId || assign.isPending || revoke.isPending}
          onClick={async () => {
            if (
              await confirm({
                title: t("revokeOrganizer.title"),
                description: t("revokeOrganizer.description", {
                  user:
                    eligible.find((entry) => entry.userId === targetUserId)
                      ?.name ?? targetUserId,
                }),
                confirmText: t("revokeOrganizer.execute"),
                isDestructive: true,
              })
            ) {
              setFeedback("");
              revoke.mutate();
            }
          }}
        >
          {revoke.isPending ? t("pending") : "Revoke Group Organizer assignment"}
        </Button>
      </div>
      {feedback && (
        <Alert>
          <AlertTitle>{tPart("groupOrganizer.update")}</AlertTitle>
          <AlertDescription>{feedback}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/** The list and mutations are scoped by the server's Partnership authorization, not client filtering. */
function ParticipantInvitations({
  data,
  entryAccess,
  reissueInvitation,
  closeInvitation,
  entryDenial,
}: {
  data: Pick<Outputs["participations"]["listPartnership"], "invitations">;
  entryAccess: { permitted: boolean };
  reissueInvitation: { isPending: boolean; mutate: (email: string) => void };
  closeInvitation: { isPending: boolean; mutate: (id: string) => void };
  entryDenial: string | undefined;
}) {
  const tPart = useTranslations("participations");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{tPart("invitations.title")}</CardTitle>
        <CardDescription>{tPart("invitations.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.invitations.length === 0 ? (
          <p>{tPart("invitations.empty")}</p>
        ) : (
          <ul className="divide-y">
            {data.invitations.map((invitation) => (
              <li
                className="flex flex-wrap items-center gap-3 py-3"
                key={invitation.invitationId}
                data-testid={`participant-invitation-${invitation.invitationId}`}
                data-invitation-status={invitation.status}
              >
                <span>{invitation.email}</span>
                <Badge variant="secondary">
                  {invitation.status === "pending"
                    ? "Invitation pending"
                    : `Invitation ${invitation.status}`}
                </Badge>
                {entryAccess.permitted && invitation.status === "pending" && (
                  <Button
                    data-testid="reissue-participant-invitation"
                    type="button"
                    variant="outline"
                    disabled={
                      reissueInvitation.isPending || closeInvitation.isPending
                    }
                    onClick={() => reissueInvitation.mutate(invitation.email)}
                  >
                    {tPart("invitations.reissue")} {invitation.email}
                  </Button>
                )}
                {entryAccess.permitted && invitation.status === "pending" && (
                  <Button
                    data-testid={`close-participant-invitation-${invitation.invitationId}`}
                    type="button"
                    variant="outline"
                    disabled={
                      closeInvitation.isPending || reissueInvitation.isPending
                    }
                    onClick={() =>
                      closeInvitation.mutate(invitation.invitationId)
                    }
                  >
                    {tPart("invitations.close")} {invitation.email}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-sm text-muted-foreground">
          {tPart("invitations.statusHint")}
        </p>
        {entryDenial && (
          <p className="mt-2 text-sm text-muted-foreground">{entryDenial}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ParticipantRegistrationLinks({
  data,
  entryAccess,
  closeLink,
  reopenLink,
  entryDenial,
  setEntryFeedback,
}: {
  data: Pick<Outputs["participations"]["listPartnership"], "registrationLinks">;
  entryAccess: { permitted: boolean };
  closeLink: { isPending: boolean; mutate: (id: string) => void };
  reopenLink: { isPending: boolean; mutate: (id: string) => void };
  entryDenial: string | undefined;
  setEntryFeedback: (value: undefined) => void;
}) {
  const tPart = useTranslations("participations");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{tPart("links.title")}</CardTitle>
        <CardDescription>{tPart("links.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.registrationLinks.length === 0 ? (
          <p>{tPart("links.empty")}</p>
        ) : (
          <ul className="divide-y">
            {data.registrationLinks.map((link) => (
              <li
                data-link-open={String(link.enabled)}
                data-testid={`registration-link-${link.id}`}
                key={link.id}
                className="flex flex-wrap items-center gap-3 py-3"
              >
                <span>
                  {tPart("links.link")} {link.id}
                </span>
                <Badge variant="secondary">
                  {link.enabled ? "Open" : "Closed"}
                </Badge>
                {entryAccess.permitted && link.enabled && (
                  <Button
                    data-testid="close-registration-link"
                    type="button"
                    variant="outline"
                    disabled={closeLink.isPending || reopenLink.isPending}
                    onClick={() => closeLink.mutate(link.id)}
                  >
                    {tPart("links.close")} {link.id}
                  </Button>
                )}
                {entryAccess.permitted && !link.enabled && (
                  <Button
                    data-testid="reopen-registration-link"
                    type="button"
                    variant="outline"
                    disabled={reopenLink.isPending || closeLink.isPending}
                    onClick={() => {
                      setEntryFeedback(undefined);
                      reopenLink.mutate(link.id);
                    }}
                  >
                    {tPart("links.reopen")} {link.id}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {entryDenial && (
          <p className="mt-4 text-sm text-muted-foreground">{entryDenial}</p>
        )}
      </CardContent>
    </Card>
  );
}

function JoinedParticipants({
  data,
  partnershipId,
  entryAccess,
  removeParticipation,
  confirm,
  setFeedback,
}: {
  data: Pick<
    Outputs["participations"]["listPartnership"],
    "participations" | "projectName"
  >;
  partnershipId: string;
  entryAccess: { permitted: boolean };
  removeParticipation: {
    isPending: boolean;
    variables: string | undefined;
    mutate: (id: string) => void;
  };
  confirm: ReturnType<typeof useConfirmDialog>["confirm"];
  setFeedback: (value: undefined) => void;
}) {
  const tPart = useTranslations("participations");
  const t = useTranslations("projects.confirmations");
  return (
    <Card data-testid="joined-participants">
      <CardHeader>
        <CardTitle>{tPart("joined.title")}</CardTitle>
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
          <Empty data-testid="joined-participants-empty">
            <EmptyHeader>
              <EmptyTitle>{tPart("joined.empty")}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="divide-y">
            {data.participations.map((participant) => (
              <li
                className="space-y-3 py-4"
                data-testid={`joined-participant-${participant.id}`}
                key={participant.id}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <strong>{participant.displayName}</strong>
                  <Badge variant="secondary" data-participation-state="joined">
                    {tPart("joined.joined")}
                  </Badge>
                </div>
                {participant.email && (
                  <p className="text-sm text-muted-foreground">
                    {participant.email}
                  </p>
                )}
                <p className="flex flex-wrap items-center gap-3 text-sm">
                  <span>{tPart("joined.country")}</span>
                  <Badge variant="secondary">
                    {participant.country ?? "Not set"}
                  </Badge>
                </p>
                {/* Editing belongs on the details page, never in a list row (ADR-0016). */}
                <Link
                  className={buttonVariants({ variant: "outline" })}
                  href={`/partnerships/${encodeURIComponent(partnershipId)}/participants/${encodeURIComponent(participant.id)}`}
                  data-testid={`participant-details-${participant.id}`}
                >
                  {tPart("joined.detailsFor")} {participant.displayName}
                </Link>
                {entryAccess.permitted && (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={removeParticipation.isPending}
                    data-testid={`remove-participation-${participant.id}`}
                    onClick={async () => {
                      if (
                        await confirm({
                          title: t("removeParticipation.title"),
                          description: t("removeParticipation.description", {
                            participant: participant.displayName,
                          }),
                          confirmText: t("removeParticipation.execute"),
                          isDestructive: true,
                        })
                      ) {
                        setFeedback(undefined);
                        removeParticipation.mutate(participant.id);
                      }
                    }}
                  >
                    {removeParticipation.isPending &&
                    removeParticipation.variables === participant.id
                      ? t("pending")
                      : `Remove Project Participation for ${participant.displayName}`}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function ParticipantCoordination({
  partnershipId,
}: {
  partnershipId: string;
}) {
  const tPart = useTranslations("participations");
  const { confirm, dialog } = useConfirmDialog();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(
    orpcQuery.participations.listPartnership.queryOptions({
      input: { partnershipId },
      meta: { costTrackerORPC: true },
    }),
  );
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  // One shared Project-scope policy decides entry controls; the server enforces
  // it again per request, so a stale or forged decision confers no authority.
  const entryAccess = useParticipantEntryAccess(data.entryContext);
  const entryDenial = participantEntryDenialMessage(entryAccess);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [coordinatorsOpen, setCoordinatorsOpen] = useState(false);
  const [createdLink, setCreatedLink] = useState<{
    partnershipId: string;
    id: string;
    url: string;
  }>();
  const [entryFeedback, setEntryFeedback] = useState<
    { title: string; description: string } | typeof reopenRefusedFeedback
  >();
  const searchOnboarded = (search: string) =>
    orpc.participations.searchOnboarded({ partnershipId, search });
  const [feedback, setFeedback] = useState<
    | ReturnType<typeof createFeedback>
    | ReturnType<typeof removeRefusalFeedback>
    | { title: string; description: string }
  >();
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
        setEntryFeedback(reopenRefusedFeedback);
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
      setFeedback(removeRefusalFeedback(error));
    },
  });
  // Hosts retain read-only oversight; the shared scope gate hides Partner writes.
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
      setFeedback(createFeedback(error));
      if (reviewsOpen) await refresh();
    },
  });

  return (
    <section
      data-testid="project-participations"
      className="space-y-6"
      aria-label={tPart("page.label")}
      data-entry-denial={entryAccess.permitted ? undefined : entryAccess.reason}
    >
      {dialog}
      <p className="text-sm text-muted-foreground">
        {tPart("page.project")} {data.projectName}
      </p>
      {entryAccess.permitted && (
        <Card>
          <CardHeader>
            <CardTitle>{tPart("page.addUser")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {tPart("page.addUserDescription")}
            </p>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                setFeedback(undefined);
                create.mutate();
              }}
            >
              <div className="space-y-2" data-testid="participation-user-picker">
                <span className="text-sm font-medium">
                  {tPart("page.registeredUser")}
                </span>
                <EntityCombobox
                  label={tPart("page.registeredUserLabel")}
                  value={userId}
                  onChange={setUserId}
                  search={searchOnboarded}
                  searchBy="name, email or ID"
                  disabled={create.isPending}
                />
              </div>
              <Button
                data-testid="participation-add"
                disabled={create.isPending || !userId}
                type="submit"
              >
                {create.isPending ? "Adding…" : "Add Participation"}
              </Button>
            </form>
            {feedback && (
              <Alert
                data-feedback-outcome={
                  "outcome" in feedback ? feedback.outcome : undefined
                }
              >
                <AlertTitle>{feedback.title}</AlertTitle>
                <AlertDescription>{feedback.description}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
      <JoinedParticipants
        data={data}
        partnershipId={partnershipId}
        entryAccess={entryAccess}
        removeParticipation={removeParticipation}
        confirm={confirm}
        setFeedback={setFeedback}
      />
      {entryAccess.permitted && (
        <Card>
          <CardHeader>
            <CardTitle>{tPart("page.groupOrganizers")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              data-testid="manage-group-organizers"
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
      )}
      <Card>
        <CardHeader>
          <CardTitle>{tPart("page.reviewTasks")}</CardTitle>
          <CardDescription>
            {tPart("page.reviewTasksDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            data-testid="review-tasks-toggle"
            onClick={() => setReviewsOpen((open) => !open)}
            aria-expanded={reviewsOpen}
          >
            {reviewsOpen ? "Hide Review Tasks" : "Show Review Tasks"}
          </Button>
          {reviewsOpen && (
            <ReviewTasks
              partnershipId={partnershipId}
              canMutate={entryAccess.permitted}
            />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{tPart("page.invitationsTitle")}</CardTitle>
          <CardDescription>
            {tPart("page.invitationsDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {entryDenial ? (
            <p className="text-sm text-muted-foreground">{entryDenial}</p>
          ) : (
            <>
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  setEntryFeedback(undefined);
                  issueInvitation.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="participant-invitation-email">
                    {tPart("page.inviteeEmail")}
                  </Label>
                  <input
                    id="participant-invitation-email"
                    data-testid="participant-invitation-email"
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                <Button
                  data-testid="send-participant-invitation"
                  disabled={issueInvitation.isPending}
                  type="submit"
                >
                  {tPart("page.sendInvitation")}
                </Button>
              </form>
              <Button
                data-testid="create-registration-link"
                type="button"
                variant="outline"
                disabled={createLink.isPending}
                onClick={() => {
                  setEntryFeedback(undefined);
                  createLink.mutate();
                }}
              >
                {tPart("page.createLink")}
              </Button>
              {createdLink?.partnershipId === partnershipId && (
                <div className="space-y-2">
                  <Label htmlFor="new-participant-link">
                    {tPart("page.newLink")}
                  </Label>
                  <input
                    id="new-participant-link"
                    data-testid="new-registration-link"
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    readOnly
                    value={createdLink.url}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                </div>
              )}
            </>
          )}
          {entryFeedback && (
            <Alert
              data-invitation-delivery={issueInvitation.data?.delivery}
              data-reissue-delivery={reissueInvitation.data?.delivery}
              data-link-creation-status={createLink.status}
              data-entry-outcome={
                "outcome" in entryFeedback ? entryFeedback.outcome : undefined
              }
            >
              <AlertTitle>{entryFeedback.title}</AlertTitle>
              <AlertDescription>{entryFeedback.description}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      <ParticipantInvitations
        data={data}
        entryAccess={entryAccess}
        reissueInvitation={reissueInvitation}
        closeInvitation={closeInvitation}
        entryDenial={entryDenial}
      />
      <ParticipantRegistrationLinks
        data={data}
        entryAccess={entryAccess}
        closeLink={closeLink}
        reopenLink={reopenLink}
        entryDenial={entryDenial}
        setEntryFeedback={setEntryFeedback}
      />
    </section>
  );
}
