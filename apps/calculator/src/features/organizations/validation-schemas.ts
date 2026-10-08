import { EU_COUNTRY_CODES } from "@greendex/config/eu-countries";
import {
  invitation,
  member as memberTable,
  organization,
  user as userTable,
} from "@greendex/database/schema";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { MEMBER_ROLES } from "@/features/organizations/types";

// ============================================================================
// ORGANIZATION - Schemas
// ============================================================================

/**
 * Schema for member role values
 */
export const MemberRoleSchema = z.enum(Object.values(MEMBER_ROLES));

/**
 * Extended member insert schema with associated user data
 * Omits sensitive and unnecessary fields from user object
 */
export const MemberWithUserSchema = createSelectSchema(memberTable).extend({
  user: createSelectSchema(userTable)
    .omit({
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
    })
    .extend({
      image: z.string().nullable().optional(), // Allow null and undefined values
    })
    .loose(), // Allow additional fields from Better Auth
});

export const OrganizationFormSchema = createInsertSchema(organization, {
  name: (schema) => schema.min(1, { error: "Organization name is required" }),
  country: z.enum(EU_COUNTRY_CODES),
}).omit({
  id: true,
  slug: true,
  logo: true,
  metadata: true,
  createdAt: true,
});

export const InviteFormSchema = createInsertSchema(invitation)
  .omit({
    id: true,
    organizationId: true, // passed from component props; not user-provided
    inviterId: true, // set by server
    createdAt: true,
    expiresAt: true, // set by server or adapter
    status: true, // set by server
  })
  .extend({
    name: z.string().optional(),
    // Refine role to only allow valid member roles
    role: z.enum(Object.values(MEMBER_ROLES)),
  });

// The edit form requires country; Better Auth partial updates may omit it and retain
// the existing required country, while still rejecting invalid supplied values.
export const EditOrganizationFormSchema = OrganizationFormSchema;
