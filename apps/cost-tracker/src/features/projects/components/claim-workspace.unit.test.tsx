import { ORPCError } from "@orpc/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/lib/tanstack-react-query/client";

const mocks = vi.hoisted(() => ({
  draft: null as null | {
    id: string;
    partnershipId: string;
    status:
      | "editable"
      | "submitted"
      | "correction_requested"
      | "approved"
      | "paid"
      | "rejected";
  },
  accounts: [
    { id: "account", accountHolder: "Partner", iban: "DE123", bic: null },
  ],
  selected: null as string | null,
  journeys: [] as {
    id: string;
    projectParticipantId: string;
    origin: string;
    destination: string;
    tripType: "one-way" | "round-trip";
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
  history: [] as {
    eventType: "correction_requested" | "rejected" | "reopened";
    actorUserId: string;
    occurredAt: Date;
    reason: string | null;
  }[],
  preview: null as null | {
    items: {
      key: string;
      passed: boolean;
      gaps: { path: string[]; message: string }[];
    }[];
    calculatedPayableEur: string | null;
  },
  submit: vi.fn(),
  saveDraft: vi.fn(),
  select: vi.fn(),
  createAccount: vi.fn(),
  saveJourney: vi.fn(),
  updateJourney: vi.fn(),
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
      claims: {
        saveDraft: mocks.saveDraft,
        selectPayoutAccount: mocks.select,
        createPayoutAccount: mocks.createAccount,
        submit: mocks.submit,
      },
      journeys: { save: mocks.saveJourney, update: mocks.updateJourney },
      costs: { save: mocks.saveCost, linkDocument: mocks.link },
    },
    orpcQuery: {
      ...original.orpcQuery,
      claims: {
        ...original.orpcQuery.claims,
        getDraft: query(original.orpcQuery.claims.getDraft, () => mocks.draft),
        getHistory: query(
          original.orpcQuery.claims.getHistory,
          () => mocks.history,
        ),
        previewSubmission: query(
          original.orpcQuery.claims.previewSubmission,
          () =>
            mocks.preview ??
            (mocks.draft
              ? null
              : {
                  items: [
                    "payoutAccount",
                    "entries",
                    "entryDetails",
                    "proofDocuments",
                    "participations",
                    "journeys",
                    "fundingRules",
                  ].map((key) => ({
                    key,
                    passed: false,
                    gaps: [
                      { path: [key], message: "Complete this requirement." },
                    ],
                  })),
                  calculatedPayableEur: null,
                }),
        ),
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
  mocks.history = [];
  mocks.selected = null;
  mocks.preview = null;
  mocks.submit.mockReset().mockImplementation(async () => {
    mocks.draft = { id: "claim", partnershipId: "own", status: "submitted" };
    return { id: "claim", status: "submitted", approvedAmountEur: "726.00" };
  });
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
  mocks.select.mockReset().mockImplementation(async (input) => {
    mocks.selected = input.payoutAccountId;
  });
  mocks.createAccount.mockReset().mockImplementation(async () => {
    const account = {
      id: "new-account",
      accountHolder: "Example",
      iban: "DE89370400440532013000",
      bic: null,
    };
    mocks.accounts = [...mocks.accounts, account];
    return account;
  });
  mocks.saveJourney.mockReset();
  mocks.updateJourney.mockReset().mockImplementation(async (input) => {
    mocks.journeys = mocks.journeys.map((journey) =>
      journey.projectParticipantId === input.projectParticipantId
        ? { ...journey, ...input }
        : journey,
    );
  });
  mocks.saveCost.mockReset();
  mocks.link.mockReset();
});

describe("Claim workspace", () => {
  it("corrects a saved journey only during correction, retains field errors, and relocks on resubmission", async () => {
    mocks.journeys = [
      {
        id: "journey",
        projectParticipantId: "person",
        origin: "Berlin",
        destination: "Riga",
        tripType: "one-way",
        erasmusDistanceKm: "800.00",
      },
    ];
    mocks.draft = { id: "claim", partnershipId: "own", status: "submitted" };
    const { unmount } = render(
      <QueryClientProvider client={createQueryClient()}>
        <ClaimWorkspace partnershipId="own" />
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/Berlin → Riga/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Correct Robin's journey" }),
    ).toBeNull();
    unmount();
    mocks.draft = {
      id: "claim",
      partnershipId: "own",
      status: "correction_requested",
    };
    mocks.preview = {
      items: [
        "payoutAccount",
        "entries",
        "entryDetails",
        "proofDocuments",
        "participations",
        "journeys",
        "fundingRules",
      ].map((key) => ({ key, passed: true, gaps: [] })),
      calculatedPayableEur: "844.00",
    };
    mocks.updateJourney.mockRejectedValueOnce(
      new ORPCError("BAD_REQUEST", {
        data: {
          issues: [
            { path: ["origin"], message: "Enter origin." },
            { path: ["destination"], message: "Enter destination." },
            { path: ["tripType"], message: "Select trip type." },
            { path: ["erasmusDistanceKm"], message: "Invalid distance." },
          ],
        },
      }),
    );
    mount();
    await userEvent.click(
      await screen.findByRole("button", { name: "Correct Robin's journey" }),
    );
    expect(screen.getByLabelText("Origin for Robin")).toHaveValue("Berlin");
    expect(screen.getByLabelText("Destination for Robin")).toHaveValue("Riga");
    expect(screen.getByLabelText("Trip type for Robin")).toHaveValue("one-way");
    expect(screen.getByLabelText(/distance \(km\) for Robin/)).toHaveValue(
      "800.00",
    );
    await userEvent.clear(screen.getByLabelText("Origin for Robin"));
    await userEvent.type(screen.getByLabelText("Destination for Robin"), " City");
    await userEvent.selectOptions(
      screen.getByLabelText("Trip type for Robin"),
      "round-trip",
    );
    await userEvent.clear(screen.getByLabelText(/distance \(km\) for Robin/));
    await userEvent.type(
      screen.getByLabelText(/distance \(km\) for Robin/),
      "bad",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Save correction" }),
    );
    for (const message of [
      "Enter origin.",
      "Enter destination.",
      "Select trip type.",
      "Invalid distance.",
    ])
      expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByLabelText(/distance \(km\) for Robin/)).toHaveValue("bad");
    await userEvent.type(screen.getByLabelText("Origin for Robin"), "Tallinn");
    await userEvent.clear(screen.getByLabelText(/distance \(km\) for Robin/));
    await userEvent.type(
      screen.getByLabelText(/distance \(km\) for Robin/),
      "2500",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Save correction" }),
    );
    await waitFor(() =>
      expect(mocks.updateJourney).toHaveBeenLastCalledWith({
        partnershipId: "own",
        projectParticipantId: "person",
        origin: "Tallinn",
        destination: "Riga City",
        tripType: "round-trip",
        erasmusDistanceKm: "2500",
      }),
    );
    await waitFor(() =>
      expect(screen.getByText(/Tallinn → Riga City/)).toBeInTheDocument(),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Correct Robin's journey" }),
    );
    expect(screen.getByLabelText("Origin for Robin")).toHaveValue("Tallinn");
    expect(screen.getByLabelText("Trip type for Robin")).toHaveValue(
      "round-trip",
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mocks.submit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Submit Claim" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm submission" }),
    );
    await waitFor(() =>
      expect(mocks.submit).toHaveBeenCalledWith({ partnershipId: "own" }),
    );
    expect(
      await screen.findByText(/Claim submitted · saved/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Tallinn → Riga City/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Correct Robin's journey" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Save correction" })).toBeNull();
    // Heavy render + async flows: flakes at the 5s default under full parallel load.
  }, 30_000);

  it("shows correction reason, editing actions and resubmit; rejected reason without payment or edit controls", async () => {
    mocks.draft = {
      id: "claim",
      partnershipId: "own",
      status: "correction_requested",
    };
    mocks.preview = { items: [], calculatedPayableEur: null };
    mocks.history = [
      {
        eventType: "correction_requested",
        reason: "Fix receipt",
        actorUserId: "host",
        occurredAt: new Date("2026-01-01"),
      },
    ];
    const { unmount } = render(
      <QueryClientProvider client={createQueryClient()}>
        <ClaimWorkspace partnershipId="own" />
      </QueryClientProvider>,
    );
    expect(
      await screen.findByText(/Correction requested: Fix receipt/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Correct the Claim data/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit Claim" })).toBeDisabled();
    unmount();
    mocks.preview = null;
    mocks.draft = { id: "claim", partnershipId: "own", status: "rejected" };
    mocks.history = [
      {
        eventType: "reopened",
        reason: "Mistaken rejection",
        actorUserId: "host",
        occurredAt: new Date("2026-01-01"),
      },
      {
        eventType: "rejected",
        reason: "Ineligible",
        actorUserId: "host",
        occurredAt: new Date("2026-01-02"),
      },
    ];
    mount();
    expect(await screen.findByText("Ineligible")).toBeInTheDocument();
    expect(screen.getByText("Mistaken rejection")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit Claim" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mark paid" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save cost" })).toBeNull();
  });

  it("does not create on open, selects payout then explicitly saves, and shows saved state", async () => {
    mount();
    expect(
      await screen.findByText(/Opening this workspace saves nothing/),
    ).toBeInTheDocument();
    expect(mocks.saveDraft).not.toHaveBeenCalled();
    expect(
      within(
        screen.getByRole("list", { name: "Submission checklist" }),
      ).getAllByRole("listitem"),
    ).toHaveLength(7);
    expect(screen.getByRole("button", { name: "Submit Claim" })).toBeDisabled();
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
        message: "hostile remote text",
        data: { reason: "JOURNEY_ALREADY_EXISTS" },
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

  it("shows all seven server checklist results, links each gap, and blocks incomplete submission", async () => {
    mocks.draft = { id: "claim", partnershipId: "own", status: "editable" };
    mocks.preview = {
      items: [
        {
          key: "payoutAccount",
          passed: false,
          gaps: [
            {
              path: ["payoutAccount"],
              message: "Select a Partner Payout Account.",
            },
          ],
        },
        {
          key: "entries",
          passed: false,
          gaps: [
            { path: ["entries"], message: "Add at least one Travel Cost Entry." },
          ],
        },
        ...[
          "entryDetails",
          "proofDocuments",
          "participations",
          "journeys",
          "fundingRules",
        ].map((key) => ({
          key,
          passed: false,
          gaps: [
            {
              path: [key],
              message: "Add a Travel Cost Entry to check this requirement.",
            },
          ],
        })),
      ],
      calculatedPayableEur: null,
    };
    mount();
    const checklist = await screen.findByRole("list", {
      name: "Submission checklist",
    });
    expect(within(checklist).getAllByRole("listitem")).toHaveLength(7);
    expect(within(checklist).getAllByRole("link")).toHaveLength(7);
    expect(
      within(checklist).getByRole("link", {
        name: /Select a Partner Payout Account/,
      }),
    ).toHaveAttribute("href", "#claim-payout");
    expect(screen.getByRole("button", { name: "Submit Claim" })).toBeDisabled();
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("links entry proof and missing participant journey gaps to their owning rows", async () => {
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
    mocks.preview = {
      items: [
        { key: "payoutAccount", passed: true, gaps: [] },
        { key: "entries", passed: true, gaps: [] },
        {
          key: "entryDetails",
          passed: false,
          gaps: [
            {
              path: ["entries", "entry", "allocations"],
              message: "Fix allocation.",
            },
          ],
        },
        {
          key: "proofDocuments",
          passed: false,
          gaps: [
            {
              path: ["entries", "entry", "proofDocuments"],
              message: "Link document.",
            },
          ],
        },
        { key: "participations", passed: true, gaps: [] },
        {
          key: "journeys",
          passed: false,
          gaps: [
            {
              path: ["participations", "person", "journey"],
              message: "Add journey.",
            },
          ],
        },
        { key: "fundingRules", passed: true, gaps: [] },
      ],
      calculatedPayableEur: null,
    };
    mount();
    expect(
      await screen.findByRole("link", { name: /Fix allocation/ }),
    ).toHaveAttribute("href", "#cost-entry");
    expect(screen.getByRole("link", { name: /Link document/ })).toHaveAttribute(
      "href",
      "#proof-entry",
    );
    expect(screen.getByRole("link", { name: /Add journey/ })).toHaveAttribute(
      "href",
      "#journey-gap-person",
    );
    expect(document.getElementById("cost-entry")).not.toBeNull();
    expect(document.getElementById("proof-entry")).not.toBeNull();
    expect(document.getElementById("journey-gap-person")).not.toBeNull();
  });

  it("shows computed preview, confirms lock before mutation, then keeps workspace read-only", async () => {
    mocks.draft = { id: "claim", partnershipId: "own", status: "editable" };
    mocks.selected = "account";
    mocks.preview = {
      items: [
        "payoutAccount",
        "entries",
        "entryDetails",
        "proofDocuments",
        "participations",
        "journeys",
        "fundingRules",
      ].map((key) => ({ key, passed: true, gaps: [] })),
      calculatedPayableEur: "726.00",
    };
    mount();
    expect(
      await screen.findByText(/Calculated payable: 726.00 EUR/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Submit Claim" }));
    expect(mocks.submit).not.toHaveBeenCalled();
    expect(screen.getByText(/submission locks the Claim/)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm submission" }),
    );
    await waitFor(() =>
      expect(mocks.submit).toHaveBeenCalledWith({ partnershipId: "own" }),
    );
    expect(
      await screen.findByText(/Claim submitted · saved/),
    ).toBeInTheDocument();
    expect(screen.getByText(/locked for Partner editing/)).toBeInTheDocument();
    expect(screen.getByLabelText("Payout Account")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save cost" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save journey" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Upload document" })).toBeNull();
  });

  it("renders a previously submitted Claim read-only on initial load", async () => {
    mocks.draft = { id: "claim", partnershipId: "own", status: "submitted" };
    mount();
    expect(
      await screen.findByText(/locked for Partner editing/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Payout Account")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Submit Claim" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save journey" })).toBeNull();
  });

  it("leaves the Claim editable when submit revalidation rejects a stale preview", async () => {
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
    mocks.draft = { id: "claim", partnershipId: "own", status: "editable" };
    mocks.preview = {
      items: [
        "payoutAccount",
        "entries",
        "entryDetails",
        "proofDocuments",
        "participations",
        "journeys",
        "fundingRules",
      ].map((key) => ({ key, passed: true, gaps: [] })),
      calculatedPayableEur: "726.00",
    };
    mocks.submit.mockImplementation(async () => {
      mocks.preview = {
        items: mocks.preview!.items.map((item) =>
          item.key === "proofDocuments"
            ? {
                key: item.key,
                passed: false,
                gaps: [
                  {
                    path: ["entries", "entry", "proofDocuments"],
                    message: "Link evidence.",
                  },
                ],
              }
            : item,
        ),
        calculatedPayableEur: null,
      };
      throw new ORPCError("BAD_REQUEST", {
        message: "Claim submission checklist is incomplete.",
      });
    });
    mount();
    await screen.findByText(/Calculated payable: 726.00 EUR/);
    await userEvent.click(screen.getByRole("button", { name: "Submit Claim" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm submission" }),
    );
    expect(
      await screen.findByText(
        "We could not complete that request. Check your details and try again.",
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: /Link evidence/ }),
    ).toHaveAttribute("href", "#proof-entry");
    expect(screen.getByRole("button", { name: "Submit Claim" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save cost" })).toBeInTheDocument();
  });

  it("creates an account from the empty state, refreshes options, and requires selection then explicit save", async () => {
    mocks.accounts = [];
    mocks.createAccount.mockRejectedValueOnce(
      new ORPCError("BAD_REQUEST", {
        data: { issues: [{ path: ["iban"], message: "Invalid IBAN checksum." }] },
      }),
    );
    mount();
    expect(
      await screen.findByText(/No Payout Accounts available/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save Claim draft" }),
    ).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Account holder"), "Example");
    await userEvent.type(screen.getByLabelText("IBAN"), "DE89370400440532013001");
    await userEvent.click(
      screen.getByRole("button", { name: "Create Payout Account" }),
    );
    expect(await screen.findByText("Invalid IBAN checksum.")).toBeInTheDocument();
    expect(screen.getByLabelText("IBAN")).toHaveValue("DE89370400440532013001");
    expect(mocks.saveDraft).not.toHaveBeenCalled();
    await userEvent.clear(screen.getByLabelText("IBAN"));
    await userEvent.type(
      screen.getByLabelText("IBAN"),
      "DE89 3704 0044 0532 0130 00",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Create Payout Account" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("option", { name: /Example/ })).toHaveValue(
        "new-account",
      ),
    );
    expect(mocks.createAccount).toHaveBeenLastCalledWith({
      partnershipId: "own",
      accountHolder: "Example",
      iban: "DE89 3704 0044 0532 0130 00",
      bic: "",
    });
    expect(
      screen.getByRole("button", { name: "Save Claim draft" }),
    ).toBeDisabled();
    expect(mocks.select).not.toHaveBeenCalled();
    await userEvent.selectOptions(
      screen.getByLabelText("Payout Account"),
      "new-account",
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save Claim draft" }),
      ).toBeEnabled(),
    );
    expect(mocks.saveDraft).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Save Claim draft" }),
    );
    await waitFor(() =>
      expect(mocks.saveDraft).toHaveBeenCalledWith({ partnershipId: "own" }),
    );
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
      await screen.findByText(/No Payout Accounts available/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Berlin → Riga/)).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Robin" })).toBeNull();
  });
});

it.each([
  [
    "oversized file",
    413,
    {
      code: "PAYLOAD_TOO_LARGE",
      reason: "PROOF_FILE_TOO_LARGE",
      error: "private token",
    },
    "Choose a Proof Document no larger than 10 MB.",
  ],
  [
    "unsupported media",
    415,
    { code: "UNSUPPORTED_MEDIA_TYPE", reason: "PROOF_MEDIA_UNSUPPORTED" },
    "Choose a PDF, JPEG, or PNG Proof Document.",
  ],
  [
    "missing Claim",
    400,
    { code: "BAD_REQUEST", reason: "CLAIM_REQUIRED_FOR_PROOF" },
    "Save an editable Claim before uploading a Proof Document.",
  ],
  [
    "locked Claim",
    400,
    { code: "BAD_REQUEST", reason: "CLAIM_NOT_EDITABLE" },
    "Claim is not editable.",
  ],
  [
    "missing selection",
    400,
    { code: "BAD_REQUEST", reason: "ACTIVE_ORGANIZATION_REQUIRED" },
    "Select an active Organization before accessing Cost Tracker data.",
  ],
  [
    "missing Membership",
    403,
    { code: "FORBIDDEN", reason: "ORGANIZATION_MEMBERSHIP_REQUIRED" },
    "Membership in the active Organization is required.",
  ],
  [
    "scoped absence",
    404,
    { code: "NOT_FOUND", reason: "PROJECT_PARTNERSHIP_NOT_FOUND" },
    "Project Partnership not found in scope.",
  ],
  [
    "missing session",
    401,
    { code: "UNAUTHORIZED", reason: "SESSION_REQUIRED" },
    "Your session is missing or has expired. Sign in to continue.",
  ],
  [
    "storage failure",
    500,
    { code: "INTERNAL_SERVER_ERROR", reason: "PROOF_UPLOAD_FAILED" },
    "Upload failed. Please try again.",
  ],
  [
    "wrong status",
    400,
    { code: "UNAUTHORIZED", reason: "SESSION_REQUIRED", error: "private token" },
    "Upload failed. Please try again.",
  ],
  [
    "wrong code",
    403,
    { code: "FORBIDDEN", reason: "PROOF_FILE_TOO_LARGE" },
    "Upload failed. Please try again.",
  ],
  [
    "hostile reason",
    400,
    { code: "BAD_REQUEST", reason: "private token" },
    "Upload failed. Please try again.",
  ],
  [
    "legacy prose",
    413,
    { error: "Choose a Proof Document no larger than 10 MB." },
    "Upload failed. Please try again.",
  ],
  [
    "malformed JSON",
    500,
    "not JSON private token",
    "Upload failed. Please try again.",
  ],
] as const)(
  "proof upload renders validated %s outcome",
  async (_name, status, body, text) => {
    mocks.draft = { id: "claim", partnershipId: "own", status: "editable" };
    const requests: FakeUploadRequest[] = [];
    class FakeUploadRequest {
      upload = { onprogress: null };
      onload: null | (() => void) = null;
      onerror = null;
      status = status;
      responseText = typeof body === "string" ? body : JSON.stringify(body);
      open = vi.fn();
      send = vi.fn();
      constructor() {
        requests.push(this);
      }
    }
    const original = globalThis.XMLHttpRequest;
    vi.stubGlobal("XMLHttpRequest", FakeUploadRequest);
    try {
      mount();
      const user = userEvent.setup();
      await user.upload(
        await screen.findByLabelText(/Upload Proof Document/),
        new File(["test"], "test.pdf", { type: "application/pdf" }),
      );
      await user.click(screen.getByRole("button", { name: "Upload document" }));
      expect(requests[0].open).toHaveBeenCalledWith(
        "POST",
        "/api/proof-documents",
      );
      expect(requests[0].send).toHaveBeenCalledOnce();
      requests[0].onload?.();
      expect(await screen.findByText(text)).toBeInTheDocument();
      expect(screen.queryByText("private token")).toBeNull();
      expect(
        screen.getByRole("button", { name: "Upload document" }),
      ).toBeEnabled();
      expect(screen.queryByText("Proof Document uploaded.")).toBeNull();
    } finally {
      vi.stubGlobal("XMLHttpRequest", original);
    }
  },
);
