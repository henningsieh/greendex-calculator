import "server-only";
import { db } from "@greendex/database";
import { participantAgreementAcceptancesTable as acceptances } from "@greendex/database/schema";
import { z } from "zod";

import {
  agreementInput,
  type RequirePublishedAgreement,
} from "@/features/authentication/procedures/shared";
import { authorized } from "@/lib/orpc/middleware";

export function buildAcceptAgreement(
  requirePublishedAgreement: RequirePublishedAgreement,
) {
  const acceptAgreement = authorized
    .input(agreementInput)
    .output(z.object({ version: z.string() }))
    .handler(async ({ context, errors }) => {
      const version = requirePublishedAgreement(errors);
      await db
        .insert(acceptances)
        .values({
          userId: context.user.id,
          version: version.id,
          contentHash: version.contentHash,
          answers: JSON.stringify({ accepted: true }),
        })
        .onConflictDoNothing();
      return { version: version.id };
    });
  return acceptAgreement;
}
