"use client";

import { useTranslations } from "@greendex/i18n/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ErrorPresentation } from "@/components/error-presentation/error-presentation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";
import type { Outputs } from "@/lib/orpc/router";

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
  onFeedback: (message: React.ReactNode) => void;
}) {
  const t = useTranslations("participations");
  const [decision, setDecision] = useState<ReviewDecision>("same_person");
  const onError = (error: unknown) =>
    onFeedback(<ErrorPresentation error={error} />);
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
        {t("review.registeredUser")} {task.candidateEmail}
      </p>
      <Badge variant="secondary">
        {t("review.task")} {task.status}
      </Badge>
      <p className="text-sm">
        {t("review.existingParticipation")} {task.existingParticipationId}
      </p>
      {task.assignedToUserId && (
        <p className="text-sm">
          {t("review.assignedUser")} {task.assignedToUserId}
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
          {t("review.assignToMe")}
        </Button>
      )}
      {canMutate && task.status === "assigned" && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor={`review-decision-${task.id}`}>
              {t("review.decision")}
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
            {t("review.resolve")}
          </Button>
        </div>
      )}
      {task.decision && (
        <p>
          {t("review.decisionLabel")}{" "}
          {reviewDecisions.find((entry) => entry.value === task.decision)?.label}
        </p>
      )}
    </li>
  );
}

export function ReviewTasks({
  partnershipId,
  canMutate,
}: {
  partnershipId: string;
  canMutate: boolean;
}) {
  const t = useTranslations("participations");
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<React.ReactNode>("");
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
      aria-label={t("review.tasksLabel")}
      data-testid="review-tasks"
      className="space-y-4"
    >
      {tasks.isPending ? (
        <output>{t("review.loading")}</output>
      ) : tasks.isError ? (
        <Alert>
          <AlertTitle>{t("review.loadError")}</AlertTitle>
          <AlertDescription>
            {<ErrorPresentation error={tasks.error} />}
          </AlertDescription>
          <Button
            type="button"
            variant="outline"
            onClick={() => void tasks.refetch()}
          >
            {t("review.retry")}
          </Button>
        </Alert>
      ) : tasks.data.length === 0 ? (
        <p>{t("review.empty")}</p>
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
          <AlertTitle>{t("review.update")}</AlertTitle>
          <AlertDescription>{feedback}</AlertDescription>
        </Alert>
      )}
    </section>
  );
}
