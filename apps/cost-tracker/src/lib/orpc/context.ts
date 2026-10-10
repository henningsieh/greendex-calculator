import { os } from "@orpc/server";

import { normalizeBetterAuthError } from "@/lib/orpc/better-auth-errors";
import { errorDefinitions } from "@/lib/orpc/error-contract";
import { createSituationErrors } from "@/lib/orpc/errors";

export const base = os
  .$context<{ headers: Headers; resHeaders?: Headers }>()
  .errors(errorDefinitions)
  .use(async ({ context, errors, next }) => {
    try {
      return await next();
    } catch (error) {
      throw normalizeBetterAuthError(
        error,
        createSituationErrors(errors),
        context.resHeaders,
      );
    }
  });
