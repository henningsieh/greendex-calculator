import type { Transporter } from "nodemailer";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

// Only known transport codes may reach logs; arbitrary error fields can contain
// SMTP responses, hostnames, credentials, or recipient addresses.
const safeTransportCodes = new Set([
  "EAUTH",
  "ECONNECTION",
  "EDNS",
  "EENVELOPE",
  "EMESSAGE",
  "ESOCKET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "ECONNREFUSED",
  "ECONNRESET",
  "EPIPE",
]);

function deliveryFailureDetails(error: unknown): {
  errorClass: string;
  code: string;
} {
  const errorClass =
    error instanceof TypeError
      ? "TypeError"
      : error instanceof RangeError
        ? "RangeError"
        : error instanceof Error
          ? "Error"
          : "Unknown";
  const code =
    error !== null && typeof error === "object" && "code" in error
      ? error.code
      : undefined;

  return {
    errorClass,
    code:
      typeof code === "string" && safeTransportCodes.has(code) ? code : "UNKNOWN",
  };
}

/**
 * Send an email via the configured SMTP transporter. Logs only fixed status
 * text and allowlisted failure details, never message or transport contents.
 * Propagates the original transport error to the caller.
 */
export async function sendEmail(
  options: SendEmailOptions,
  transporter: Transporter,
  sender: string,
): Promise<void> {
  try {
    console.log("📮 Attempting to send email");

    await transporter.sendMail({
      from: sender,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    console.log("✉️ Email sent successfully");
  } catch (error) {
    console.error("❌ Email sending failed:", deliveryFailureDetails(error));
    throw error;
  }
}
