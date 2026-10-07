import { COMMON_ERROR_STATUS_MAP } from "@orpc/server";

// Custom error codes belong here, never in individual error definitions.
export const ERROR_STATUS_MAP = { ...COMMON_ERROR_STATUS_MAP };

export function getErrorStatus(code: string): number {
  return ERROR_STATUS_MAP[code as keyof typeof ERROR_STATUS_MAP] ?? 500;
}
