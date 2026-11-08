import type {
  ProjectParticipationPermission,
  ProjectPartnershipPermission,
  ProjectPermission,
} from "@greendex/auth";
import { io } from "next/cache";

import { auth } from "@/lib/auth";
import { normalizeBetterAuthError } from "@/lib/orpc/better-auth-errors";
import { base } from "@/lib/orpc/context";
import { createSituationErrors } from "@/lib/orpc/errors";

export const authorized = base.use(async ({ context, errors, next }) => {
  // Authorization is request-time work: Better Auth reads the current time
  // while validating session expiry, so this read must never run inside a
  // prerender. `io()` suspends the render here instead of baking the read into
  // the static shell (see `lib/session.ts` and #366).
  await io();
  const sessionData = await auth.api.getSession({ headers: context.headers });

  if (!(sessionData?.session && sessionData.user)) {
    throw createSituationErrors(errors).unauthenticated();
  }

  return next({
    context: {
      session: sessionData.session,
      user: sessionData.user,
    },
  });
});

type CostTrackerPermissions = {
  project?: ProjectPermission[];
  projectPartnership?: ProjectPartnershipPermission[];
  projectParticipation?: ProjectParticipationPermission[];
};

export async function hasCostTrackerPermissions(
  headers: Headers,
  permissions: CostTrackerPermissions,
) {
  // Same request-time constraint as `authorized`: `hasPermission` validates the
  // session (and the clock) before answering, and callers include
  // presentation gates that render inside the protected App Shell.
  await io();
  try {
    const result = await auth.api.hasPermission({
      headers,
      body: { permissions },
    });

    return result.success;
  } catch (error) {
    throw normalizeBetterAuthError(error, createSituationErrors());
  }
}

export const requireCostTrackerPermissions =
  (permissions: CostTrackerPermissions) =>
  async ({
    context,
    errors,
    next,
  }: Parameters<Parameters<typeof authorized.use>[0]>[0]) => {
    if (!context.session.activeOrganizationId) {
      throw createSituationErrors(errors).selectOrganization();
    }

    if (!(await hasCostTrackerPermissions(context.headers, permissions))) {
      throw createSituationErrors(errors).accessDenied();
    }

    return next();
  };
