import "server-only";
import { z } from "zod";

import { issueEntryToken } from "@/features/participant-onboarding/procedures/entry-tokens";
import { requirePartnerScopeAuthority } from "@/features/participant-onboarding/procedures/participant-entry";
import { id } from "@/features/participant-onboarding/procedures/shared";
import { authorized } from "@/lib/orpc/middleware";

export function buildCreateRegistrationLink() {
  return authorized
    .input(z.object({ partnershipId: id }))
    .output(z.object({ id: z.string(), secret: z.string() }))
    .handler(async ({ input, context, errors }) => {
      const partnership = await requirePartnerScopeAuthority(
        context.headers,
        input.partnershipId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
      );
      // The shareable flavour binds no email and never expires: anyone holding
      // the secret may redeem it with their own account, repeatedly.
      const issued = await issueEntryToken(errors, {
        partnershipId: partnership.id,
        projectId: partnership.projectId,
        email: null,
        expiresAt: null,
        issuedByUserId: context.user.id,
      });
      return { id: issued.id, secret: issued.secret };
    });
}
