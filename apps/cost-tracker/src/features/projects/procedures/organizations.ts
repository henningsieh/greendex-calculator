import "server-only";
import { hasOrganizationRole } from "@greendex/auth";
import { db } from "@greendex/database";
import { member, organization } from "@greendex/database/schema";
import { and, asc, eq, gt, or, sql } from "drizzle-orm";
import { z } from "zod";

import { authorized, requireCostTrackerPermissions } from "@/lib/orpc/middleware";

const searchInput = z.object({ search: z.string().trim().min(2).max(128) });
const options = z.array(z.object({ id: z.string(), name: z.string() })).max(20);
const OWNED_SEARCH_PAGE_SIZE = 100;

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
    const matches: { id: string; name: string }[] = [];
    let cursor: { id: string; name: string } | undefined;
    while (matches.length < 20) {
      const memberships = await db
        .select({
          id: organization.id,
          name: organization.name,
          role: member.role,
        })
        .from(member)
        .innerJoin(organization, eq(organization.id, member.organizationId))
        .where(
          and(
            eq(member.userId, context.user.id),
            or(
              sql`lower(${organization.name}) like lower(${pattern}) escape '\\'`,
              sql`lower(${organization.id}) like lower(${pattern}) escape '\\'`,
            ),
            cursor
              ? or(
                  gt(organization.name, cursor.name),
                  and(
                    eq(organization.name, cursor.name),
                    gt(organization.id, cursor.id),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(asc(organization.name), asc(organization.id))
        .limit(OWNED_SEARCH_PAGE_SIZE);
      for (const { id, name, role } of memberships) {
        if (hasOrganizationRole(role, "owner")) matches.push({ id, name });
        if (matches.length === 20) return matches;
      }
      if (memberships.length < OWNED_SEARCH_PAGE_SIZE) break;
      const last = memberships[memberships.length - 1]!;
      cursor = { id: last.id, name: last.name };
    }
    return matches;
  });
