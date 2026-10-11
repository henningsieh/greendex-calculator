import {
  accessControl as ac,
  calculatorOrganizationRoles,
} from "@greendex/auth/permissions";
import { organizationCountryFields } from "@greendex/config/organization-country";
import {
  inferAdditionalFields,
  lastLoginMethodClient,
  magicLinkClient,
  organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { env } from "@/env";
import type { auth } from "@/lib/better-auth";

const clientBaseURL = env.NEXT_PUBLIC_BASE_URL;

export const authClient = createAuthClient({
  /** The base URL of the server (optional if you're using the same domain) */
  baseURL: clientBaseURL,
  plugins: [
    organizationClient({
      ac,
      roles: calculatorOrganizationRoles,
      schema: {
        organization: { additionalFields: organizationCountryFields },
      },
    }),
    magicLinkClient(),
    lastLoginMethodClient(),
    inferAdditionalFields<typeof auth>(),
  ],
});
