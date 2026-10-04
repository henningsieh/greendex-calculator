/** One Project Participation as the Hosting report reads it. */
export type HostedParticipantRow = {
  participationId: string;
  organizationId: string;
  organizationName: string;
  displayName: string;
  email: string | null;
  accountEmail: string | null;
  country: string | null;
  userId: string | null;
};

export type HostedParticipantAgreementStatus = "completed" | "pending";

export type HostedParticipantGroup = {
  id: string;
  name: string;
  // Organizations carry no country attribute yet; the report renders the value
  // as not recorded rather than borrowing another Organization's data.
  country: null;
  participantCount: number;
  completedCount: number;
  pendingCount: number;
  participants: {
    id: string;
    displayName: string;
    email: string | null;
    country: string | null;
    agreement: HostedParticipantAgreementStatus;
  }[];
};

/**
 * Groups actual Project Participations by the Organization they represent
 * (ADR-0016). Every row lands in exactly one group, so each Participation is
 * counted once across the group totals and the whole report. Acceptance is
 * User-owned and versioned, so only a User holding the current required
 * version counts as completed: a missing User or an older acceptance is
 * pending. No Invitee and no unknown Participant Registration Link holder is
 * invented here, so the report never implies a pre-join funnel.
 */
export function groupHostedParticipants(
  rows: HostedParticipantRow[],
  acceptsCurrentVersion: (userId: string) => boolean,
): HostedParticipantGroup[] {
  const groups = new Map<string, HostedParticipantGroup>();
  for (const row of rows) {
    const group = groups.get(row.organizationId) ?? {
      id: row.organizationId,
      name: row.organizationName,
      country: null,
      participantCount: 0,
      completedCount: 0,
      pendingCount: 0,
      participants: [],
    };
    const completed = row.userId !== null && acceptsCurrentVersion(row.userId);
    group.participants.push({
      id: row.participationId,
      displayName: row.displayName,
      email: row.email ?? row.accountEmail,
      country: row.country,
      agreement: completed ? ("completed" as const) : ("pending" as const),
    });
    group.participantCount += 1;
    if (completed) group.completedCount += 1;
    else group.pendingCount += 1;
    groups.set(row.organizationId, group);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      participants: group.participants.sort((left, right) =>
        left.displayName.localeCompare(right.displayName, "en"),
      ),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "en"));
}
