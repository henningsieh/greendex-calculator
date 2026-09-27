import "server-only";
import { db } from "@greendex/database";
import { member, organization } from "@greendex/database/schema";
import { and, asc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";

import { authorized, requireCostTrackerPermissions } from "@/lib/orpc/middleware";

const searchInput = z.object({ search: z.string().trim().min(2).max(128) });
const options = z.array(z.object({ id: z.string(), name: z.string() })).max(20);

export const searchOrganizations = authorized
  .use(requireCostTrackerPermissions({ projectPartnership: ["create"] }))
  .input(searchInput)
  .output(options)
  .handler(async ({ input }) => {
    const escaped = input.search.replace(/[\\%_]/g, "\\$&");
    const pattern = `%${escaped}%`;
    return db
      .select({ id: organization.id, name: organization.name })
      .from(organization)
      .where(
        or(
          sql`lower(${organization.name}) like lower(${pattern}) escape '\\'`,
          sql`lower(${organization.id}) like lower(${pattern}) escape '\\'`,
        ),
      )
      .orderBy(asc(organization.name), asc(organization.id))
      .limit(20);
  });

export const listMyOrganizations = authorized
  .input(searchInput)
  .output(options)
  .handler(async ({ context, input }) => {
    const escaped = input.search.replace(/[\\%_]/g, "\\$&");
    const pattern = `%${escaped}%`;
    return db
      .select({ id: organization.id, name: organization.name })
      .from(member)
      .innerJoin(organization, eq(organization.id, member.organizationId))
      .where(
        and(
          eq(member.userId, context.user.id),
          // Match the comma-split, trimmed owner token used by hasOrganizationRole.
          sql`${member.role} ~ ${"(^|,)\\s*owner\\s*(,|$)"}`,
          or(
            sql`lower(${organization.name}) like lower(${pattern}) escape '\\'`,
            sql`lower(${organization.id}) like lower(${pattern}) escape '\\'`,
          ),
        ),
      )
      .orderBy(asc(organization.name), asc(organization.id))
      .limit(20);
  });
