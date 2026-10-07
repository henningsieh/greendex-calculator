/**
 * Fail-fast guard: never run automated tests against a non-local base URL.
 *
 * The Coolify environment carries the production URL in NEXT_PUBLIC_BASE_URL
 * (and NEXT_PUBLIC_SOCKET_URL). If those values leak into a local `.env`,
 * the test suites would silently exercise production — including a real
 * seed-user login in the Playwright global setup. This module aborts before
 * any test or browser starts.
 *
 * Escape hatch for the rare case someone really means it:
 * `ALLOW_NON_LOCAL_TEST_URL=1`.
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function checkUrl(varName: string, raw: string | undefined): void {
  const value = (raw ?? "").trim();
  if (!value) {
    throw new Error(
      `${varName} is not set. Tests must run against a local server ` +
        `(e.g. http://localhost:3000).`,
    );
  }
  let hostname: string;
  try {
    hostname = new URL(value).hostname.toLowerCase();
  } catch {
    throw new Error(
      `${varName} is not a valid URL: "${value}". ` +
        `Tests must run against a local server.`,
    );
  }
  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(
      `Refusing to run tests against non-local ${varName}="${value}". ` +
        `This guard exists so tests can never hit production. ` +
        `Point it at localhost (e.g. http://localhost:3000) or set ` +
        `ALLOW_NON_LOCAL_TEST_URL=1 to override deliberately.`,
    );
  }
}

export function assertLocalTestUrls(): void {
  if (process.env.ALLOW_NON_LOCAL_TEST_URL === "1") {
    return;
  }
  checkUrl("NEXT_PUBLIC_BASE_URL", process.env.NEXT_PUBLIC_BASE_URL);
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (socketUrl !== undefined && socketUrl.trim() !== "") {
    checkUrl("NEXT_PUBLIC_SOCKET_URL", socketUrl);
  }
}
