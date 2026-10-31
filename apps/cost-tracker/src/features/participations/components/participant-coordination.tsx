"use client";

import { useTranslations } from "@greendex/i18n/client";
import { ORPCError } from "@orpc/client";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useState } from "react";

import { useConfirmDialog } from "@/components/confirm-dialog";
import { EntityCombobox } from "@/components/entity-combobox";
import { ErrorPresentation } from "@/components/error-presentation/error-presentation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  participantEntryDenialMessage,
  useParticipantEntryAccess,
} from "@/features/participant-onboarding/hooks/use-participant-entry-access";
import { JoinedParticipants } from "@/features/participations/components/joined-participants";
import {
  ParticipantInvitations,
  ParticipantRegistrationLinks,
} from "@/features/participations/components/participant-invitation-sections";
import { ReviewTasks } from "@/features/participations/components/participant-review-tasks";
import { PartnerCoordinatorControls } from "@/features/participations/components/partner-coordinator-controls";
import { getSafeErrorSituation } from "@/lib/orpc/error-contract";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";

/** Copy for a refused Participation creation; the decision itself stays server-side. */
function createFeedback(error: unknown) {
  if (
    error instanceof ORPCError &&
    getSafeErrorSituation(error)?.reason === "PARTICIPATION_DUPLICATE"
  ) {
    return {
      title: "Review request",
      description: <ErrorPresentation error={error} />,
      outcome: "duplicate-review" as const,
    };
  }
  if (error instanceof ORPCError && error.code === "FORBIDDEN")
    return {
      title: "Access denied",
      description: <ErrorPresentation error={error} />,
      outcome: "access-denied" as const,
    };
  return {
    title: "Unable to add Participation",
    description: <ErrorPresentation error={error} />,
    outcome: "create-failed" as const,
  };
}

function removeRefusalFeedback(error: unknown) {
  return {
    title: "Unable to remove Project Participation",
    description: <ErrorPresentation error={error} />,
    outcome: "remove-refused" as const,
  };
}

const reopenRefusedFeedback = {
  title: "Registration link cannot be reopened",
  outcome: "reopen-refused",
} as const;

export function ParticipantCoordination({
  partnershipId,
}: {
  partnershipId: string;
}) {
  const t = useTranslations("participations");
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
    | { title: string; description: React.ReactNode }
    | (typeof reopenRefusedFeedback & { description: React.ReactNode })
  >();
  const searchOnboarded = (search: string) =>
    orpc.participations.searchOnboarded({ partnershipId, search });
  const [feedback, setFeedback] = useState<
    | ReturnType<typeof createFeedback>
    | ReturnType<typeof removeRefusalFeedback>
    | { title: string; description: React.ReactNode }
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
      description: <ErrorPresentation error={error} />,
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
          ...reopenRefusedFeedback,
          description: <ErrorPresentation error={error} />,
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
      aria-label={t("page.label")}
      data-entry-denial={entryAccess.permitted ? undefined : entryAccess.reason}
    >
      {dialog}
      <p className="text-sm text-muted-foreground">
        {t("page.project")} {data.projectName}
      </p>
      {entryAccess.permitted && (
        <Card>
          <CardHeader>
            <CardTitle>{t("page.addUser")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("page.addUserDescription")}
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
                  {t("page.registeredUser")}
                </span>
                <EntityCombobox
                  label={t("page.registeredUserLabel")}
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
                {create.isPending ? t("page.adding") : t("page.add")}
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
            <CardTitle>{t("page.groupOrganizers")}</CardTitle>
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
                ? t("page.hideOrganizers")
                : t("page.manageOrganizers")}
            </Button>
            {coordinatorsOpen && (
              <PartnerCoordinatorControls partnershipId={partnershipId} />
            )}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{t("page.reviewTasks")}</CardTitle>
          <CardDescription>{t("page.reviewTasksDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            data-testid="review-tasks-toggle"
            onClick={() => setReviewsOpen((open) => !open)}
            aria-expanded={reviewsOpen}
          >
            {reviewsOpen ? t("page.hideReviews") : t("page.showReviews")}
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
          <CardTitle>{t("page.invitationsTitle")}</CardTitle>
          <CardDescription>{t("page.invitationsDescription")}</CardDescription>
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
                    {t("page.inviteeEmail")}
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
                  {t("page.sendInvitation")}
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
                {t("page.createLink")}
              </Button>
              {createdLink?.partnershipId === partnershipId && (
                <div className="space-y-2">
                  <Label htmlFor="new-participant-link">
                    {t("page.newLink")}
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
