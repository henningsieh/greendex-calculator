/**
 * Cursor protocol version. The server codec writes it, and the list pre-flight
 * reads it so a cursor from another format never reaches the procedure.
 */
export const PROJECT_CURSOR_VERSION = 5 as const;

function decodeBase64Url(value: string): string | null {
  try {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
    const padding = (4 - (base64.length % 4)) % 4;
    return atob(base64.padEnd(base64.length + padding, "="));
  } catch {
    return null;
  }
}

/**
 * Reads the protocol version out of a cursor without verifying its signature.
 * Returns `null` for anything that is not a decodable cursor payload.
 *
 * This is a pre-flight check, not validation: the procedure still rejects an
 * unreadable or mismatched cursor with `BAD_REQUEST`.
 */
export function readProjectCursorVersion(value: string): number | null {
  const decoded = decodeBase64Url(value);
  if (decoded === null) return null;

  try {
    const payload: unknown = JSON.parse(decoded);
    if (typeof payload !== "object" || payload === null) return null;
    const { version } = payload as { version?: unknown };
    return typeof version === "number" && Number.isInteger(version)
      ? version
      : null;
  } catch {
    return null;
  }
}

/**
 * True when a cursor carries a readable version that predates the current
 * format. Unreadable values are not obsolete: the client never interprets a
 * cursor it cannot parse, so the procedure stays the authority for those.
 */
export function isObsoleteProjectCursor(value: string): boolean {
  const version = readProjectCursorVersion(value);
  return version !== null && version !== PROJECT_CURSOR_VERSION;
}
