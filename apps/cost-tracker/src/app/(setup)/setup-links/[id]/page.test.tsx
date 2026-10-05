import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
}));
vi.mock("@/lib/session", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/features/projects/components/setup-link", () => ({
  SetupLinkRecipient: ({ id, secret }: { id: string; secret?: string }) => (
    <p>
      Setup {id}: {secret ?? "invalid"}
    </p>
  ),
}));

import SetupLinkPage from "@/app/(setup)/setup-links/[id]/page";

describe("Setup Link route", () => {
  it("requires sign-in but not Organization membership for a new recipient", async () => {
    render(
      await SetupLinkPage({
        params: Promise.resolve({ id: "link-1" }),
        searchParams: Promise.resolve({ secret: "secret-1" }),
      }),
    );
    expect(mocks.requireSession).toHaveBeenCalledWith(
      "/setup-links/link-1?secret=secret-1",
    );
    expect(screen.getByText("Setup link-1: secret-1")).toBeTruthy();
  });

  it("does not accept ambiguous secrets", async () => {
    render(
      await SetupLinkPage({
        params: Promise.resolve({ id: "link-1" }),
        searchParams: Promise.resolve({ secret: ["first", "second"] }),
      }),
    );
    expect(screen.getByText("Setup link-1: invalid")).toBeTruthy();
  });
});
