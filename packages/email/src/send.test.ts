import type { Transporter } from "nodemailer";
import { afterEach, describe, expect, it, vi } from "vitest";

import { sendEmail } from "./send";

const options = {
  to: "recipient@private.example",
  subject: "Reset link https://private.example/reset?token=secret-token",
  html: "<p>secret-token</p>",
};
const sender = "sender@private.example";
const log = vi.spyOn(console, "log").mockImplementation(() => {});
const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

afterEach(() => {
  vi.clearAllMocks();
});

describe("sendEmail", () => {
  it("logs only an allowlisted error class and code, while rethrowing the transport error", async () => {
    const failure = Object.assign(
      new Error(
        "SMTP failure for recipient@private.example on smtp.private.example: secret-token",
      ),
      {
        name: "recipient@private.example",
        code: "EAUTH",
        response: "535 secret-token",
        command: "AUTH secret-token",
      },
    );
    const sendMail = vi.fn().mockRejectedValue(failure);

    await expect(
      sendEmail(options, { sendMail } as unknown as Transporter, sender),
    ).rejects.toBe(failure);

    expect(sendMail).toHaveBeenCalledWith({
      ...options,
      from: sender,
      text: undefined,
    });
    expect(errorLog).toHaveBeenCalledWith("❌ Email sending failed:", {
      errorClass: "Error",
      code: "EAUTH",
    });
    expect(
      JSON.stringify([...log.mock.calls, ...errorLog.mock.calls]),
    ).not.toMatch(/recipient@|sender@|private\.example|secret-token|535/);
  });

  it("does not log arbitrary codes, class names, or non-Error failure contents", async () => {
    const failure = {
      code: "recipient@private.example secret-token",
      message: "smtp.private.example",
      name: "SecretError",
    };

    await expect(
      sendEmail(
        options,
        {
          sendMail: vi.fn().mockRejectedValue(failure),
        } as unknown as Transporter,
        sender,
      ),
    ).rejects.toBe(failure);

    expect(errorLog).toHaveBeenCalledWith("❌ Email sending failed:", {
      errorClass: "Unknown",
      code: "UNKNOWN",
    });
    expect(
      JSON.stringify([...log.mock.calls, ...errorLog.mock.calls]),
    ).not.toMatch(/recipient@|sender@|private\.example|secret-token/);
  });

  it("rethrows the original failure when reading its code throws", async () => {
    const failure = {
      message: "recipient@private.example secret-token",
      get code() {
        throw new Error("smtp.private.example secret-token");
      },
    };

    await expect(
      sendEmail(
        options,
        {
          sendMail: vi.fn().mockRejectedValue(failure),
        } as unknown as Transporter,
        sender,
      ),
    ).rejects.toBe(failure);

    expect(errorLog).toHaveBeenCalledWith("❌ Email sending failed:", {
      errorClass: "Unknown",
      code: "UNKNOWN",
    });
    expect(
      JSON.stringify([...log.mock.calls, ...errorLog.mock.calls]),
    ).not.toMatch(/recipient@|sender@|private\.example|secret-token/);
  });

  it("does not log message identifiers or message contents on success", async () => {
    const sendMail = vi.fn().mockResolvedValue({
      messageId: "recipient@private.example",
    });

    await sendEmail(options, { sendMail } as unknown as Transporter, sender);

    expect(errorLog).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(log.mock.calls)).not.toMatch(
      /recipient@|sender@|private\.example|secret-token/,
    );
  });
});
