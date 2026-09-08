import { os } from "@orpc/server";

export const base = os.$context<{ headers: Headers }>().errors({
  BAD_REQUEST: { message: "Bad request" },
  NOT_FOUND: { message: "Resource not found" },
  FORBIDDEN: { message: "Access forbidden" },
  UNAUTHORIZED: { message: "Unauthorized" },
  INTERNAL_SERVER_ERROR: { message: "Internal server error" },
});
