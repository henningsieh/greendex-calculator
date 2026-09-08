import {
  inferAdditionalFields,
  lastLoginMethodClient,
  magicLinkClient,
  organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { env } from "@/env";
import { ac, admin, member, owner } from "@/features/projects/permissions";
import type { auth } from "@/lib/better-auth";

const clientBaseURL = env.NEXT_PUBLIC_BASE_URL;

export const authClient = createAuthClient({
  /** The base URL of the server (optional if you're using the same domain) */
  baseURL: clientBaseURL,
  plugins: [
    organizationClient({
      ac,
      roles: {
        owner,
        admin,
        member,
      },
    }),
    magicLinkClient(),
    lastLoginMethodClient(),
    inferAdditionalFields<typeof auth>(),
  ],
});
