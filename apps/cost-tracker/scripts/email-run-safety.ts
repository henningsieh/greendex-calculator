const MAILBOX = "greendex-testing@apps.sieh.org";

export function deletionEnabled(value: string | undefined): boolean {
  if (value === undefined) return false;
  if (value !== "true" && value !== "false")
    throw new Error("DELETE_TESTMAILS_DURING_TESTRUN must be true or false.");
  return value === "true";
}

export function validateMailboxEnvironment(
  env: Record<string, string | undefined>,
): void {
  const expected = {
    SMTP_HOST: "mail.sieh.org",
    SMTP_PORT: "465",
    SMTP_SECURE: "true",
    SMTP_SENDER: MAILBOX,
    SMTP_USERNAME: MAILBOX,
    IMAP_HOST: "mail.sieh.org",
    IMAP_PORT: "993",
    IMAP_SECURE: "true",
    IMAP_USERNAME: MAILBOX,
    EMAIL_TEST_SENDER: MAILBOX,
    EMAIL_TEST_RECIPIENT: MAILBOX,
  };
  for (const [key, value] of Object.entries(expected))
    if (env[key] !== value)
      throw new Error(
        `BLOCKED: ${key} does not match approved mailbox configuration.`,
      );
  for (const key of ["SMTP_PASSWORD", "IMAP_PASSWORD"]) {
    if (
      !env[key]?.trim() ||
      /placeholder|change.?me|your.?password|replace.?me/i.test(env[key]!)
    )
      throw new Error(`BLOCKED: ${key} missing or placeholder.`);
  }
  deletionEnabled(env.DELETE_TESTMAILS_DURING_TESTRUN);
}

/** Inspect parsed MIME HTML, never raw source: quoted-printable can fold a link. */
export function selectDeliveredLink(
  html: string,
  base: string,
  path: string,
): string {
  const links = new Set<string>();
  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    try {
      const url = new URL(match[1].replaceAll("&amp;", "&"));
      if (url.origin === new URL(base).origin && url.pathname.startsWith(path))
        links.add(url.toString());
    } catch {
      /* Ignore non-HTTP template links. */
    }
  }
  if (links.size !== 1)
    throw new Error(
      "Delivered email does not contain exactly one expected application link.",
    );
  return [...links][0];
}
