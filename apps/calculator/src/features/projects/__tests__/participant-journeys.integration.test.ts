import { createHmac, randomUUID } from "node:crypto";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import {
  member,
  organization,
  participantJourneysTable,
  projectParticipantsTable,
  projectsTable,
  session,
  user,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";

import { auth } from "@/lib/better-auth";
import { router } from "@/lib/orpc/router";

const id = randomUUID();
const otherOrganizationId = randomUUID();
const otherProjectId = randomUUID();
const withoutJourneyId = randomUUID();
const unlinkedProjectId = randomUUID();
const unlinkedParticipationId = randomUUID();
let headers: Headers;
const client = createRouterClient(router, { context: () => ({ headers }) });

beforeAll(async () => {
  await db
    .insert(user)
    .values({ id, name: "Shared Participant", email: `${id}@example.com` });
  await db.insert(organization).values({
    id,
    name: "Journey Organization",
    slug: id,
    country: "DE",
    createdAt: new Date(),
  });
  await db.insert(organization).values({
    id: otherOrganizationId,
    name: "Another Organization",
    slug: otherOrganizationId,
    country: "FR",
    createdAt: new Date(),
  });
  await db.insert(member).values({
    id,
    userId: id,
    organizationId: id,
    role: ORGANIZATION_ROLES.OrganizationOwner,
    createdAt: new Date(),
  });
  await db.insert(member).values({
    id: randomUUID(),
    userId: id,
    organizationId: otherOrganizationId,
    role: ORGANIZATION_ROLES.OrganizationOwner,
    createdAt: new Date(),
  });
  await db.insert(projectsTable).values(
    [id, otherProjectId, unlinkedProjectId].map((projectId) => ({
      id: projectId,
      organizationId: id,
      name: "Journey Project",
      startDate: new Date(),
      endDate: new Date(),
      location: "Berlin",
      country: "DE" as const,
    })),
  );
  await db.insert(projectParticipantsTable).values([
    {
      id,
      projectId: id,
      representedOrganizationId: id,
      displayName: "Shared Participant",
      userId: id,
    },
    {
      id: withoutJourneyId,
      projectId: otherProjectId,
      representedOrganizationId: id,
      displayName: "Shared Participant",
      userId: id,
    },
    {
      id: unlinkedParticipationId,
      projectId: unlinkedProjectId,
      representedOrganizationId: id,
      displayName: "Participation without a login",
      email: "unlinked-participant@example.com",
      userId: null,
    },
  ]);
  await db.insert(participantJourneysTable).values({
    id,
    projectParticipantId: id,
    origin: "Paris",
    destination: "Berlin",
    tripType: "round-trip",
    erasmusDistanceKm: "878.00",
  });
  await db.insert(participantJourneysTable).values({
    id: unlinkedParticipationId,
    projectParticipantId: unlinkedParticipationId,
    origin: "Prague",
    destination: "Berlin",
    tripType: "one-way",
    erasmusDistanceKm: "350.00",
  });
  const token = randomUUID();
  await db.insert(session).values({
    id,
    userId: id,
    token,
    activeOrganizationId: id,
    expiresAt: new Date(Date.now() + 60_000),
  });
  const context = await auth.$context;
  const signature = createHmac("sha256", context.secret)
    .update(token)
    .digest("base64");
  headers = new Headers({
    cookie: `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${signature}`)}`,
  });
});

afterAll(async () => {
  await db.delete(projectsTable).where(eq(projectsTable.organizationId, id));
  await db.delete(organization).where(eq(organization.id, id));
  await db.delete(organization).where(eq(organization.id, otherOrganizationId));
  await db.delete(user).where(eq(user.id, id));
});

it("reads the canonical Participant Journey on the Calculator Project without losing participants without journeys", async () => {
  const participants = await client.projects.getParticipants({ projectId: id });
  expect(participants).toEqual([
    expect.objectContaining({
      id,
      journey: expect.objectContaining({
        id,
        projectParticipantId: id,
        origin: "Paris",
        destination: "Berlin",
        tripType: "round-trip",
        erasmusDistanceKm: "878.00",
      }),
    }),
  ]);
  expect(
    await client.projects.getParticipants({ projectId: otherProjectId }),
  ).toEqual([expect.objectContaining({ id: withoutJourneyId, journey: null })]);
});

it("returns Participation-owned display fields and the Journey when no User is linked", async () => {
  expect(
    await client.projects.getParticipants({ projectId: unlinkedProjectId }),
  ).toEqual([
    expect.objectContaining({
      id: unlinkedParticipationId,
      displayName: "Participation without a login",
      email: "unlinked-participant@example.com",
      userId: null,
      user: null,
      journey: expect.objectContaining({
        id: unlinkedParticipationId,
        projectParticipantId: unlinkedParticipationId,
        origin: "Prague",
        destination: "Berlin",
      }),
    }),
  ]);
});

it("does not expose Participant Journeys from another active Organization", async () => {
  await db
    .update(session)
    .set({ activeOrganizationId: otherOrganizationId })
    .where(eq(session.id, id));
  await expect(
    client.projects.getParticipants({ projectId: id }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});
