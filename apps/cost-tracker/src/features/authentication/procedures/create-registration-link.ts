import "server-only";
import { randomBytes } from "node:crypto";

import { db } from "@greendex/database";
import { participantRegistrationLinksTable as links } from "@greendex/database/schema";
import { z } from "zod";

import {
  id,
  partnershipForIssuer,
  secretHash,
} from "@/features/authentication/procedures/shared";
import { authorized } from "@/lib/orpc/middleware";

export function buildCreateRegistrationLink() {
  return authorized
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
}
