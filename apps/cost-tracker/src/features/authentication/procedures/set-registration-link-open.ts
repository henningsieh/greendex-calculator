import "server-only";
import { db } from "@greendex/database";
import {
  claimsTable,
  participantRegistrationLinksTable as links,
} from "@greendex/database/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  id,
  partnershipForIssuer,
} from "@/features/authentication/procedures/shared";
import { authorized } from "@/lib/orpc/middleware";

export function buildSetRegistrationLinkOpen() {
  return authorized
    .input(z.object({ id, open: z.boolean() }))
    .output(z.object({ open: z.boolean() }))
    .handler(async ({ input, context, errors }) => {
      const [link] = await db
        .select({ partnershipId: links.partnershipId })
        .from(links)
        .where(eq(links.id, input.id))
        .limit(1);
      if (!link) throw errors.NOT_FOUND();
      await partnershipForIssuer(
        link.partnershipId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
      );
      if (input.open) {
        const [claim] = await db
          .select({ status: claimsTable.status })
          .from(claimsTable)
          .where(eq(claimsTable.partnershipId, link.partnershipId))
          .limit(1);
        if (claim && claim.status !== "editable")
          throw errors.BAD_REQUEST({
            message: "A submitted Claim prevents reopening registration.",
          });
      }
      await db
        .update(links)
        .set({
          enabled: input.open,
          closedAt: input.open ? null : new Date(),
          closedByUserId: input.open ? null : context.user.id,
        })
        .where(eq(links.id, input.id));
      return { open: input.open };
    });
}
