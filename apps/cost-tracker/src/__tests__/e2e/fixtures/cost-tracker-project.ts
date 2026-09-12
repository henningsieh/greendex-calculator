import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import { organization, projectsTable, user } from "@greendex/database/schema";
import { and, eq } from "drizzle-orm";

// oxlint-disable-next-line import/no-relative-parent-imports -- Uses the canonical shared-database seed user for a self-cleaning Cost Tracker fixture.
import { SEED_USER } from "../../../../../calculator/scripts/seed";

const seedOrganizationSlug = "seed-org";

export class CostTrackerProjectFixture {
  readonly name = `Cost Tracker E2E ${randomUUID()}`;
  readonly partnerOrganizationId = randomUUID();
  readonly projectId = randomUUID();
  readonly partnerOrganizationName = `E2E Partner ${randomUUID()}`;

  async setup() {
    const [seedOrganization] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, seedOrganizationSlug))
      .limit(1);
    const [seedUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, SEED_USER.email))
      .limit(1);

    if (!seedOrganization || !seedUser) {
      throw new Error(
        "The Cost Tracker E2E suite requires the shared development seed. Run pnpm --filter @greendex/calculator db:seed first.",
      );
    }

    await db.insert(organization).values({
      id: this.partnerOrganizationId,
      name: this.partnerOrganizationName,
      slug: `cost-tracker-e2e-${randomUUID()}`,
      createdAt: new Date(),
    });
    await db.insert(projectsTable).values({
      id: this.projectId,
      name: this.name,
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      endDate: new Date("2026-09-03T00:00:00.000Z"),
      location: "Berlin",
      country: "DE",
      responsibleUserId: seedUser.id,
      organizationId: seedOrganization.id,
      costSubmissionWindowOpen: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async teardown() {
    await db
      .delete(projectsTable)
      .where(
        and(
          eq(projectsTable.id, this.projectId),
          eq(projectsTable.name, this.name),
        ),
      );
    await db
      .delete(organization)
      .where(eq(organization.id, this.partnerOrganizationId));
  }
}
