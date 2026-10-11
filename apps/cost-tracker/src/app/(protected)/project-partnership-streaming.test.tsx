// @vitest-environment node

import { PassThrough } from "node:stream";

import { renderToPipeableStream } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  membership: vi.fn().mockResolvedValue(true),
  query: vi.fn(),
}));
vi.mock("@/lib/session", () => ({
  hasOrganizationMembership: mocks.membership,
}));
vi.mock("@/features/organizations/access", () => ({
  canViewPartnerNetwork: async () => true,
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/orpc/middleware", () => ({
  hasCostTrackerPermissions: async () => false,
}));
vi.mock("@/lib/orpc/orpc", () => {
  const queryOptions = ({ input }: { input?: unknown } = {}) => ({ input });
  return {
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
      projects: { get: { queryOptions } },
      projectPartnerships: { list: { queryOptions } },
    },
  };
});
vi.mock("@/lib/tanstack-react-query/hydration", () => ({
  getQueryClient: () => ({ query: mocks.query }),
  HydrateClient: ({ children }: { children: React.ReactNode }) => children,
  swallowPrefetchError: vi.fn(),
}));
vi.mock("@/features/projects/components/project-data-error-boundary", () => ({
  ProjectDataErrorBoundary: ({ children }: { children: React.ReactNode }) =>
    children,
}));
vi.mock("@/features/projects/components/claim-workspace", () => ({
  ClaimWorkspace: () => <p>Resolved Claim workspace</p>,
}));
vi.mock("@/features/projects/components/claim-review", () => ({
  ClaimReview: () => <p>Resolved Claim review</p>,
}));
vi.mock("@/features/projects/components/claim-review-queue", () => ({
  ClaimReviewQueue: () => <p>Resolved Claim queue</p>,
}));
vi.mock("@/features/projects/components/participant-coordination", () => ({
  ParticipantCoordination: () => <p>Resolved Participations</p>,
}));
vi.mock("@/features/projects/components/participant-details", () => ({
  ParticipantDetails: () => <p>Resolved Participant details</p>,
}));
vi.mock("@/features/projects/components/hosted-participant-report", () => ({
  HostedParticipantReport: () => <p>Resolved Hosted report</p>,
}));
vi.mock("@/features/projects/components/project-partnership-manager", () => ({
  ProjectPartnershipManager: () => <p>Resolved Partnerships</p>,
}));
vi.mock("@/features/projects/components/project-workspace", () => ({
  ProjectWorkspace: () => <p>Resolved Project workspace</p>,
}));
vi.mock("@/features/projects/components/setup-link", () => ({
  SetupLinkCreator: () => <p>Setup link creator</p>,
}));

import ClaimReviewPage from "@/app/(protected)/claims/review/[id]/page";
import ClaimReviewQueuePage from "@/app/(protected)/claims/review/page";
import PartnerOrganizationsPage from "@/app/(protected)/partner-organizations/page";
import ClaimPage from "@/app/(protected)/partnerships/[id]/claim/page";
import ParticipantDetailsPage from "@/app/(protected)/partnerships/[id]/participants/[participationId]/page";
import PartnershipParticipantsPage from "@/app/(protected)/partnerships/[id]/participants/page";
import ProjectPage from "@/app/(protected)/projects/[id]/page";
import HostedParticipantsPage from "@/app/(protected)/projects/[id]/participants/page";

const routes = [
  {
    path: "/partnerships/[id]/claim",
    Page: ClaimPage,
    heading: "Claim workspace",
    label: "Loading Claim workspace",
    content: "Resolved Claim workspace",
  },
  {
    path: "/claims/review",
    Page: ClaimReviewQueuePage,
    heading: "Hosting Claim review",
    label: "Loading submitted Claims",
    content: "Resolved Claim queue",
  },
  {
    path: "/claims/review/[id]",
    Page: ClaimReviewPage,
    heading: "Claim review",
    label: "Loading Claim review",
    content: "Resolved Claim review",
  },
  {
    path: "/partnerships/[id]/participants",
    Page: PartnershipParticipantsPage,
    heading: "Project Participations",
    label: "Loading Project Participations",
    content: "Resolved Participations",
  },
  {
    path: "/partnerships/[id]/participants/[participationId]",
    Page: ParticipantDetailsPage,
    heading: "Participant details",
    label: "Loading Participant details",
    content: "Resolved Participant details",
  },
  {
    path: "/projects/[id]/participants",
    Page: HostedParticipantsPage,
    heading: "Participants report",
    label: "Loading the Participants report",
    content: "Resolved Hosted report",
  },
  {
    path: "/partner-organizations",
    Page: PartnerOrganizationsPage,
    heading: "Partner Organizations",
    label: "Loading Project Partnerships",
    content: "Resolved Partnerships",
  },
  {
    path: "/projects/[id]",
    Page: ProjectPage,
    heading: "Project workspace",
    label: "Loading Project workspace",
    content: "Resolved Project workspace",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.membership.mockResolvedValue(true);
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
      <Page
        params={Promise.resolve({
          id: "partnership-1",
          participationId: "participation-1",
        })}
      />,
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
  "$path does not render or prefetch without Organization Membership",
  async ({ Page }) => {
    mocks.membership.mockResolvedValue(false);
    expect(
      await Page({
        params: Promise.resolve({
          id: "partnership-1",
          participationId: "participation-1",
        }),
      }),
    ).toBeNull();
    expect(mocks.query).not.toHaveBeenCalled();
  },
);

it.each(routes.filter(({ path }) => path.includes("[id]")))(
  "$path streams the shell without resolving route identity",
  async ({ Page, label, content }) => {
    let resolveParams!: (value: { id: string; participationId: string }) => void;
    const params = new Promise<{ id: string; participationId: string }>(
      (resolve) => {
        resolveParams = resolve;
      },
    );
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
    const { pipe } = renderToPipeableStream(<Page params={params} />, {
      onShellReady: () => pipe(destination),
    });
    try {
      await shell;
      expect(mocks.query).not.toHaveBeenCalled();
      expect(html).not.toContain(content);
    } finally {
      resolveParams({ id: "partnership-1", participationId: "participation-1" });
      await complete;
    }
    expect(html).toContain(content);
    expect(mocks.query).toHaveBeenCalled();
  },
);
