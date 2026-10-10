import { defineRelations } from "drizzle-orm";

import {
  account,
  invitation,
  member,
  organization,
  session,
  user,
} from "./schemas/auth-schema";
import {
  hostProjectAssignmentsTable,
  projectParticipantsTable,
  projectPartnerOrganizationsTable,
  projectSharedTravelLegsTable,
  projectsTable,
} from "./schemas/project-schema";

export const relations = defineRelations(
  {
    user,
    session,
    account,
    organization,
    member,
    invitation,
    projectsTable,
    hostProjectAssignmentsTable,
    projectSharedTravelLegsTable,
    projectPartnerOrganizationsTable,
    projectParticipantsTable,
  },
  (r) => ({
    user: {
      sessions: r.many.session(),
      accounts: r.many.account(),
      members: r.many.member(),
      invitations: r.many.invitation(),
    },
    session: {
      user: r.one.user({
        from: r.session.userId,
        to: r.user.id,
      }),
    },
    account: {
      user: r.one.user({
        from: r.account.userId,
        to: r.user.id,
      }),
    },
    organization: {
      members: r.many.member(),
      invitations: r.many.invitation(),
    },
    member: {
      organization: r.one.organization({
        from: r.member.organizationId,
        to: r.organization.id,
      }),
      user: r.one.user({
        from: r.member.userId,
        to: r.user.id,
      }),
    },
    invitation: {
      organization: r.one.organization({
        from: r.invitation.organizationId,
        to: r.organization.id,
      }),
      user: r.one.user({
        from: r.invitation.inviterId,
        to: r.user.id,
      }),
    },
    projectsTable: {
      hostAssignments: r.many.hostProjectAssignmentsTable(),
      organization: r.one.organization({
        from: r.projectsTable.organizationId,
        to: r.organization.id,
      }),
      sharedTravelLegs: r.many.projectSharedTravelLegsTable(),
      participants: r.many.projectParticipantsTable(),
      partnerOrganizations: r.many.projectPartnerOrganizationsTable(),
    },
    hostProjectAssignmentsTable: {
      project: r.one.projectsTable({
        from: r.hostProjectAssignmentsTable.projectId,
        to: r.projectsTable.id,
      }),
      user: r.one.user({
        from: r.hostProjectAssignmentsTable.userId,
        to: r.user.id,
      }),
    },
    projectSharedTravelLegsTable: {
      project: r.one.projectsTable({
        from: r.projectSharedTravelLegsTable.projectId,
        to: r.projectsTable.id,
      }),
    },
    projectPartnerOrganizationsTable: {
      project: r.one.projectsTable({
        from: r.projectPartnerOrganizationsTable.projectId,
        to: r.projectsTable.id,
      }),
      organization: r.one.organization({
        from: r.projectPartnerOrganizationsTable.organizationId,
        to: r.organization.id,
      }),
    },
    projectParticipantsTable: {
      project: r.one.projectsTable({
        from: r.projectParticipantsTable.projectId,
        to: r.projectsTable.id,
      }),
      representedOrganization: r.one.organization({
        from: r.projectParticipantsTable.representedOrganizationId,
        to: r.organization.id,
      }),
      user: r.one.user({
        from: r.projectParticipantsTable.userId,
        to: r.user.id,
        alias: "projectParticipationUser",
      }),
      mergedIntoParticipant: r.one.projectParticipantsTable({
        from: r.projectParticipantsTable.mergedIntoParticipantId,
        to: r.projectParticipantsTable.id,
        alias: "mergedProjectParticipation",
      }),
      mergedByUser: r.one.user({
        from: r.projectParticipantsTable.mergedByUserId,
        to: r.user.id,
        alias: "projectParticipationMergedByUser",
      }),
    },
  }),
);
