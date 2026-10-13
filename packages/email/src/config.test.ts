import { beforeEach, describe, expect, it, vi } from "vitest";

const createTransport = vi.hoisted(() => vi.fn(() => ({})));
vi.mock("nodemailer", () => ({ default: { createTransport } }));
import { createTransporter } from "./config";

const smtp = {
  host: "smtp.example.test",
  port: 465,
  secure: true,
  auth: { user: "test", pass: "synthetic-test-password" },
};
beforeEach(() => createTransport.mockClear());
describe("createTransporter", () => {
  it("preserves default transport behavior when no timeouts are supplied", () => {
    createTransporter(smtp);
    expect(createTransport).toHaveBeenCalledExactlyOnceWith(smtp);
  });
  it("forwards explicit bounded connection, greeting, and socket timeouts", () => {
    const options = {
      ...smtp,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    };
    createTransporter(options);
    expect(createTransport).toHaveBeenCalledExactlyOnceWith(options);
  });
});
