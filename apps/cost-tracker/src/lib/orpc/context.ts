import { os } from "@orpc/server";

export const base = os
  .$context<{ headers: Headers; resHeaders?: Headers }>()
  .errors({
    BAD_REQUEST: { message: "Bad request" },
    NOT_FOUND: { message: "Resource not found" },
    FORBIDDEN: { message: "Access forbidden" },
    UNAUTHORIZED: { message: "Unauthorized" },
    TOO_MANY_REQUESTS: { message: "Too many requests" },
    INTERNAL_SERVER_ERROR: { message: "Internal server error" },
  });
