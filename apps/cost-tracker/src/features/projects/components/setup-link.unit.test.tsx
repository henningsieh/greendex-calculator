import { readFileSync } from "node:fs";

import { ORPCError } from "@orpc/client";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  consume: vi.fn(),
  writeText: vi.fn(),
}));
vi.mock("@/lib/orpc/orpc", () => ({
  orpc: {
    projectPartnerships: {
      createSetupLink: mocks.create,
      consumeSetupLink: mocks.consume,
    },
  },
}));

import {
  SetupLinkCreator,
  SetupLinkRecipient,
} from "@/features/projects/components/setup-link";

const source = readFileSync(
  "src/features/projects/procedures/setup-links.ts",
  "utf8",
);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("navigator", { clipboard: { writeText: mocks.writeText } });
  mocks.writeText.mockResolvedValue(undefined);
  mocks.create.mockResolvedValue({
    id: "link-1",
    secret: "private-secret",
    expiresAt: new Date("2026-12-01"),
  });
  mocks.consume.mockResolvedValue({
    partnershipId: "partnership-1",
    organizationId: "partner-1",
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function recipient(secret = "private-secret") {
  return render(<SetupLinkRecipient id="link-1" secret={secret} />);
}

async function submitExisting() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: "Existing Organization" }));
  await user.type(screen.getByLabelText("Organization ID"), "partner-1");
  await user.click(screen.getByRole("button", { name: "Complete setup" }));
}

describe("Setup Link UI", () => {
  it("creates a recipient-bound link, displays it and copies the URL", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockImplementation(
      mocks.writeText,
    );
    render(<SetupLinkCreator />);
    await user.type(screen.getByLabelText("Hosted Project ID"), "project-1");
    await user.type(
      screen.getByLabelText("Recipient email"),
      "partner@example.com",
    );
    await user.click(screen.getByRole("button", { name: "Neuer Link" }));
    expect(mocks.create).toHaveBeenCalledWith({
      projectId: "project-1",
      recipientEmail: "partner@example.com",
    });
    const url = screen.getByLabelText("Recipient setup link") as HTMLInputElement;
    expect(url.value).toContain("/setup-links/link-1?secret=private-secret");
    await user.click(screen.getByRole("button", { name: "Kopieren" }));
    expect(mocks.writeText).toHaveBeenCalledWith(url.value);
  });

  it("does not submit a missing secret", () => {
    render(<SetupLinkRecipient id="link-1" />);
    expect(screen.getByText("Invalid setup link")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Complete setup" })).toBeNull();
  });

  it("renders new Organization setup and never claims Hosting membership", async () => {
    recipient();
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText("New Organization name"),
      "New Partner",
    );
    await user.click(screen.getByRole("button", { name: "Complete setup" }));
    expect(mocks.consume).toHaveBeenCalledWith({
      id: "link-1",
      secret: "private-secret",
      organization: { kind: "new", name: "New Partner" },
    });
    expect(await screen.findByText("Project Partnership created")).toBeTruthy();
    expect(
      screen.getByText(/does not grant Hosting Organization membership/i),
    ).toBeTruthy();
  });

  it("shows Owner verification on the existing path and sends the ID for server verification", async () => {
    recipient();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("radio", { name: "Existing Organization" }),
    );
    expect(screen.getByText(/verified by the server/i)).toBeTruthy();
    await user.type(screen.getByLabelText("Organization ID"), "partner-1");
    await user.click(screen.getByRole("button", { name: "Complete setup" }));
    expect(mocks.consume).toHaveBeenCalledWith({
      id: "link-1",
      secret: "private-secret",
      organization: { kind: "existing", organizationId: "partner-1" },
    });
  });

  const states = [
    {
      code: "NOT_FOUND",
      message: "Setup link not found.",
      heading: "Invalid setup link",
    },
    {
      code: "BAD_REQUEST",
      message: "This setup link is disabled.",
      heading: "Disabled setup link",
    },
    {
      code: "BAD_REQUEST",
      message: "This setup link has expired.",
      heading: "Expired setup link",
    },
    {
      code: "FORBIDDEN",
      message: "This setup link belongs to another email address.",
      heading: "Wrong email address",
    },
    {
      code: "BAD_REQUEST",
      message: "This setup link has already been used for another Organization.",
      heading: "Setup already completed",
    },
    {
      code: "FORBIDDEN",
      message: "You must be an Owner of the selected Organization.",
      heading: "Owner verification required",
    },
    {
      code: "BAD_REQUEST",
      message: "This Organization is already assigned to the Project.",
      heading: "Setup already completed",
    },
    {
      code: "BAD_REQUEST",
      message: "This Project is no longer available.",
      heading: "Project unavailable",
    },
    {
      code: "BAD_REQUEST",
      message: "The Hosting Organization cannot be its own Partner Organization.",
      heading: "Invalid Partner Organization",
    },
  ];

  it.each(states)(
    "maps $code / $message to $heading without displaying remote text",
    async ({ code, message, heading }) => {
      const escaped = message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(source).toMatch(
        new RegExp(`errors\\.${code}\\(\\{\\s*message:\\s*"${escaped}"`, "s"),
      );
      mocks.consume.mockRejectedValue(new ORPCError(code, { message }));
      recipient();
      await submitExisting();
      expect(await screen.findByText(heading)).toBeTruthy();
      expect(screen.queryByText(message)).toBeNull();
    },
  );

  it("does not mistake a known message paired with the wrong code for a link state", async () => {
    mocks.consume.mockRejectedValue(
      new ORPCError("FORBIDDEN", { message: "This setup link is disabled." }),
    );
    recipient();
    await submitExisting();
    expect(await screen.findByText("Could not complete setup")).toBeTruthy();
    expect(screen.queryByText("Disabled setup link")).toBeNull();
  });

  it("renders an unknown error safely, without leaking remote data", async () => {
    mocks.consume.mockRejectedValue(
      new ORPCError("BAD_REQUEST", { message: "postgres://private" }),
    );
    recipient();
    await submitExisting();
    expect(await screen.findByText("Could not complete setup")).toBeTruthy();
    expect(screen.queryByText(/postgres/)).toBeNull();
  });
});
