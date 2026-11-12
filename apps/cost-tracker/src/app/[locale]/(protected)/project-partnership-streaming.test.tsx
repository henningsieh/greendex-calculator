// @vitest-environment node

import { PassThrough } from "node:stream";

import { ORPCError } from "@orpc/client";
import { NextIntlClientProvider } from "next-intl";
import { renderToPipeableStream } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

import { messages } from "@/__tests__/i18n";

vi.mock("@greendex/i18n/server", async () => ({
  getTranslations: (await import("@/__tests__/i18n")).getTranslations,
}));

vi.mock("@/lib/orpc/client.server", () => ({}));
vi.mock("@/lib/i18n/routing", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({
  connection: () => Promise.resolve(),
}));
const mocks = vi.hoisted(() => ({
  membership: vi.fn().mockResolvedValue(true),
  query: vi.fn(),
  listHostedOptions: vi.fn(),
  listOrganizationOptions: vi.fn().mockResolvedValue([]),
  requireSession: vi
    .fn()
    .mockResolvedValue({ session: { activeOrganizationId: null } }),
  canViewPartnerNetwork: vi.fn().mockResolvedValue(true),
  permissions: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/session", () => ({
  hasOrganizationMembership: mocks.membership,
  requireSession: mocks.requireSession,
}));
vi.mock("@/features/organizations/access", () => ({
  canViewPartnerNetwork: mocks.canViewPartnerNetwork,
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/orpc/middleware", () => ({
  hasCostTrackerPermissions: mocks.permissions,
}));
vi.mock("@/lib/orpc/orpc", () => {
  const queryOptions = ({ input }: { input?: unknown } = {}) => ({ input });
  return {
    orpc: {
      projects: { listHostedOptions: mocks.listHostedOptions },
      organizations: { listOptions: mocks.listOrganizationOptions },
    },
    orpcQuery: {
      claims: Object.fromEntries(
        [
          "getDraft",
          "getHistory",
          "previewSubmission",
          "listPayoutAccounts",
          "getReviewDetails",
          "reviewerAccess",
        ].map((name) => [name, { queryOptions }]),
      ),
      participations: {
        get: { queryOptions },
        listPartnership: { queryOptions },
        listHostedReport: { queryOptions },
      },
      journeys: { list: { queryOptions } },
      costs: { list: { queryOptions } },
      documents: { list: { queryOptions } },
      projects: {
        get: { queryOptions },
        searchHosted: { queryOptions },
        listHostedOptions: {
          queryOptions: () => ({ queryKey: ["hosted-options"] }),
        },
      },
      organizations: {
        listOptions: {
          queryOptions: () => ({ queryKey: ["organization-options"] }),
        },
      },
      projectPartnerships: { list: { queryOptions } },
    },
  };
});
vi.mock("@/lib/tanstack-react-query/hydration", () => ({
  getQueryClient: () => ({ query: mocks.query }),
  HydrateClient: ({ children }: { children: React.ReactNode }) => children,
  swallowPrefetchError: vi.fn(),
}));
vi.mock("@/components/query-data-error-boundary", () => ({
  ProjectDataErrorBoundary: ({ children }: { children: React.ReactNode }) =>
    children,
}));
vi.mock(
  "@/features/participant-onboarding/components/participant-onboarding",
  () => ({
    ParticipantDashboard: () => null,
  }),
);
vi.mock("@/features/claims/components/claim-workspace", () => ({
  ClaimWorkspace: () => <p>Resolved Claim workspace</p>,
}));
vi.mock("@/features/claims/components/claim-review", () => ({
  ClaimReview: () => <p>Resolved Claim review</p>,
}));
vi.mock("@/features/claims/components/claim-review-queue", () => ({
  ClaimReviewQueue: () => <p>Resolved Claim queue</p>,
}));
vi.mock("@/features/participations/components/participant-coordination", () => ({
  ParticipantCoordination: () => <p>Resolved Participations</p>,
}));
vi.mock("@/features/participations/components/participant-details", () => ({
  ParticipantDetails: () => <p>Resolved Participant details</p>,
}));
vi.mock("@/features/participations/components/hosted-participant-report", () => ({
  HostedParticipantReport: () => <p>Resolved Hosted report</p>,
}));
vi.mock("@/features/partnerships/components/partnership-actions", () => ({
  PartnershipActions: () => <p>Resolved selection options</p>,
}));
vi.mock("@/features/partnerships/components/project-partnership-manager", () => ({
  ProjectPartnershipManager: () => <p>Resolved Partnerships</p>,
}));
vi.mock("@/features/projects/components/project-workspace", () => ({
  ProjectWorkspace: () => <p>Resolved Project workspace</p>,
}));
vi.mock("@/features/partnerships/components/setup-link", () => ({
  CreateSetupLinkDialog: () => <p>Setup link dialog</p>,
  SetupLinkList: () => <p>Setup link list</p>,
}));

import LocalizedClaimReviewQueuePage from "@/app/[locale]/(protected)/claims/review/page";
import LocalizedPartnerOrganizationsPage from "@/app/[locale]/(protected)/partner-organizations/page";
import LocalizedClaimPage, {
  metadata as LocalizedClaimPageMetadata,
} from "@/app/[locale]/(protected)/partnerships/[partnershipId]/claim/page";
import LocalizedClaimReviewPage, {
  metadata as LocalizedClaimReviewPageMetadata,
} from "@/app/[locale]/(protected)/partnerships/[partnershipId]/claim/review/page";
import LocalizedParticipantDetailsPage, {
  metadata as LocalizedParticipantDetailsPageMetadata,
} from "@/app/[locale]/(protected)/partnerships/[partnershipId]/participants/[participationId]/page";
import LocalizedPartnershipParticipantsPage, {
  metadata as LocalizedPartnershipParticipantsPageMetadata,
} from "@/app/[locale]/(protected)/partnerships/[partnershipId]/participants/page";
import LocalizedProjectPage from "@/app/[locale]/(protected)/projects/[id]/page";
import LocalizedHostedParticipantsPage, {
  metadata as LocalizedHostedParticipantsPageMetadata,
} from "@/app/[locale]/(protected)/projects/[id]/participants/page";
import ParticipantPage from "@/app/[locale]/(setup)/participant/page";
import { PartnershipActionsSection } from "@/features/partnerships/components/partnership-actions-section";

const routes = [
  {
    path: "/[locale]/partnerships/[partnershipId]/claim",
    Page: LocalizedClaimPage,
    heading: "Claim workspace",
    label: "Loading Claim workspace",
    content: "Resolved Claim workspace",
  },
  {
    path: "/[locale]/claims/review",
    Page: LocalizedClaimReviewQueuePage,
    heading: "Hosting Claim review",
    label: "Loading submitted Claims",
    content: "Resolved Claim queue",
  },
  {
    path: "/[locale]/partnerships/[partnershipId]/claim/review",
    Page: LocalizedClaimReviewPage,
    heading: "Review claim",
    label: "Loading Claim review",
    content: "Resolved Claim review",
  },
  {
    path: "/[locale]/partnerships/[partnershipId]/participants",
    Page: LocalizedPartnershipParticipantsPage,
    heading: "Project Participations",
    label: "Loading Project Participations",
    content: "Resolved Participations",
  },
  {
    path: "/[locale]/partnerships/[partnershipId]/participants/[participationId]",
    Page: LocalizedParticipantDetailsPage,
    heading: "Participant details",
    label: "Loading Participant details",
    content: "Resolved Participant details",
  },
  {
    path: "/[locale]/projects/[id]/participants",
    Page: LocalizedHostedParticipantsPage,
    heading: "Participants report",
    label: "Loading the Participants report",
    content: "Resolved Hosted report",
  },
  {
    path: "/[locale]/partner-organizations",
    Page: LocalizedPartnerOrganizationsPage,
    heading: "Partner Organizations",
    label: "Loading Project Partnerships",
    content: "Resolved Partnerships",
  },
  {
    path: "/[locale]/projects/[id]",
    Page: LocalizedProjectPage,
    heading: "Project workspace",
    label: "Loading Project workspace",
    content: "Resolved Project workspace",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.membership.mockResolvedValue(true);
  mocks.permissions.mockResolvedValue(false);
  mocks.listHostedOptions.mockResolvedValue([]);
});

it.each([
  { path: "[locale]/claim", Page: LocalizedClaimPage },
  { path: "[locale]/claim/review", Page: LocalizedClaimReviewPage },
])(
  "$path uses partnershipId without the former id parameter",
  async ({ Page }) => {
    mocks.query.mockResolvedValue(undefined);
    const destination = new PassThrough();
    destination.resume();
    const complete = new Promise<void>((resolve) =>
      destination.on("end", resolve),
    );
    const errors: unknown[] = [];
    const { pipe } = renderToPipeableStream(
      <NextIntlClientProvider locale="de" messages={messages} timeZone="UTC">
        <Page
          params={Promise.resolve({ partnershipId: "requested-partnership" })}
        />
      </NextIntlClientProvider>,
      {
        onShellReady: () => pipe(destination),
        onError: (error) => {
          errors.push(error);
        },
      },
    );
    await complete;
    expect(errors).toEqual([]);
    const scopedInputs = mocks.query.mock.calls
      .map(([options]) => options.input)
      .filter((input) => input !== undefined);
    expect(scopedInputs.length).toBeGreaterThan(0);
    expect(scopedInputs).toEqual(
      scopedInputs.map(() => ({ partnershipId: "requested-partnership" })),
    );
  },
);

it("prefetches the authorized Claim review snapshot", async () => {
  mocks.query.mockResolvedValue({
    projectName: "Workshop",
    organizationName: "Partner Organization",
  });
  const destination = new PassThrough();
  destination.resume();
  const complete = new Promise<void>((resolve) => destination.on("end", resolve));
  const errors: unknown[] = [];
  const { pipe } = renderToPipeableStream(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <LocalizedClaimReviewPage
        params={Promise.resolve({ partnershipId: "requested-partnership" })}
      />
    </NextIntlClientProvider>,
    {
      onShellReady: () => pipe(destination),
      onError: (error) => {
        errors.push(error);
      },
    },
  );
  await complete;
  expect(errors).toEqual([]);
  expect(mocks.query).toHaveBeenCalledWith({
    input: { partnershipId: "requested-partnership" },
  });
  // Header context + the four section prefetches. The mocked QueryClient does
  // not dedupe by key; the request-scoped client does, so this is a superset.
  expect(mocks.query).toHaveBeenCalledTimes(5);
});

it("renders the authorized review context in the page header", async () => {
  mocks.query.mockResolvedValue({
    projectName: "Workshop",
    organizationName: "Partner Organization",
  });
  const destination = new PassThrough();
  let html = "";
  destination.setEncoding("utf8");
  destination.on("data", (chunk: string) => {
    html += chunk;
  });
  const complete = new Promise<void>((resolve) => destination.on("end", resolve));
  const errors: unknown[] = [];
  const { pipe } = renderToPipeableStream(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <LocalizedClaimReviewPage
        params={Promise.resolve({ partnershipId: "requested-partnership" })}
      />
    </NextIntlClientProvider>,
    {
      onShellReady: () => pipe(destination),
      onError: (error) => {
        errors.push(error);
      },
    },
  );
  await complete;
  expect(errors).toEqual([]);
  expect(html).toContain("Workshop · Partner Organization");
});

it("degrades the review context instead of failing the page when refused", async () => {
  mocks.query.mockRejectedValue(new ORPCError("FORBIDDEN"));
  const destination = new PassThrough();
  destination.resume();
  const complete = new Promise<void>((resolve) => destination.on("end", resolve));
  const errors: unknown[] = [];
  const { pipe } = renderToPipeableStream(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <LocalizedClaimReviewPage
        params={Promise.resolve({ partnershipId: "requested-partnership" })}
      />
    </NextIntlClientProvider>,
    {
      onShellReady: () => pipe(destination),
      onError: (error) => {
        errors.push(error);
      },
    },
  );
  await complete;
  expect(errors).toEqual([]);
});

it.each(routes)(
  "$path streams matching cards before request data resolves",
  async ({ Page, heading, label, content }) => {
    let resolveData!: (value: undefined) => void;
    const data = new Promise<undefined>((resolve) => {
      resolveData = resolve;
    });
    mocks.query.mockReturnValue(data);
    const destination = new PassThrough();
    let html = "";
    const shell = new Promise<void>((resolve) => {
      destination.setEncoding("utf8");
      destination.on("data", (chunk: string) => {
        html += chunk;
        if (html.includes(label)) resolve();
      });
    });
    const complete = new Promise<void>((resolve) =>
      destination.on("end", resolve),
    );
    const errors: unknown[] = [];
    const { pipe } = renderToPipeableStream(
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <div>
          <Page
            params={Promise.resolve({
              id: "partnership-1",
              partnershipId: "partnership-1",
              participationId: "participation-1",
            })}
          />
        </div>
      </NextIntlClientProvider>,
      {
        onShellReady: () => pipe(destination),
        onError: (error) => {
          errors.push(error);
        },
      },
    );
    try {
      await shell;
      expect(html).toContain(heading);
      expect(html).toContain('data-slot="card"');
      expect(html).not.toContain(content);
    } finally {
      resolveData(undefined);
      await complete;
    }
    expect(errors).toEqual([]);
    expect(html).toContain(content);
  },
);

it.each(routes)(
  "$path skips scoped work without active Organization Membership",
  async ({ Page }) => {
    mocks.membership.mockResolvedValue(false);
    expect(
      await Page({
        params: Promise.resolve({
          id: "partnership-1",
          partnershipId: "partnership-1",
          participationId: "participation-1",
        }),
      }),
    ).toBeNull();
    expect(mocks.membership).toHaveBeenCalledOnce();
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.canViewPartnerNetwork).not.toHaveBeenCalled();
    expect(mocks.permissions).not.toHaveBeenCalled();
  },
);

it("does not load project options for viewers without assignment permission", async () => {
  mocks.permissions.mockResolvedValue(false);
  mocks.query.mockResolvedValue(undefined);
  const destination = new PassThrough();
  destination.resume();
  const complete = new Promise<void>((resolve) => destination.on("end", resolve));
  const { pipe } = renderToPipeableStream(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <LocalizedPartnerOrganizationsPage />
    </NextIntlClientProvider>,
    { onShellReady: () => pipe(destination) },
  );
  await complete;
  expect(
    mocks.query.mock.calls.map(([options]) => options.queryKey),
  ).not.toContainEqual(["hosted-options"]);
  expect(
    mocks.query.mock.calls.map(([options]) => options.queryKey),
  ).not.toContainEqual(["organization-options"]);
});

it("starts both optional selection queries before either resolves and streams the shell", async () => {
  mocks.permissions.mockResolvedValue(true);
  let resolveOptions!: () => void;
  const pending = new Promise<void>((resolve) => {
    resolveOptions = resolve;
  });
  let startedOptions!: () => void;
  const started = new Promise<void>((resolve) => {
    startedOptions = resolve;
  });
  let count = 0;
  mocks.query.mockImplementation((options) => {
    if (!options.queryKey) return Promise.resolve();
    if (++count === 2) startedOptions();
    return pending;
  });
  const destination = new PassThrough();
  let html = "";
  const shell = new Promise<void>((resolve) => {
    destination.setEncoding("utf8");
    destination.on("data", (chunk: string) => {
      html += chunk;
      if (html.includes("Loading selection options")) resolve();
    });
  });
  const complete = new Promise<void>((resolve) => destination.on("end", resolve));
  const errors: unknown[] = [];
  const { pipe } = renderToPipeableStream(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <LocalizedPartnerOrganizationsPage />
    </NextIntlClientProvider>,
    {
      onShellReady: () => pipe(destination),
      onError: (error) => {
        errors.push(error);
      },
    },
  );
  try {
    await shell;
    await started;
    expect(html).toContain("Partner Organizations");
    expect(html).not.toContain("Resolved selection options");
    expect(mocks.query.mock.calls.map(([options]) => options.queryKey)).toEqual(
      expect.arrayContaining([["hosted-options"], ["organization-options"]]),
    );
  } finally {
    resolveOptions();
    await complete;
  }
  expect(errors).toEqual([]);
  expect(html).toContain("Resolved selection options");
});

it("keys the actions error boundary to the active Organization", async () => {
  mocks.query.mockResolvedValue(undefined);
  mocks.requireSession.mockResolvedValueOnce({
    session: { activeOrganizationId: "first" },
  });
  const first = await PartnershipActionsSection();
  mocks.requireSession.mockResolvedValueOnce({
    session: { activeOrganizationId: "second" },
  });
  const second = await PartnershipActionsSection();
  expect(first.props.children.key).toBe("first");
  expect(second.props.children.key).toBe("second");
});

it("continues to the consumer when either optional prefetch fails", async () => {
  mocks.permissions.mockResolvedValue(true);
  mocks.query.mockImplementation((options) =>
    options.queryKey ? Promise.reject(new Error("private")) : Promise.resolve(),
  );
  const destination = new PassThrough();
  let html = "";
  destination.setEncoding("utf8");
  destination.on("data", (chunk: string) => {
    html += chunk;
  });
  const complete = new Promise<void>((resolve) => destination.on("end", resolve));
  const { pipe } = renderToPipeableStream(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <LocalizedPartnerOrganizationsPage />
    </NextIntlClientProvider>,
    { onShellReady: () => pipe(destination) },
  );
  await complete;
  expect(html).toContain("Resolved selection options");
  expect(html).not.toContain("private");
});

it("Participant personal page requires a session, not active Organization Membership", async () => {
  mocks.membership.mockResolvedValue(false);
  expect(await ParticipantPage()).not.toBeNull();
  expect(mocks.requireSession).toHaveBeenCalledOnce();
  expect(mocks.membership).not.toHaveBeenCalled();
});

it.each(
  routes.filter(({ path }) => /\[[^\]]+\]/.test(path.replace("/[locale]", ""))),
)(
  "$path streams the shell without resolving route identity",
  async ({ Page, label, content }) => {
    let resolveParams!: (value: {
      id: string;
      partnershipId: string;
      participationId: string;
    }) => void;
    const params = new Promise<{
      id: string;
      partnershipId: string;
      participationId: string;
    }>((resolve) => {
      resolveParams = resolve;
    });
    mocks.query.mockResolvedValue(undefined);
    const destination = new PassThrough();
    let html = "";
    const shell = new Promise<void>((resolve) => {
      destination.setEncoding("utf8");
      destination.on("data", (chunk: string) => {
        html += chunk;
        if (html.includes(label)) resolve();
      });
    });
    const complete = new Promise<void>((resolve) =>
      destination.on("end", resolve),
    );
    const { pipe } = renderToPipeableStream(
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <div>
          <Page params={params} />
        </div>
      </NextIntlClientProvider>,
      {
        onShellReady: () => pipe(destination),
      },
    );
    try {
      await shell;
      expect(mocks.query).not.toHaveBeenCalled();
      expect(html).not.toContain(content);
    } finally {
      resolveParams({
        id: "partnership-1",
        partnershipId: "partnership-1",
        participationId: "participation-1",
      });
      await complete;
    }
    expect(html).toContain(content);
    expect(mocks.query).toHaveBeenCalled();
  },
);

it.each([
  ["Claim workspace", LocalizedClaimPageMetadata],
  ["Review claim", LocalizedClaimReviewPageMetadata],
  ["Project Participations", LocalizedPartnershipParticipantsPageMetadata],
  ["Participant details", LocalizedParticipantDetailsPageMetadata],
  ["Participants report", LocalizedHostedParticipantsPageMetadata],
])("preserves %s metadata", (title, localized) => {
  expect(localized).toEqual({ title });
});
