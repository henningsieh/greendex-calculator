"use client";

import {
  accessControl,
  costTrackerOrganizationRoles,
} from "@greendex/auth/permissions";
import { organizationCountryFields } from "@greendex/config/organization-country";
import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Browser Better Auth client for Cost Tracker. The organization plugin carries
 * the same access control and role definitions the server uses, so
 * `authClient.organization.checkRolePermission` resolves the identical
 * permissions without a second declaration (ADR-0014).
 */
export const authClient = createAuthClient({
  plugins: [
    organizationClient({
      ac: accessControl,
      roles: costTrackerOrganizationRoles,
      schema: { organization: { additionalFields: organizationCountryFields } },
    }),
  ],
});
