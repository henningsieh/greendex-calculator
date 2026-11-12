import {
  IDENTIFIER_MAX_LENGTH,
  invitation,
  organization,
} from "@greendex/database/schema";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const OrganizationOptionSchema = createSelectSchema(organization).pick({
  id: true,
  name: true,
});
export type OrganizationOption = z.infer<typeof OrganizationOptionSchema>;

export const OrganizationIdSchema = createSelectSchema(organization)
  .shape.id.trim()
  .min(1)
  .max(IDENTIFIER_MAX_LENGTH);

export const OptionalEmptyInputSchema = z.object({}).optional();

export const AcceptOrganizationInvitationInputSchema = z.object({
  invitationId: createSelectSchema(invitation)
    .shape.id.min(1)
    .max(IDENTIFIER_MAX_LENGTH),
});
