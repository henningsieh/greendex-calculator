// @vitest-environment node
/* eslint-disable import/no-relative-parent-imports -- App-local live-check scripts sit outside the src alias. */
import { describe, expect, it } from "vitest";

import {
  deletionEnabled,
  validateMailboxEnvironment,
  selectDeliveredLink,
} from "../../scripts/email-run-safety";

const mailbox = "greendex-testing@apps.sieh.org";
const environment = {
  SMTP_HOST: "mail.sieh.org",
  SMTP_PORT: "465",
  SMTP_SECURE: "true",
  SMTP_USERNAME: mailbox,
  SMTP_SENDER: mailbox,
  SMTP_PASSWORD: "runtime-owner-secret",
  IMAP_HOST: "mail.sieh.org",
  IMAP_PORT: "993",
  IMAP_SECURE: "true",
  IMAP_USERNAME: mailbox,
  IMAP_PASSWORD: "runtime-owner-secret",
  EMAIL_TEST_SENDER: mailbox,
  EMAIL_TEST_RECIPIENT: mailbox,
};

describe("email-run-safety", () => {
  it("retains by default and rejects invalid deletion flags", () => {
    expect(deletionEnabled(undefined)).toBe(false);
    expect(deletionEnabled("false")).toBe(false);
    expect(deletionEnabled("true")).toBe(true);
    for (const invalid of ["", "1", "TRUE", "yes"])
      expect(() => deletionEnabled(invalid)).toThrow();
  });
  it("fails closed on placeholders and unverified routing without exposing values", () => {
    expect(() => validateMailboxEnvironment(environment)).not.toThrow();
    expect(() =>
      validateMailboxEnvironment({
        ...environment,
        SMTP_PASSWORD: "YOUR_PASSWORD",
      }),
    ).toThrow("SMTP_PASSWORD");
    expect(() =>
      validateMailboxEnvironment({
        ...environment,
        EMAIL_TEST_RECIPIENT: "unverified+alias@example.org",
      }),
    ).toThrow("EMAIL_TEST_RECIPIENT");
  });
  it("extracts only the expected delivered application link", () => {
    const base = "http://127.0.0.1:1234";
    expect(
      selectDeliveredLink(
        `<a href="${base}/api/auth/verify-email?token=private&amp;callbackURL=%2F">Verify</a>`,
        base,
        "/api/auth/verify-email",
      ),
    ).toBe(`${base}/api/auth/verify-email?token=private&callbackURL=%2F`);
    expect(() =>
      selectDeliveredLink(
        '<a href="https://unrelated.test/api/auth/verify-email">Verify</a>',
        base,
        "/api/auth/verify-email",
      ),
    ).toThrow();
    expect(() =>
      selectDeliveredLink(
        `<a href="${base}/api/auth/verify-email?token=one">One</a><a href="${base}/api/auth/verify-email?token=two">Two</a>`,
        base,
        "/api/auth/verify-email",
      ),
    ).toThrow();
  });
});
