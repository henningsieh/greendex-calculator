import "server-only";
import { db } from "@greendex/database";
import { member, organization } from "@greendex/database/schema";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { authorized } from "@/lib/orpc/middleware";

/**
 * The caller's own Organization Memberships with roles. This bootstraps the
 * staff shell context (switcher list, active-Membership gate), so it must
 * not require the active Organization it establishes: `authorized` only,
 * never scoped by `activeOrganizationId`. Procedures keep enforcing
 * staff authority authoritatively per request (ADR-0014/0015).
 */
export const listMemberships = authorized
  .output(
    z.array(z.object({ id: z.string(), name: z.string(), role: z.string() })),
  )
  .handler(async ({ context }) => {
    return db
      .select({
        id: organization.id,
        name: organization.name,
        role: member.role,
      })
      .from(member)
      .innerJoin(organization, eq(organization.id, member.organizationId))
      .where(eq(member.userId, context.user.id))
      .orderBy(asc(organization.name), asc(organization.id));
  });
