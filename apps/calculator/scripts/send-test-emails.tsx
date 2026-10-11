import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";

import { createEmailSender, createTransporter } from "@greendex/email";

const envPath = resolve(import.meta.dirname, "../.env");
if (existsSync(envPath)) loadEnvFile(envPath);

const getRequiredEnvironmentVariable = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set to send test emails.`);
  }
  return value;
};

const MIN_SMTP_PORT = 1;
const MAX_SMTP_PORT = 65_535;
const smtpPortString = getRequiredEnvironmentVariable("SMTP_PORT");
const smtpPort = Number.parseInt(smtpPortString, 10);

if (
  Number.isNaN(smtpPort) ||
  smtpPortString !== String(smtpPort) ||
  smtpPort < MIN_SMTP_PORT ||
  smtpPort > MAX_SMTP_PORT
) {
  throw new Error("SMTP_PORT must be a number.");
}

const baseUrl = getRequiredEnvironmentVariable("NEXT_PUBLIC_BASE_URL");

const emailSender = createEmailSender({
  baseUrl,
  transporter: createTransporter({
    host: getRequiredEnvironmentVariable("SMTP_HOST"),
    port: smtpPort,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: getRequiredEnvironmentVariable("SMTP_USERNAME"),
      pass: getRequiredEnvironmentVariable("SMTP_PASSWORD"),
    },
  }),
  sender: getRequiredEnvironmentVariable("SMTP_SENDER"),
});

async function sendTestEmails() {
  const testRecipient =
    process.env.TEST_EMAIL_RECIPIENT ??
    getRequiredEnvironmentVariable("SMTP_SENDER");

  console.log("Sending email verification test...");
  await emailSender.sendEmailVerificationEmail({
    user: { email: testRecipient, name: "Henning Sieh" },
    url: new URL("/verify?token=test123", baseUrl).toString(),
  });

  console.log("Sending password reset test...");
  await emailSender.sendPasswordResetEmail({
    user: { email: testRecipient, name: "Henning Sieh" },
    url: new URL("/reset-password?token=test456", baseUrl).toString(),
  });

  console.log("Sending organization invitation test...");
  await emailSender.sendOrganizationInvitation({
    email: testRecipient,
    inviteLink: new URL("/invite/accept?token=test789", baseUrl).toString(),
    inviterName: "Anna Schmidt",
    organizationName: "GreenTech Solutions",
  });

  console.log(`All test emails sent successfully to ${testRecipient}.`);
}

sendTestEmails().catch((error: unknown) => {
  console.error("Error sending test emails:", error);
  process.exitCode = 1;
});
