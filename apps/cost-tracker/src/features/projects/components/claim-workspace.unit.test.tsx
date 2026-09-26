import { ORPCError } from "@orpc/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/lib/tanstack-react-query/client";

const mocks = vi.hoisted(() => ({
  draft: null as null | { id: string; partnershipId: string; status: "editable" },
  accounts: [
    { id: "account", accountHolder: "Partner", iban: "DE123", bic: null },
  ],
  selected: null as string | null,
  journeys: [] as {
    id: string;
    projectParticipantId: string;
    origin: string;
    destination: string;
    tripType: "one-way";
    erasmusDistanceKm: string;
  }[],
  costs: [] as {
    id: string;
    amountEur: string;
    transportProfile: string;
    allocationMethod: "equal";
    allocations: {
      projectParticipantId: string;
      amountEur: string;
      percentage: null;
    }[];
    proofDocumentIds: string[];
  }[],
  documents: [] as {
    id: string;
    originalFileName: string;
    mediaType: string;
    byteSize: number;
  }[],
  saveDraft: vi.fn(),
  select: vi.fn(),
  saveJourney: vi.fn(),
  saveCost: vi.fn(),
  link: vi.fn(),
}));

vi.mock("@/lib/orpc/orpc", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/orpc/orpc")>();
  function query<
    T extends {
      queryKey: (...args: never[]) => unknown;
      queryOptions: (options: never) => object;
    },
  >(source: T, getData: () => unknown) {
    return {
      ...source,
      queryKey: source.queryKey,
      queryOptions: (options: never) => ({
        ...source.queryOptions(options),
        queryFn: getData,
      }),
    };
  }
  return {
    ...original,
    orpc: {
      claims: { saveDraft: mocks.saveDraft, selectPayoutAccount: mocks.select },
      journeys: { save: mocks.saveJourney },
      costs: { save: mocks.saveCost, linkDocument: mocks.link },
    },
    orpcQuery: {
      ...original.orpcQuery,
      claims: {
        ...original.orpcQuery.claims,
        getDraft: query(original.orpcQuery.claims.getDraft, () => mocks.draft),
        listPayoutAccounts: query(
          original.orpcQuery.claims.listPayoutAccounts,
          () => ({
            accounts: mocks.accounts,
            selectedPayoutAccountId: mocks.selected,
          }),
        ),
      },
      participations: {
        ...original.orpcQuery.participations,
        listPartnership: query(
          original.orpcQuery.participations.listPartnership,
          () => ({
            participations: [
              {
                id: "person",
                displayName: "Robin",
                projectId: "project",
                representedOrganizationId: "org",
                email: null,
                userId: null,
                country: null,
              },
            ],
            invitations: [],
          }),
        ),
      },
      journeys: {
        list: query(original.orpcQuery.journeys.list, () => mocks.journeys),
      },
      costs: {
        list: query(original.orpcQuery.costs.list, () => ({
          entries: mocks.costs,
          coveredProjectParticipantIds: [],
        })),
      },
      documents: {
        list: query(original.orpcQuery.documents.list, () => mocks.documents),
      },
    },
  };
});

import { ClaimWorkspace } from "@/features/projects/components/claim-workspace";

function mount() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ClaimWorkspace partnershipId="own" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.draft = null;
  mocks.selected = null;
  mocks.accounts = [
    { id: "account", accountHolder: "Partner", iban: "DE123", bic: null },
  ];
  mocks.journeys = [];
  mocks.costs = [];
  mocks.documents = [];
  mocks.saveDraft.mockReset().mockImplementation(async () => {
    mocks.draft = { id: "claim", partnershipId: "own", status: "editable" };
    return mocks.draft;
  });
  mocks.select.mockReset().mockImplementation(async () => {
    mocks.selected = "account";
  });
  mocks.saveJourney.mockReset();
  mocks.saveCost.mockReset();
  mocks.link.mockReset();
});

describe("Claim workspace", () => {
  it("does not create on open, selects payout then explicitly saves, and shows saved state", async () => {
    mount();
    expect(
      await screen.findByText(/Opening this workspace saves nothing/),
    ).toBeInTheDocument();
    expect(mocks.saveDraft).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Save Claim draft" }),
    ).toBeDisabled();
    await userEvent.selectOptions(
      screen.getByLabelText("Payout Account"),
      "account",
    );
    await waitFor(() =>
      expect(screen.getByText(/Selected Payout Account:/)).toBeInTheDocument(),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Save Claim draft" }),
    );
    await waitFor(() =>
      expect(screen.getByText(/Claim editable · saved/)).toBeInTheDocument(),
    );
    expect(mocks.saveDraft).toHaveBeenCalledWith({ partnershipId: "own" });
  });

  it("retains invalid journey fields and maps server errors while costs are saved independently", async () => {
    mocks.draft = { id: "claim", partnershipId: "own", status: "editable" };
    mocks.saveJourney.mockRejectedValue(
      new ORPCError("BAD_REQUEST", {
        data: {
          issues: [
            { path: ["origin"], message: "Enter origin." },
            {
              path: ["erasmusDistanceKm"],
              message: "Enter calculator distance.",
            },
          ],
        },
      }),
    );
    mocks.saveCost.mockResolvedValue({ id: "cost" });
    mount();
    await screen.findByText("No costs saved yet.");
    await userEvent.selectOptions(
      screen.getByLabelText("Participation"),
      "person",
    );
    await userEvent.type(screen.getByLabelText("Origin"), "Mars");
    await userEvent.type(
      screen.getByLabelText(/Erasmus Distance-Calculator distance/),
      "bad",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save journey" }));
    expect(await screen.findByText("Enter origin.")).toBeInTheDocument();
    expect(screen.getByText("Enter calculator distance.")).toBeInTheDocument();
    expect(screen.getByLabelText("Origin")).toHaveValue("Mars");
    expect(
      screen.getByLabelText(/Erasmus Distance-Calculator distance/),
    ).toHaveValue("bad");
    await userEvent.type(screen.getByLabelText("Exact total (EUR)"), "10.00");
    await userEvent.click(screen.getByRole("checkbox", { name: "Robin" }));
    await userEvent.click(screen.getByRole("button", { name: "Save cost" }));
    await waitFor(() =>
      expect(mocks.saveCost).toHaveBeenCalledWith(
        expect.objectContaining({
          partnershipId: "own",
          allocations: [{ projectParticipantId: "person" }],
        }),
      ),
    );
    expect(screen.getByLabelText("Origin")).toHaveValue("Mars");
  });

  it("surfaces the server one-journey rule at Participation without clearing the form", async () => {
    mocks.saveJourney.mockRejectedValue(
      new ORPCError("BAD_REQUEST", {
        message: "This Participation already has a Participant Journey.",
      }),
    );
    mount();
    await screen.findByText(/No journeys saved yet/);
    await userEvent.selectOptions(
      screen.getByLabelText("Participation"),
      "person",
    );
    await userEvent.type(screen.getByLabelText("Origin"), "Berlin");
    await userEvent.click(screen.getByRole("button", { name: "Save journey" }));
    expect(
      await screen.findByText(
        "This Participation already has a Participant Journey.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Origin")).toHaveValue("Berlin");
  });

  it("shows share totals and server field errors without clearing an incomplete cost", async () => {
    mocks.draft = { id: "claim", partnershipId: "own", status: "editable" };
    mocks.saveCost.mockRejectedValue(
      new ORPCError("BAD_REQUEST", {
        data: {
          issues: [
            {
              path: ["allocations", 0, "percentage"],
              message: "Invalid percentage.",
            },
            { path: ["allocations"], message: "Shares must total 100%." },
          ],
        },
      }),
    );
    mount();
    await screen.findByText("No costs saved yet.");
    await userEvent.selectOptions(
      screen.getByLabelText("Allocation method"),
      "percentage",
    );
    await userEvent.click(screen.getByRole("checkbox", { name: "Robin" }));
    await userEvent.type(screen.getByLabelText("Robin percentage"), "35.5");
    expect(
      screen.getByText(/Entered shares total: 35.500000 % of 100%/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save cost" }));
    expect(await screen.findByText("Invalid percentage.")).toBeInTheDocument();
    expect(screen.getByText("Shares must total 100%.")).toBeInTheDocument();
    expect(screen.getByLabelText("Robin percentage")).toHaveValue("35.5");
  });

  it("shows only Claim documents as picker options, linked state and upload progress", async () => {
    mocks.draft = { id: "claim", partnershipId: "own", status: "editable" };
    mocks.costs = [
      {
        id: "entry",
        amountEur: "5.00",
        transportProfile: "train",
        allocationMethod: "equal",
        allocations: [
          { projectParticipantId: "person", amountEur: "5.00", percentage: null },
        ],
        proofDocumentIds: [],
      },
    ];
    mocks.documents = [
      {
        id: "proof",
        originalFileName: "receipt.pdf",
        mediaType: "application/pdf",
        byteSize: 4,
      },
    ];
    const send = vi.fn();
    class UploadRequest {
      upload = { onprogress: null as null | ((event: ProgressEvent) => void) };
      onload: null | (() => void) = null;
      onerror = null;
      status = 201;
      open = vi.fn();
      send = send;
    }
    const original = globalThis.XMLHttpRequest;
    const requests: UploadRequest[] = [];
    class FakeUploadRequest extends UploadRequest {
      constructor() {
        super();
        requests.push(this);
      }
    }
    vi.stubGlobal("XMLHttpRequest", FakeUploadRequest);
    try {
      mount();
      expect(
        await screen.findByText(/receipt.pdf \(4 bytes\)/),
      ).toBeInTheDocument();
      const picker = screen.getByLabelText("Link a Proof Document to this cost");
      expect(
        within(picker).getByRole("option", { name: "receipt.pdf" }),
      ).toHaveValue("proof");
      expect(
        within(picker).queryByRole("option", { name: "other-claim.pdf" }),
      ).toBeNull();
      await userEvent.selectOptions(picker, "proof");
      await waitFor(() =>
        expect(mocks.link).toHaveBeenCalledWith({
          partnershipId: "own",
          entryId: "entry",
          proofDocumentId: "proof",
        }),
      );
      await userEvent.upload(
        screen.getByLabelText(/Upload Proof Document/),
        new File(["test"], "test.pdf", { type: "application/pdf" }),
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Upload document" }),
      );
      expect(send).toHaveBeenCalled();
      expect(screen.getByRole("progressbar")).toHaveValue(0);
      requests[0].upload.onprogress?.({
        lengthComputable: true,
        loaded: 3,
        total: 4,
      } as ProgressEvent);
      await waitFor(() =>
        expect(screen.getByRole("progressbar")).toHaveValue(75),
      );
      requests[0].onload?.();
      await waitFor(() =>
        expect(screen.getByText("Proof Document uploaded.")).toBeInTheDocument(),
      );
    } finally {
      vi.stubGlobal("XMLHttpRequest", original);
    }
  });

  it("shows account absence and saved journeys read-only", async () => {
    mocks.accounts = [];
    mocks.journeys = [
      {
        id: "journey",
        projectParticipantId: "person",
        origin: "Berlin",
        destination: "Riga",
        tripType: "one-way",
        erasmusDistanceKm: "850",
      },
    ];
    mount();
    expect(
      await screen.findByText(/Contact your Organization admin/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Berlin → Riga/)).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Robin" })).toBeNull();
  });
});
