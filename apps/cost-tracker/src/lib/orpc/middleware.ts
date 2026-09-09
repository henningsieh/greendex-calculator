import type {
  ProjectPartnershipPermission,
  ProjectPermission,
} from "@greendex/auth";

import { auth } from "@/lib/auth";
import { base } from "@/lib/orpc/context";

const authMiddleware = base.middleware(async ({ context, errors, next }) => {
  const sessionData = await auth.api.getSession({ headers: context.headers });

  if (!(sessionData?.session && sessionData.user)) {
    throw errors.UNAUTHORIZED();
  }

  return next({
    context: {
      session: sessionData.session,
      user: sessionData.user,
    },
  });
});

export const authorized = base.use(authMiddleware);

type CostTrackerPermissions = {
  project?: ProjectPermission[];
  projectPartnership?: ProjectPartnershipPermission[];
};

export async function hasCostTrackerPermissions(
  headers: Headers,
  permissions: CostTrackerPermissions,
) {
  const result = await auth.api.hasPermission({
    headers,
    body: { permissions },
  });

  return result.success;
}

export const requireCostTrackerPermissions =
  (permissions: CostTrackerPermissions) =>
  async ({
    context,
    errors,
    next,
  }: Parameters<Parameters<typeof authorized.use>[0]>[0]) => {
    if (!context.session.activeOrganizationId) {
      throw errors.FORBIDDEN({
        message:
          "Select an active Organization before accessing Cost Tracker data.",
      });
    }

    if (!(await hasCostTrackerPermissions(context.headers, permissions))) {
      throw errors.FORBIDDEN({
        message:
          "The active Organization role cannot access this Cost Tracker resource.",
      });
    }

    return next();
  };
