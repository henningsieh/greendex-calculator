import "server-only";
import { randomBytes } from "node:crypto";

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
  secretHash,
} from "@/features/authentication/procedures/shared";
import { authorized } from "@/lib/orpc/middleware";

export function buildRegistrationLinks() {
  const createRegistrationLink = authorized
    .input(z.object({ partnershipId: id }))
    .output(z.object({ id: z.string(), secret: z.string() }))
    .handler(async ({ input, context, errors }) => {
      await partnershipForIssuer(
        input.partnershipId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
      );
      const secret = randomBytes(32).toString("base64url");
      const [link] = await db
        .insert(links)
        .values({
          partnershipId: input.partnershipId,
          secretHash: secretHash(secret),
          createdByUserId: context.user.id,
        })
        .returning({ id: links.id });
      return { id: link!.id, secret };
    });

  const setRegistrationLinkOpen = authorized
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
  return { createRegistrationLink, setRegistrationLinkOpen };
}
