import type {
  ProjectParticipationPermission,
  ProjectPartnershipPermission,
  ProjectPermission,
} from "@greendex/auth";

import { auth } from "@/lib/auth";
import { normalizeBetterAuthError } from "@/lib/orpc/better-auth-errors";
import { base } from "@/lib/orpc/context";
import { createSituationErrors } from "@/lib/orpc/errors";

export const authorized = base.use(async ({ context, errors, next }) => {
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
