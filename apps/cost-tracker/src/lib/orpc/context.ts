import { os } from "@orpc/server";

import { normalizeBetterAuthError } from "@/lib/orpc/better-auth-errors";
import { errorDefinitions } from "@/lib/orpc/error-contract";
import { createSituationErrors } from "@/lib/orpc/errors";
import { normalizeInputValidationError } from "@/lib/orpc/input-validation";

export const base = os
  .$context<{ headers: Headers; resHeaders?: Headers }>()
  .errors(errorDefinitions)
  .use(async ({ context, errors, next }) => {
    try {
      return await next();
    } catch (error) {
      const situations = createSituationErrors(errors);
      throw (
        normalizeInputValidationError(error, situations) ??
        normalizeBetterAuthError(error, situations, context.resHeaders)
      );
    }
  });
