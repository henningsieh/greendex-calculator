import { ORPCError } from "@orpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import type { OnboardingDecision } from "@/features/authentication/onboarding-decision";

const mocks = vi.hoisted(() => ({
  next: vi.fn(),
  reject: vi.fn(),
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
    organizations: { rejectInvitation: mocks.reject },
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
  await user.type(await screen.findByTestId("setup-name"), "Our Organization");
  await user.selectOptions(screen.getByTestId("setup-country"), "DE");
  await user.click(screen.getByTestId("complete-setup"));
}
async function existing() {
  const user = userEvent.setup({ delay: null });
  const radio = screen.queryByTestId("setup-existing-organization");
  if (radio) await user.click(radio);
  await user.click(await screen.findByTestId("entity-combobox-trigger"));
  await user.type(screen.getByRole("combobox"), "Our");
  await user.click(screen.getByRole("option"));
  await user.click(screen.getByTestId("complete-setup"));
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
    await screen.findByTestId("complete-setup");
    expect(Boolean(screen.queryByTestId("setup-name"))).toBe(create);
    expect(Boolean(screen.queryByTestId("entity-combobox-trigger"))).toBe(owned);
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
  const action = await screen.findByTestId("use-setup-organization-retained");
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
  expect(await screen.findByTestId("open-partner-project")).toHaveAttribute(
    "href",
    "/projects/partner-project",
  );
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
  expect(screen.queryByTestId("setup-name")).not.toBeInTheDocument();
});

it("uses the retained exact Organization after a lost binding response and remount", async () => {
  mocks.next
    .mockResolvedValueOnce(choose)
    .mockResolvedValueOnce(choose)
    .mockResolvedValue(bind);
  mocks.bind.mockRejectedValueOnce(new Error("lost response"));
  const view = recipient();
  await create();
  await screen.findByTestId("inspect-setup");
  view.unmount();
  recipient();
  await userEvent.click(await screen.findByTestId("retry-retained-setup"));
  await waitFor(() => expect(mocks.bind).toHaveBeenCalledTimes(2));
  expect(mocks.bind.mock.calls.map(([input]) => input.organizationId)).toEqual([
    "retained",
    "retained",
  ]);
  expect(mocks.create).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId("setup-name")).not.toBeInTheDocument();
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
  await userEvent.click(await screen.findByTestId("inspect-setup"));
  expect(
    await screen.findByTestId("use-setup-organization-retained"),
  ).toBeEnabled();
  expect(mocks.bind).toHaveBeenCalledTimes(1);
  expect(mocks.select).not.toHaveBeenCalled();
});

it("blocks Project access on refused Organization selection", async () => {
  mocks.next.mockResolvedValue(select);
  mocks.select.mockResolvedValue({ error: { code: "FORBIDDEN" } });
  recipient();
  await userEvent.click(
    await screen.findByTestId("use-setup-organization-retained"),
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
  const button = await screen.findByTestId("use-setup-organization-retained");
  await userEvent.click(button);
  expect(button).toBeDisabled();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

it.each([
  "organizationSlugTakenBeforeCreation",
  "organizationNameTakenBeforeCreation",
] as const)(
  "permits a different name after confirmed %s refusal",
  async (situation) => {
    const { createSituationErrors } = await import("@/lib/orpc/errors");
    mocks.create.mockRejectedValueOnce(createSituationErrors()[situation]());
    recipient();
    await create();
    await waitFor(() =>
      expect(document.querySelector('[data-setup-error="create"]')).toBeVisible(),
    );
    expect(localStorage.getItem(key)).toBeNull();
    expect(screen.getByTestId("setup-name")).toBeVisible();
    expect(mocks.next).toHaveBeenLastCalledWith({
      returnTo: "/setup-links/link-1?secret=private-secret",
      setupRecovery: undefined,
    });
    mocks.next
      .mockResolvedValueOnce(choose)
      .mockResolvedValueOnce(bind)
      .mockResolvedValue(select);
    const user = userEvent.setup({ delay: null });
    await user.clear(screen.getByTestId("setup-name"));
    await user.type(screen.getByTestId("setup-name"), "Different name");
    await user.click(screen.getByTestId("complete-setup"));
    await screen.findByTestId("use-setup-organization-retained");
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.create).toHaveBeenLastCalledWith({
      name: "Different name",
      slug: "different-name",
      country: "DE",
    });
  },
);

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
  expect(await screen.findByTestId("entity-combobox-trigger")).toBeVisible();
  expect(screen.queryByTestId("setup-name")).not.toBeInTheDocument();
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
    await screen.findByTestId("inspect-setup");
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
    expect(await screen.findByTestId("retry-retained-setup")).toBeVisible();
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
  expect(await screen.findByTestId("setup-name")).toBeVisible();
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
    expect(screen.getByTestId("inspect-setup")).toBeEnabled();
    expect(screen.queryByTestId("setup-name")).not.toBeInTheDocument();
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
  expect(screen.queryByTestId("complete-setup")).not.toBeInTheDocument();
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
  await screen.findByTestId("complete-setup");
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
  await userEvent.click(await screen.findByTestId("inspect-setup"));
  expect(await screen.findByTestId("entity-combobox-trigger")).toBeEnabled();
  expect(screen.queryByTestId("setup-name")).not.toBeInTheDocument();
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
  expect(screen.queryByTestId("complete-setup")).not.toBeInTheDocument();
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
  await user.click(await screen.findByTestId("entity-combobox-trigger"));
  await user.type(screen.getByRole("combobox"), "Organization 24");
  await user.click(screen.getByRole("option"));
  await user.click(screen.getByTestId("complete-setup"));
  expect(
    await screen.findByTestId("use-setup-organization-retained"),
  ).toBeVisible();
  expect(mocks.bind).toHaveBeenCalledExactlyOnceWith({
    id: "link-1",
    secret: "private-secret",
    organizationId: "owned-24",
  });
});

it("retains the setup destination and reassesses creation after rejecting a colleague invitation", async () => {
  const returnTo = "/setup-links/link?secret=secret";
  mocks.next.mockResolvedValue({
    entryContext: "partner-setup",
    nextStep: "resolve-invitation",
    returnTo,
    invitation: {
      invitationId: "invitation",
      organization: { id: "colleagues", name: "Colleagues" },
    },
    availableActions: [
      { kind: "accept-invitation", invitationId: "invitation" },
      { kind: "reject-invitation", invitationId: "invitation" },
      { kind: "recheck" },
      { kind: "sign-out" },
    ],
  });
  mocks.reject.mockResolvedValue({ success: true });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SetupLinkRecipient id="link" secret="secret" userId="recipient" />
    </QueryClientProvider>,
  );
  expect(
    await screen.findByTestId("organization-creation-blocked"),
  ).toBeVisible();
  expect(screen.queryByTestId("setup-name")).toBeNull();
  mocks.next.mockResolvedValue(choose);
  await userEvent.click(screen.getByTestId("reject-organization-invitation"));
  expect(await screen.findByTestId("setup-name")).toBeVisible();
  expect(screen.getByTestId("setup-invitation-rejected")).toBeVisible();
  expect(mocks.next).toHaveBeenLastCalledWith({ returnTo });
});
