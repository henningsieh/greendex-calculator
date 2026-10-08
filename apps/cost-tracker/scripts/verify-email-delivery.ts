import { randomUUID } from "node:crypto";

import { createEmailSender, createTransporter } from "@greendex/email";
import { ImapFlow } from "imapflow";

const POLL_INTERVAL_MS = 2_000;
const DELIVERY_TIMEOUT_MS = 60_000;

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set for the Cost Tracker email check.`);
  }

  return value;
}

function portEnvironmentVariable(name: string): number {
  const value = Number.parseInt(requiredEnvironmentVariable(name), 10);
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error(`${name} must be a valid port number.`);
  }

  return value;
}

function booleanEnvironmentVariable(name: string): boolean {
  const value = requiredEnvironmentVariable(name);
  if (value !== "true" && value !== "false") {
    throw new Error(`${name} must be "true" or "false".`);
  }

  return value === "true";
}

const sender = requiredEnvironmentVariable("EMAIL_TEST_SENDER");
const recipient = requiredEnvironmentVariable("EMAIL_TEST_RECIPIENT");
const marker = `cost-tracker-email-test-${randomUUID()}`;

const emailSender = createEmailSender({
  baseUrl: requiredEnvironmentVariable("NEXT_PUBLIC_BASE_URL"),
  sender,
  transporter: createTransporter({
    host: requiredEnvironmentVariable("SMTP_HOST"),
    port: portEnvironmentVariable("SMTP_PORT"),
    secure: booleanEnvironmentVariable("SMTP_SECURE"),
    auth: {
      user: requiredEnvironmentVariable("SMTP_USERNAME"),
      pass: requiredEnvironmentVariable("SMTP_PASSWORD"),
    },
  }),
});

const imapClient = new ImapFlow({
  host: requiredEnvironmentVariable("IMAP_HOST"),
  port: portEnvironmentVariable("IMAP_PORT"),
  secure: booleanEnvironmentVariable("IMAP_SECURE"),
  auth: {
    user: requiredEnvironmentVariable("IMAP_USERNAME"),
    pass: requiredEnvironmentVariable("IMAP_PASSWORD"),
  },
  logger: false,
});

async function waitForDeliveredMessage() {
  const deadline = Date.now() + DELIVERY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const messageUids = await imapClient.search({ body: marker }, { uid: true });
    if (messageUids && messageUids.length > 0) {
      const uid = messageUids.at(-1);
      if (!uid) {
        throw new Error("IMAP returned an invalid release-gate message UID.");
      }

      const message = await imapClient.fetchOne(
        String(uid),
        { envelope: true, source: true },
        { uid: true },
      );
      if (!message) {
        throw new Error("IMAP could not fetch the release-gate message.");
      }

      const source = message.source?.toString();

      if (
        message.envelope?.subject !== "Verify Your Email Address" ||
        !source?.includes(marker)
      ) {
        throw new Error(
          "The received release-gate email did not match the sent message.",
        );
      }

      await imapClient.messageDelete(String(uid), { uid: true });
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(
    "Cost Tracker email was not delivered to the configured IMAP inbox.",
  );
}

async function verifyReleaseGateEmail() {
  await imapClient.connect();

  try {
    await imapClient.mailboxOpen("INBOX");
    await emailSender.sendEmailVerificationEmail({
      user: { email: recipient, name: "Release Gate" },
      url: `${requiredEnvironmentVariable("NEXT_PUBLIC_BASE_URL")}/verify?${marker}`,
    });
    await waitForDeliveredMessage();
    console.log(
      "Cost Tracker verification email was delivered, verified through IMAP, and deleted.",
    );
  } finally {
    await imapClient.logout();
  }
}

verifyReleaseGateEmail().catch((error: unknown) => {
  console.error("Cost Tracker email verification failed.", error);
  process.exitCode = 1;
});
