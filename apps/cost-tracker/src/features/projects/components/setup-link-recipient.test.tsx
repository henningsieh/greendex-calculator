import { ORPCError } from "@orpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import type { OnboardingDecision } from "@/features/authentication/onboarding-decision";

const mocks = vi.hoisted(() => ({
  next: vi.fn(),
  create: vi.fn(),
  bind: vi.fn(),
  select: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/orpc/orpc", () => ({
  orpc: {
    authentication: {
      onboardingNextStep: mocks.next,
      createOrganization: mocks.create,
    },
    projectPartnerships: { consumeSetupLink: mocks.bind },
  },
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { organization: { setActive: mocks.select } },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/features/authentication/components/sign-out-button", () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));

import { SetupLinkRecipient } from "@/features/projects/components/setup-link";

const choose: OnboardingDecision = {
  entryContext: "partner-setup",
  nextStep: "choose-organization",
  availableActions: [
    { kind: "create-organization" },
    {
      kind: "choose-owned-organization",
      organizations: [{ id: "owned", name: "Our Organization" }],
    },
    { kind: "sign-out" },
  ],
};
const bind: OnboardingDecision = {
  entryContext: "partner-setup",
  nextStep: "bind-partnership",
  availableActions: [
    { kind: "bind-partnership", organizationId: "retained" },
    { kind: "sign-out" },
  ],
};
const select: OnboardingDecision = {
  entryContext: "partner-setup",
  nextStep: "select-organization",
  availableActions: [
    {
      kind: "select-organization",
      organizations: [{ id: "retained", name: "Our Organization" }],
    },
    { kind: "sign-out" },
  ],
};
const complete: OnboardingDecision = {
  entryContext: "partner-setup",
  nextStep: "continue",
  availableActions: [
    { kind: "continue", destination: "/projects/partner-project" },
  ],
};
const key = "partner-setup:user-1:link-1";

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
  mocks.next.mockResolvedValue(choose);
  mocks.create.mockResolvedValue({ organizationId: "retained", success: true });
  mocks.bind.mockResolvedValue({ organizationId: "retained" });
  mocks.select.mockResolvedValue({ data: {} });
});

function recipient(
  userId = "user-1",
  secret: string | undefined = "private-secret",
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SetupLinkRecipient id="link-1" secret={secret} userId={userId} />
    </QueryClientProvider>,
  );
}
async function create() {
  const user = userEvent.setup({ delay: null });
  await user.type(
    await screen.findByLabelText("New Organization name"),
    "Our Organization",
  );
  await user.selectOptions(screen.getByLabelText("Organization country"), "DE");
  await user.click(screen.getByRole("button", { name: "Complete setup" }));
}
async function existing() {
  const user = userEvent.setup({ delay: null });
  const radio = screen.queryByRole("radio", { name: "Existing Organization" });
  if (radio) await user.click(radio);
  await user.click(await screen.findByRole("button", { name: /^Organization$/ }));
  await user.type(screen.getByRole("combobox"), "Our");
  await user.click(screen.getByRole("option"));
  await user.click(screen.getByRole("button", { name: "Complete setup" }));
}

it.each([
  {
    availableActions: [{ kind: "create-organization" }, { kind: "sign-out" }],
    create: true,
    owned: false,
  },
  {
    availableActions: [
      {
        kind: "choose-owned-organization",
        organizations: [{ id: "owned", name: "Our Organization" }],
      },
      { kind: "sign-out" },
    ],
    create: false,
    owned: true,
  },
])(
  "renders only the server's exact Partner choice tuple $create / $owned",
  async ({ availableActions, create, owned }) => {
    mocks.next.mockResolvedValue({
      nextStep: "choose-organization",
      entryContext: "partner-setup",
      availableActions,
    });
    recipient();
    await screen.findByRole("button", { name: "Complete setup" });
    expect(Boolean(screen.queryByLabelText("New Organization name"))).toBe(
      create,
    );
    expect(Boolean(screen.queryByLabelText("Organization"))).toBe(owned);
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  },
);

it("re-resolves after creation and binding, then selects explicitly before Project access", async () => {
  mocks.next
    .mockResolvedValueOnce(choose)
    .mockResolvedValueOnce(choose)
    .mockResolvedValueOnce(bind)
    .mockResolvedValueOnce(select)
    .mockResolvedValue(complete);
  recipient();
  await create();
  const action = await screen.findByRole("button", {
    name: "Use this Organization",
  });
  expect(mocks.create).toHaveBeenCalledExactlyOnceWith({
    name: "Our Organization",
    slug: "our-organization",
    country: "DE",
  });
  expect(mocks.bind).toHaveBeenCalledExactlyOnceWith({
    id: "link-1",
    secret: "private-secret",
    organizationId: "retained",
  });
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual({
    phase: "created",
    organizationId: "retained",
  });
  await userEvent.click(action);
  expect(
    await screen.findByRole("link", { name: "Open Partner Project" }),
  ).toHaveAttribute("href", "/projects/partner-project");
  expect(mocks.select).toHaveBeenCalledExactlyOnceWith({
    organizationId: "retained",
  });
});

it("honors a changed server decision before either mutation", async () => {
  mocks.next.mockResolvedValueOnce(choose).mockResolvedValue({
    entryContext: "partner-setup",
    nextStep: "setup-recovery",
    reason: "SETUP_LINK_EXPIRED",
    availableActions: [{ kind: "sign-out" }, { kind: "recheck" }],
  });
  recipient();
  await create();
  await waitFor(() =>
    expect(document.querySelector('[data-setup-error="expired"]')).toBeVisible(),
  );
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.bind).not.toHaveBeenCalled();
  expect(
    screen.queryByLabelText("New Organization name"),
  ).not.toBeInTheDocument();
});

it("uses the retained exact Organization after a lost binding response and remount", async () => {
  mocks.next
    .mockResolvedValueOnce(choose)
    .mockResolvedValueOnce(choose)
    .mockResolvedValue(bind);
  mocks.bind.mockRejectedValueOnce(new Error("lost response"));
  const view = recipient();
  await create();
  await screen.findByRole("button", { name: "Inspect setup result" });
  view.unmount();
  recipient();
  await userEvent.click(
    await screen.findByRole("button", {
      name: "Retry setup with retained Organization",
    }),
  );
  await waitFor(() => expect(mocks.bind).toHaveBeenCalledTimes(2));
  expect(mocks.bind.mock.calls.map(([input]) => input.organizationId)).toEqual([
    "retained",
    "retained",
  ]);
  expect(mocks.create).toHaveBeenCalledTimes(1);
  expect(
    screen.queryByLabelText("New Organization name"),
  ).not.toBeInTheDocument();
});

it("inspects an uncertain completed binding without repeating it", async () => {
  mocks.next
    .mockResolvedValueOnce(choose)
    .mockResolvedValueOnce(choose)
    .mockResolvedValueOnce(bind)
    .mockResolvedValue(select);
  mocks.bind.mockRejectedValueOnce(new Error("lost response"));
  recipient();
  await create();
  await userEvent.click(
    await screen.findByRole("button", { name: "Inspect setup result" }),
  );
  expect(
    await screen.findByRole("button", { name: "Use this Organization" }),
  ).toBeEnabled();
  expect(mocks.bind).toHaveBeenCalledTimes(1);
  expect(mocks.select).not.toHaveBeenCalled();
});

it("blocks Project access on refused Organization selection", async () => {
  mocks.next.mockResolvedValue(select);
  mocks.select.mockResolvedValue({ error: { code: "FORBIDDEN" } });
  recipient();
  await userEvent.click(
    await screen.findByRole("button", { name: "Use this Organization" }),
  );
  await waitFor(() =>
    expect(document.querySelector('[data-setup-error="generic"]')).toBeVisible(),
  );
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(mocks.refresh).not.toHaveBeenCalled();
});

it("holds Project access while Organization selection is pending", async () => {
  mocks.next.mockResolvedValue(select);
  mocks.select.mockReturnValue(new Promise(() => {}));
  recipient();
  const button = await screen.findByRole("button", {
    name: "Use this Organization",
  });
  await userEvent.click(button);
  expect(button).toBeDisabled();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

it("never creates again after uncertain creation, but permits correction after confirmed slug refusal", async () => {
  const { createSituationErrors } = await import("@/lib/orpc/errors");
  mocks.create.mockRejectedValueOnce(
    createSituationErrors().organizationSlugTakenBeforeCreation(),
  );
  recipient();
  await create();
  await waitFor(() =>
    expect(document.querySelector('[data-setup-error="create"]')).toBeVisible(),
  );
  expect(localStorage.getItem(key)).toBeNull();
  expect(screen.getByLabelText("New Organization name")).toBeVisible();
});

it("retains the creating checkpoint after an uncertain creation response", async () => {
  mocks.create.mockRejectedValueOnce(new Error("lost response"));
  mocks.next
    .mockResolvedValueOnce(choose)
    .mockResolvedValueOnce(choose)
    .mockResolvedValue({
      nextStep: "choose-organization",
      entryContext: "partner-setup",
      availableActions: [
        {
          kind: "choose-owned-organization",
          organizations: [{ id: "owned", name: "Our Organization" }],
        },
        { kind: "sign-out" },
      ],
    });
  recipient();
  await create();
  expect(await screen.findByLabelText("Organization")).toBeVisible();
  expect(
    screen.queryByLabelText("New Organization name"),
  ).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual({ phase: "creating" });
  expect(mocks.bind).not.toHaveBeenCalled();
});

it("fails closed before mutation when durable recovery cannot be written", async () => {
  const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  try {
    recipient();
    await create();
    await screen.findByRole("button", { name: "Inspect setup result" });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.bind).not.toHaveBeenCalled();
  } finally {
    set.mockRestore();
  }
});

it.each(["corrupt", JSON.stringify({ phase: "invalid" })])(
  "asks the server to inspect corrupt recovery %s",
  async (raw) => {
    localStorage.setItem(key, raw);
    mocks.next.mockResolvedValue(bind);
    recipient();
    expect(
      await screen.findByRole("button", {
        name: "Retry setup with retained Organization",
      }),
    ).toBeVisible();
    expect(mocks.next).toHaveBeenCalledWith({
      returnTo: "/setup-links/link-1?secret=private-secret",
      setupRecovery: { phase: "creating" },
    });
  },
);

it("does not reuse another User's recovery checkpoint", async () => {
  localStorage.setItem(
    key,
    JSON.stringify({ phase: "created", organizationId: "private-org" }),
  );
  recipient("user-2");
  expect(await screen.findByLabelText("New Organization name")).toBeVisible();
  expect(mocks.next).toHaveBeenCalledWith({
    returnTo: "/setup-links/link-1?secret=private-secret",
    setupRecovery: undefined,
  });
});

it.each([
  ["SETUP_LINK_NOT_FOUND", "invalid"],
  ["SETUP_LINK_DISABLED", "disabled"],
  ["SETUP_LINK_EXPIRED", "expired"],
  ["SETUP_LINK_WRONG_EMAIL", "wrong-email"],
  ["SETUP_LINK_USED", "duplicate"],
  ["ORGANIZATION_OWNER_REQUIRED", "owner"],
  ["PARTNERSHIP_ALREADY_ASSIGNED", "duplicate"],
  ["PROJECT_NOT_FOUND", "unavailable"],
  ["SELF_PARTNERSHIP", "host"],
])(
  "renders server recovery %s with no creation action",
  async (reason, state) => {
    mocks.next.mockResolvedValue({
      nextStep: "setup-recovery",
      entryContext: "partner-setup",
      reason,
      availableActions: [{ kind: "sign-out" }, { kind: "recheck" }],
    });
    recipient();
    await waitFor(() =>
      expect(
        document.querySelector(`[data-setup-error="${state}"]`),
      ).toBeVisible(),
    );
    expect(
      screen.getByRole("button", { name: "Inspect setup result" }),
    ).toBeEnabled();
    expect(
      screen.queryByLabelText("New Organization name"),
    ).not.toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
  },
);

it("uses verification instructions instead of setup actions for an unverified account", async () => {
  mocks.next.mockResolvedValue({
    entryContext: "partner-setup",
    nextStep: "verify-email",
    email: "person@example.org",
    availableActions: [{ kind: "sign-out" }],
  });
  recipient();
  expect(await screen.findByTestId("auth-verification-message")).toHaveAttribute(
    "role",
    "status",
  );
  expect(
    screen.queryByRole("button", { name: "Complete setup" }),
  ).not.toBeInTheDocument();
});

it("keeps unknown remote errors out of presentation and offers inspection", async () => {
  const message = vi.fn(() => "private server data");
  const error = new ORPCError("FORBIDDEN", {
    data: { reason: "SETUP_LINK_DISABLED" },
  });
  Object.defineProperty(error, "message", { get: message });
  mocks.next
    .mockResolvedValueOnce(choose)
    .mockResolvedValueOnce(choose)
    .mockResolvedValue(bind);
  mocks.bind.mockRejectedValue(error);
  recipient();
  await screen.findByRole("button", { name: "Complete setup" });
  await existing();
  await waitFor(() =>
    expect(document.querySelector('[data-setup-error="generic"]')).toBeVisible(),
  );
  expect(message).not.toHaveBeenCalled();
});

it("lets selected ownership recovery return to the server's owned choices without new creation", async () => {
  localStorage.setItem(
    key,
    JSON.stringify({ phase: "selected", organizationId: "removed" }),
  );
  mocks.next
    .mockResolvedValueOnce({
      entryContext: "partner-setup",
      nextStep: "setup-recovery",
      reason: "ORGANIZATION_OWNER_REQUIRED",
      availableActions: [{ kind: "sign-out" }, { kind: "recheck" }],
    })
    .mockResolvedValue({
      entryContext: "partner-setup",
      nextStep: "choose-organization",
      availableActions: [
        {
          kind: "choose-owned-organization",
          organizations: [{ id: "owned", name: "Our Organization" }],
        },
        { kind: "sign-out" },
      ],
    });
  recipient();
  await userEvent.click(
    await screen.findByRole("button", { name: "Inspect setup result" }),
  );
  expect(await screen.findByLabelText("Organization")).toBeEnabled();
  expect(
    screen.queryByLabelText("New Organization name"),
  ).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual({ phase: "creating" });
});

it("sends missing-secret links to server recovery without offering creation", async () => {
  mocks.next.mockResolvedValue({
    nextStep: "setup-recovery",
    entryContext: "partner-setup",
    reason: "SETUP_LINK_NOT_FOUND",
    availableActions: [{ kind: "sign-out" }, { kind: "recheck" }],
  });
  recipient("user-1", "");
  await waitFor(() =>
    expect(document.querySelector('[data-setup-error="invalid"]')).toBeVisible(),
  );
  expect(mocks.next).toHaveBeenCalledWith({
    returnTo: "/setup-links/link-1",
    setupRecovery: undefined,
  });
  expect(
    screen.queryByRole("button", { name: "Complete setup" }),
  ).not.toBeInTheDocument();
});

it("searches server-owned choices beyond the initial list and binds the selected Organization", async () => {
  const choices: OnboardingDecision = {
    entryContext: "partner-setup",
    nextStep: "choose-organization",
    availableActions: [
      {
        kind: "choose-owned-organization",
        organizations: Array.from({ length: 25 }, (_, index) => ({
          id: `owned-${index}`,
          name: `Organization ${index}`,
        })),
      },
      { kind: "sign-out" },
    ],
  };
  mocks.next
    .mockResolvedValueOnce(choices)
    .mockResolvedValueOnce(choices)
    .mockResolvedValueOnce({
      ...bind,
      availableActions: [
        { kind: "bind-partnership", organizationId: "owned-24" },
        { kind: "sign-out" },
      ],
    })
    .mockResolvedValue(select);
  recipient();
  const user = userEvent.setup({ delay: null });
  await user.click(await screen.findByRole("button", { name: /^Organization$/ }));
  await user.type(screen.getByRole("combobox"), "Organization 24");
  await user.click(screen.getByRole("option"));
  await user.click(screen.getByRole("button", { name: "Complete setup" }));
  expect(
    await screen.findByRole("button", { name: "Use this Organization" }),
  ).toBeVisible();
  expect(mocks.bind).toHaveBeenCalledExactlyOnceWith({
    id: "link-1",
    secret: "private-secret",
    organizationId: "owned-24",
  });
});
