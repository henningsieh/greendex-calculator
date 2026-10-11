"use client";

import { useTranslations } from "@greendex/i18n/client";
import { Suspense } from "react";

import {
  TeamTableSkeleton,
  UsersTable,
} from "@/features/organizations/components/users-table";
import { MEMBER_ROLES } from "@/features/organizations/types";

interface ParticipantsTableProps {
  organizationId: string;
}

/**
 * Participants table component
 * Displays organization Memberships with the Participant role (project participants)
 * Reuses the UsersTable component but without the invite functionality
 */
export function ParticipantsTable({ organizationId }: ParticipantsTableProps) {
  const t = useTranslations("organization.participants");
  return (
    <Suspense fallback={<TeamTableSkeleton />}>
      <UsersTable
        emptyDescription={t("emptyState.description")}
        emptyTitle={t("emptyState.title")}
        organizationId={organizationId}
        roles={[MEMBER_ROLES.Participant]}
        showInviteButton={false}
      />
    </Suspense>
  );
}
