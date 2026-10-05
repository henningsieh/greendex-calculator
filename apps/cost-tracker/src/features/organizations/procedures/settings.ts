import { EU_COUNTRY_CODES } from "@greendex/config/eu-countries";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { normalizeBetterAuthError } from "@/lib/orpc/better-auth-errors";
import { createSituationErrors } from "@/lib/orpc/errors";
import { authorized } from "@/lib/orpc/middleware";

const OrganizationSettingsSchema = z.object({
  id: z.string(),
  name: z.string(),
  country: z.enum(EU_COUNTRY_CODES),
});

export const getSettings = authorized
  .output(OrganizationSettingsSchema)
  .handler(async ({ context, errors }) => {
    if (!context.session.activeOrganizationId)
      throw createSituationErrors(errors).selectOrganization();
    try {
      const organization = await auth.api.getFullOrganization({
        headers: context.headers,
        query: { organizationId: context.session.activeOrganizationId },
      });
      return OrganizationSettingsSchema.parse(organization);
    } catch (error) {
      throw normalizeBetterAuthError(error, createSituationErrors(errors));
    }
  });

export const updateCountry = authorized
  .input(OrganizationSettingsSchema.pick({ country: true }))
  .output(z.object({ success: z.literal(true) }))
  .handler(async ({ context, input, errors }) => {
    if (!context.session.activeOrganizationId)
      throw createSituationErrors(errors).selectOrganization();
    try {
      // Better Auth enforces organization:update against this active Membership.
      await auth.api.updateOrganization({
        headers: context.headers,
        body: {
          organizationId: context.session.activeOrganizationId,
          data: input,
        },
      });
      return { success: true };
    } catch (error) {
      throw normalizeBetterAuthError(error, createSituationErrors(errors));
    }
  });
