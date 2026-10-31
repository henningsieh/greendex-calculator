import { ORPCError } from "@orpc/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import {
  createSafeFieldIssue,
  safeErrorResponseBody,
  situationCatalog,
  type SafeFieldIssue,
} from "@/lib/orpc/error-contract";
import {
  getHTTPErrorPresentation,
  getORPCErrorPresentation,
} from "@/lib/orpc/error-message";
import { getErrorStatus } from "@/lib/orpc/error-status";
import { createSituationErrors } from "@/lib/orpc/errors";
import { orpcQuery } from "@/lib/orpc/orpc";
import { createQueryClient } from "@/lib/tanstack-react-query/client";

vi.mock(
  "@/components/error-presentation/error-presentation",
  async (importOriginal) => {
    const original =
      await importOriginal<
        typeof import("@/components/error-presentation/error-presentation")
      >();
    return {
      ...original,
      ErrorPresentation: function ObservedErrorPresentation(
        props: ComponentProps<typeof original.ErrorPresentation>,
      ) {
        const presentation =
          props.httpStatus === undefined
            ? getORPCErrorPresentation(props.error)
            : getHTTPErrorPresentation(props.error, props.httpStatus);
        return (
          <div data-error-key={presentation.key}>
            <original.ErrorPresentation {...props} />
          </div>
        );
      },
    };
  },
);

const mocks = vi.hoisted(() => ({
  permitted: true,
  secondParticipant: false,
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
      gaps: SafeFieldIssue[];
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

vi.mock(
  "@/features/participant-onboarding/hooks/use-participant-entry-access",
  () => ({
    useParticipantEntryAccess: () => ({ permitted: mocks.permitted }),
  }),
);

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
      projects: original.orpcQuery.projects,
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
                      createSafeFieldIssue("entryRequiredForCheck", ["entries"]),
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
              ...(mocks.secondParticipant
                ? [
                    {
                      id: "person2",
                      displayName: "Alex",
                      projectId: "project",
                      representedOrganizationId: "org",
                      email: null,
                      userId: null,
                      country: null,
                    },
                  ]
                : []),
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

import { ClaimWorkspace } from "@/features/claims/components/claim-workspace";

function mount(client = createQueryClient(), locale: "en" | "de" = "en") {
  render(
    <QueryClientProvider client={client}>
      <ClaimWorkspace partnershipId="own" />
    </QueryClientProvider>,
    { locale },
  );
}

beforeEach(() => {
  mocks.permitted = true;
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
  mocks.secondParticipant = false;
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

function expectFieldError(field: HTMLElement) {
  const alert = within(field.parentElement!).getByRole("alert");
  expect(field).toHaveAttribute("aria-invalid", "true");
  expect(alert).toHaveAttribute("id");
  expect(field).toHaveAttribute("aria-describedby", alert.id);
  expect(field).toHaveAccessibleDescription();
}

describe("Claim workspace", () => {
  it("hides editing controls when the client scope check refuses an editable Claim", async () => {
    mocks.permitted = false;
    mocks.draft = { id: "claim", partnershipId: "own", status: "editable" };
    mount();
    await screen.findByTestId("costs-empty");
    expect(screen.getByTestId("claim-payout-select")).toBeDisabled();
    for (const name of [
      "Save cost",
      "Save journey",
      "Create Payout Account",
      "Submit Claim",
    ])
      expect(screen.queryByRole("button", { name })).toBeNull();
    expect(mocks.saveDraft).not.toHaveBeenCalled();
  });

  it("corrects a saved journey in editable and correction_requested, never once locked", async () => {
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
    for (const status of ["editable", "correction_requested"] as const) {
      mocks.draft = { id: "claim", partnershipId: "own", status };
      const { unmount } = render(
        <QueryClientProvider client={createQueryClient()}>
          <ClaimWorkspace partnershipId="own" />
        </QueryClientProvider>,
      );
      expect(
        await screen.findByTestId("correct-journey-person"),
      ).toBeInTheDocument();
      unmount();
    }
    for (const status of ["submitted", "approved", "rejected", "paid"] as const) {
      mocks.draft = { id: "claim", partnershipId: "own", status };
      const { unmount } = render(
        <QueryClientProvider client={createQueryClient()}>
          <ClaimWorkspace partnershipId="own" />
        </QueryClientProvider>,
      );
      await waitFor(() =>
        expect(
          document.querySelector('li[id="journey-person"]'),
        ).toBeInTheDocument(),
      );
      expect(screen.queryByTestId("correct-journey-person")).toBeNull();
      unmount();
    }
  }, 30_000);

  it("retains invalid correction input and relocks on resubmission", async () => {
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
    await waitFor(() =>
      expect(
        document.querySelector('li[id="journey-person"]'),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("correct-journey-person")).toBeNull();
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
    mount();
    await userEvent.click(await screen.findByTestId("correct-journey-person"));
    expect(screen.getByTestId("journey-correction-person-origin")).toHaveValue(
      "Berlin",
    );
    expect(
      screen.getByTestId("journey-correction-person-destination"),
    ).toHaveValue("Riga");
    expect(screen.getByTestId("journey-correction-person-type")).toHaveValue(
      "one-way",
    );
    expect(screen.getByTestId("journey-correction-person-distance")).toHaveValue(
      "800.00",
    );
    await userEvent.clear(screen.getByTestId("journey-correction-person-origin"));
    await userEvent.type(
      screen.getByTestId("journey-correction-person-destination"),
      " City",
    );
    await userEvent.selectOptions(
      screen.getByTestId("journey-correction-person-type"),
      "round-trip",
    );
    await userEvent.clear(
      screen.getByTestId("journey-correction-person-distance"),
    );
    await userEvent.type(
      screen.getByTestId("journey-correction-person-distance"),
      "bad",
    );
    await userEvent.click(screen.getByTestId("journey-correction-save"));
    expect(
      await within(
        screen.getByTestId("journey-correction-save").closest("form")!,
      ).findAllByRole("alert"),
    ).toHaveLength(2);
    expect(screen.getByTestId("journey-correction-person-distance")).toHaveValue(
      "bad",
    );
    await userEvent.type(
      screen.getByTestId("journey-correction-person-origin"),
      "Tallinn",
    );
    await userEvent.clear(
      screen.getByTestId("journey-correction-person-distance"),
    );
    await userEvent.type(
      screen.getByTestId("journey-correction-person-distance"),
      "2500",
    );
    await userEvent.click(screen.getByTestId("journey-correction-save"));
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
      expect(screen.queryByTestId("journey-correction-save")).toBeNull(),
    );
    await userEvent.click(screen.getByTestId("correct-journey-person"));
    expect(screen.getByTestId("journey-correction-person-origin")).toHaveValue(
      "Tallinn",
    );
    expect(
      screen.getByTestId("journey-correction-person-destination"),
    ).toHaveValue("Riga City");
    expect(screen.getByTestId("journey-correction-person-type")).toHaveValue(
      "round-trip",
    );
    await userEvent.click(screen.getByTestId("cancel-journey-correction"));
    expect(mocks.submit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId("claim-submit"));
    await userEvent.click(screen.getByTestId("claim-submit-confirm"));
    await waitFor(() =>
      expect(mocks.submit).toHaveBeenCalledWith({ partnershipId: "own" }),
    );
    await waitFor(() =>
      expect(
        document.querySelector('[data-draft-status="submitted"]'),
      ).toBeInTheDocument(),
    );
    expect(document.querySelector('li[id="journey-person"]')).toBeInTheDocument();
    expect(screen.queryByTestId("correct-journey-person")).toBeNull();
    expect(screen.queryByTestId("journey-correction-save")).toBeNull();
    // Heavy render + async flows: flakes at the 5s default under full parallel load.
  }, 30_000);

  it("shows correction notice, editing actions and resubmit; rejection history without payment or edit controls", async () => {
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
      await screen.findByTestId("claim-correction-notice"),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-draft-status="correction_requested"]'),
    ).toBeInTheDocument();
    expect(screen.getByTestId("cost-save")).toBeInTheDocument();
    expect(screen.getByTestId("claim-submit")).toBeDisabled();
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
    const history = await screen.findByTestId("claim-history");
    expect(within(history).getAllByRole("listitem")).toHaveLength(2);
    expect(
      history.querySelector('[data-history-event="rejected"]'),
    ).toBeInTheDocument();
    expect(
      history.querySelector('[data-history-event="reopened"]'),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-draft-status="rejected"]'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("claim-submit")).toBeNull();
    expect(screen.queryByTestId("claim-decision-markPaid")).toBeNull();
    expect(screen.queryByTestId("cost-save")).toBeNull();
  });

  it("does not create on open, selects payout then explicitly saves, and shows saved state", async () => {
    mount();
    await waitFor(() =>
      expect(
        document.querySelector('[data-draft-status="none"]'),
      ).toBeInTheDocument(),
    );
    expect(mocks.saveDraft).not.toHaveBeenCalled();
    expect(
      within(screen.getByTestId("submission-checklist")).getAllByRole("listitem"),
    ).toHaveLength(7);
    expect(screen.getByTestId("claim-submit")).toBeDisabled();
    expect(screen.getByTestId("claim-draft-save")).toBeDisabled();
    await userEvent.selectOptions(
      screen.getByTestId("claim-payout-select"),
      "account",
    );
    await waitFor(() =>
      expect(screen.getByTestId("claim-payout-select")).toHaveValue("account"),
    );
    await userEvent.click(screen.getByTestId("claim-draft-save"));
    await waitFor(() =>
      expect(
        document.querySelector('[data-draft-status="editable"]'),
      ).toBeInTheDocument(),
    );
    expect(mocks.saveDraft).toHaveBeenCalledWith({ partnershipId: "own" });
  });

  it.each(["en", "de"] as const)(
    "validates and resets Journey correction in %s",
    async (locale) => {
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
      mocks.draft = {
        id: "claim",
        partnershipId: "own",
        status: "correction_requested",
      };
      mount(createQueryClient(), locale);
      await userEvent.click(await screen.findByTestId("correct-journey-person"));
      const origin = screen.getByTestId("journey-correction-person-origin");
      const distance = screen.getByTestId("journey-correction-person-distance");
      await userEvent.clear(origin);
      await userEvent.clear(distance);
      await userEvent.click(screen.getByTestId("journey-correction-save"));
      await waitFor(() => expectFieldError(origin));
      expectFieldError(distance);
      expect(origin).toHaveFocus();
      expect(mocks.updateJourney).not.toHaveBeenCalled();
      await userEvent.click(screen.getByTestId("cancel-journey-correction"));
      await userEvent.click(screen.getByTestId("correct-journey-person"));
      expect(screen.getByTestId("journey-correction-person-origin")).toHaveValue(
        "Berlin",
      );
      expect(
        screen.getByTestId("journey-correction-person-distance"),
      ).toHaveValue("800.00");
      expect(
        screen.getByTestId("journey-correction-person-origin"),
      ).toHaveAttribute("aria-invalid", "false");
      expect(
        screen.getByTestId("journey-correction-person-origin"),
      ).not.toHaveAttribute("aria-describedby");
      mocks.updateJourney.mockRejectedValueOnce(
        createSituationErrors().journeyDistanceOutsideBands(),
      );
      const reopenedDistance = screen.getByTestId(
        "journey-correction-person-distance",
      );
      await userEvent.clear(reopenedDistance);
      await userEvent.type(reopenedDistance, "1");
      await userEvent.click(screen.getByTestId("journey-correction-save"));
      await waitFor(() => expectFieldError(reopenedDistance));
      expect(reopenedDistance).toHaveFocus();
      expect(reopenedDistance).toHaveValue("1");
    },
  );

  it("does not attach checklist-shaped or unknown server issues to correction fields", async () => {
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
    mocks.draft = {
      id: "claim",
      partnershipId: "own",
      status: "correction_requested",
    };
    mocks.updateJourney.mockRejectedValueOnce(
      new ORPCError("BAD_REQUEST", {
        data: {
          reason: "INVALID_INPUT",
          issues: [
            createSafeFieldIssue("journeyOriginRequired", [
              "participations",
              "person",
              "journey",
              "origin",
            ]),
          ],
        },
      }),
    );
    mount();
    await userEvent.click(await screen.findByTestId("correct-journey-person"));
    await userEvent.click(screen.getByTestId("journey-correction-save"));
    const form = screen.getByTestId("journey-correction-save").closest("form")!;
    expect(await within(form).findByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByTestId("journey-correction-person-origin"),
    ).toHaveAttribute("aria-invalid", "false");
    expect(
      screen.getByTestId("journey-correction-person-distance"),
    ).toHaveAttribute("aria-invalid", "false");
    mocks.updateJourney.mockRejectedValueOnce(
      new ORPCError("BAD_REQUEST", {
        data: { issues: [{ path: ["unknown"], message: "private" }] },
      }),
    );
    await userEvent.click(screen.getByTestId("journey-correction-save"));
    await waitFor(() => expect(mocks.updateJourney).toHaveBeenCalledTimes(2));
    expect(within(form).getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByTestId("journey-correction-person-origin"),
    ).toHaveAttribute("aria-invalid", "false");
    expect(
      screen.getByTestId("journey-correction-person-distance"),
    ).toHaveAttribute("aria-invalid", "false");
  });

  it.each(["en", "de"] as const)(
    "validates Journey locally in %s",
    async (locale) => {
      mount(createQueryClient(), locale);
      await userEvent.selectOptions(
        await screen.findByTestId("journey-person"),
        "person",
      );
      await userEvent.click(screen.getByTestId("journey-save"));
      await waitFor(() => expectFieldError(screen.getByTestId("journey-origin")));
      expectFieldError(screen.getByTestId("journey-distance"));
      expect(screen.getByTestId("journey-origin")).toHaveFocus();
      expect(mocks.saveJourney).not.toHaveBeenCalled();
    },
  );

  it.each(["en", "de"] as const)(
    "shows actionable missing Participation in %s",
    async (locale) => {
      mount(createQueryClient(), locale);
      await userEvent.click(await screen.findByTestId("journey-save"));
      const person = screen.getByTestId("journey-person");
      expect(person).toHaveFocus();
      expectFieldError(person);
      expect(mocks.saveJourney).not.toHaveBeenCalled();
    },
  );

  it("saves valid Journey values and resets the editor", async () => {
    mocks.saveJourney.mockResolvedValue({ id: "journey" });
    mount();
    await userEvent.selectOptions(
      await screen.findByTestId("journey-person"),
      "person",
    );
    await userEvent.type(screen.getByTestId("journey-origin"), "Berlin");
    await userEvent.type(
      document.getElementById("journey-destination")!,
      "Paris",
    );
    await userEvent.type(screen.getByTestId("journey-distance"), "100");
    await userEvent.click(screen.getByTestId("journey-save"));
    await waitFor(() =>
      expect(mocks.saveJourney).toHaveBeenCalledWith({
        partnershipId: "own",
        projectParticipantId: "person",
        origin: "Berlin",
        destination: "Paris",
        tripType: "one-way",
        erasmusDistanceKm: "100",
      }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("journey-origin")).toHaveValue(""),
    );
    expect(screen.getByTestId("journey-person")).toHaveValue("");
    expect(screen.getByTestId("journey-distance")).toHaveValue("");
  });

  it("retains invalid journey fields and safely rejects unidentified field errors while costs are saved independently", async () => {
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
    await screen.findByTestId("costs-empty");
    await userEvent.selectOptions(screen.getByTestId("journey-person"), "person");
    await userEvent.type(screen.getByTestId("journey-origin"), "Mars");
    await userEvent.type(
      document.getElementById("journey-destination")!,
      "Venus",
    );
    await userEvent.type(screen.getByTestId("journey-distance"), "10");
    await userEvent.click(screen.getByTestId("journey-save"));
    expect(
      await within(
        screen.getByTestId("journey-save").closest("form")!,
      ).findByRole("alert"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("journey-distance").parentElement!).queryByRole(
        "alert",
      ),
    ).toBeNull();
    expect(screen.getByTestId("journey-origin")).toHaveValue("Mars");
    expect(screen.getByTestId("journey-distance")).toHaveValue("10");
    await userEvent.type(screen.getByTestId("cost-amount"), "10.00");
    await userEvent.click(screen.getByTestId("cost-participation-person"));
    await userEvent.click(screen.getByTestId("cost-save"));
    await waitFor(() =>
      expect(mocks.saveCost).toHaveBeenCalledWith(
        expect.objectContaining({
          partnershipId: "own",
          allocations: [{ projectParticipantId: "person" }],
        }),
      ),
    );
    expect(screen.getByTestId("journey-origin")).toHaveValue("Mars");
  });

  it.each(["en", "de"] as const)(
    "associates validated distance corrections with their field in %s",
    async (locale) => {
      mocks.saveJourney.mockRejectedValue(
        createSituationErrors().journeyDistanceOutsideBands(),
      );
      mount(createQueryClient(), locale);
      await userEvent.selectOptions(
        await screen.findByTestId("journey-person"),
        "person",
      );
      await userEvent.type(screen.getByTestId("journey-origin"), "Berlin");
      await userEvent.type(
        document.getElementById("journey-destination")!,
        "Paris",
      );
      await userEvent.type(screen.getByTestId("journey-distance"), "1");
      await userEvent.click(screen.getByTestId("journey-save"));
      expect(
        await within(
          screen.getByTestId("journey-distance").parentElement!,
        ).findByRole("alert"),
      ).toBeInTheDocument();
      expect(
        within(screen.getByTestId("journey-origin").parentElement!).queryByRole(
          "alert",
        ),
      ).toBeNull();
      expect(screen.getByTestId("journey-origin")).toHaveValue("Berlin");
      expect(screen.getByTestId("journey-distance")).toHaveValue("1");
      expect(screen.getByTestId("journey-distance")).toHaveFocus();
      expectFieldError(screen.getByTestId("journey-distance"));
    },
  );

  it("surfaces the server one-journey rule at Participation without clearing the form", async () => {
    mocks.saveJourney.mockRejectedValue(
      createSituationErrors().journeyAlreadyExists(),
    );
    mount();
    expect(
      within(await screen.findByTestId("journey-gaps")).getByRole("listitem"),
    ).toHaveAttribute("id", "journey-gap-person");
    await userEvent.selectOptions(screen.getByTestId("journey-person"), "person");
    await userEvent.type(screen.getByTestId("journey-origin"), "Berlin");
    await userEvent.type(
      document.getElementById("journey-destination")!,
      "Paris",
    );
    await userEvent.type(screen.getByTestId("journey-distance"), "10");
    await userEvent.click(screen.getByTestId("journey-save"));
    const feedback = await within(
      screen.getByTestId("journey-person").parentElement!,
    ).findByRole("alert");
    expect(feedback.querySelector("[data-error-key]")).toHaveAttribute(
      "data-error-key",
      "JOURNEY_ALREADY_EXISTS",
    );
    expect(screen.getByTestId("journey-origin")).toHaveValue("Berlin");
  });

  it("validates incomplete shares locally without clearing the cost", async () => {
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
    await screen.findByTestId("costs-empty");
    await userEvent.selectOptions(
      screen.getByTestId("cost-method"),
      "percentage",
    );
    await userEvent.click(screen.getByTestId("cost-participation-person"));
    await userEvent.type(screen.getByTestId("cost-share-person"), "35.5");
    expect(document.querySelector("[data-share-total]")).toHaveAttribute(
      "data-share-total",
      "35.500000",
    );
    await userEvent.click(screen.getByTestId("cost-save"));
    expect((await screen.findAllByRole("alert")).length).toBeGreaterThan(0);
    expect(mocks.saveCost).not.toHaveBeenCalled();
    expect(screen.getByTestId("cost-share-person")).toHaveValue("35.5");
  });

  it.each([
    [
      "en",
      "Use positive exact shares of the chosen method that total the entry amount (or 100%).",
    ],
    [
      "de",
      "Verwende positive, genaue Anteile der gewählten Methode, die den Eintragsbetrag oder 100 % ergeben.",
    ],
  ] as const)(
    "shows localized row and total errors and retains values in %s",
    async (locale, message) => {
      mocks.draft = { id: "claim", partnershipId: "own", status: "editable" };
      mount(createQueryClient(), locale);
      await screen.findByTestId("costs-empty");
      await userEvent.type(screen.getByTestId("cost-amount"), "10");
      await userEvent.selectOptions(
        screen.getByTestId("cost-method"),
        "percentage",
      );
      await userEvent.click(screen.getByTestId("cost-participation-person"));
      await userEvent.type(screen.getByTestId("cost-share-person"), "abc");
      await userEvent.click(screen.getByTestId("cost-save"));
      expect(await screen.findAllByText(message)).toHaveLength(2);
      expect(screen.getByTestId("cost-share-person")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      expect(mocks.saveCost).not.toHaveBeenCalled();
      await userEvent.clear(screen.getByTestId("cost-share-person"));
      await userEvent.type(screen.getByTestId("cost-share-person"), "100");
      await userEvent.selectOptions(screen.getByTestId("cost-method"), "amount");
      expect(screen.getByTestId("cost-share-person")).toHaveValue("100");
      await userEvent.selectOptions(
        screen.getByTestId("cost-method"),
        "percentage",
      );
      expect(screen.getByTestId("cost-share-person")).toHaveValue("100");
      expect(document.querySelector("[data-share-total]")).toHaveAttribute(
        "data-share-total",
        "100.000000",
      );
    },
  );

  it("drops deselected shares and does not move row errors to another participant", async () => {
    mocks.draft = { id: "claim", partnershipId: "own", status: "editable" };
    mocks.secondParticipant = true;
    mount();
    await screen.findByTestId("costs-empty");
    await userEvent.type(screen.getByTestId("cost-amount"), "10");
    await userEvent.selectOptions(
      screen.getByTestId("cost-method"),
      "percentage",
    );
    await userEvent.click(screen.getByTestId("cost-participation-person"));
    await userEvent.click(screen.getByTestId("cost-participation-person2"));
    await userEvent.type(screen.getByTestId("cost-share-person"), "bad");
    await userEvent.type(screen.getByTestId("cost-share-person2"), "100");
    await userEvent.click(screen.getByTestId("cost-save"));
    expect(screen.getByTestId("cost-share-person")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await userEvent.click(screen.getByTestId("cost-participation-person"));
    await waitFor(() =>
      expect(screen.getByTestId("cost-share-person2")).toHaveAttribute(
        "aria-invalid",
        "false",
      ),
    );
    await userEvent.click(screen.getByTestId("cost-participation-person"));
    expect(screen.getByTestId("cost-share-person")).toHaveValue("");
    await userEvent.selectOptions(screen.getByTestId("cost-method"), "equal");
    await userEvent.selectOptions(
      screen.getByTestId("cost-method"),
      "percentage",
    );
    expect(screen.getByTestId("cost-share-person2")).toHaveValue("");
  });

  it("editing another entry resets the cost form", async () => {
    mocks.draft = { id: "claim", partnershipId: "own", status: "editable" };
    mocks.costs = ["first", "second"].map((id, index) => ({
      id,
      amountEur: index ? "20.00" : "10.00",
      transportProfile: "train",
      allocationMethod: "equal",
      allocations: [
        {
          projectParticipantId: "person",
          amountEur: index ? "20.00" : "10.00",
          percentage: null,
        },
      ],
      proofDocumentIds: [],
    }));
    mount();
    const buttons = await screen.findAllByRole("button", { name: /edit/i });
    await userEvent.click(buttons[0]);
    expect(screen.getByTestId("cost-amount")).toHaveValue("10.00");
    await userEvent.selectOptions(
      screen.getByTestId("cost-method"),
      "percentage",
    );
    await userEvent.type(screen.getByTestId("cost-share-person"), "invalid");
    await userEvent.click(screen.getByTestId("cost-save"));
    await userEvent.click(buttons[1]);
    expect(screen.getByTestId("cost-amount")).toHaveValue("20.00");
    expect(screen.getByTestId("cost-method")).toHaveValue("equal");
    expect(screen.queryByTestId("cost-share-person")).toBeNull();
  });

  it("maps a server refusal to the share and keeps the submitted values", async () => {
    mocks.draft = { id: "claim", partnershipId: "own", status: "editable" };
    mocks.saveCost.mockRejectedValue(
      new ORPCError("BAD_REQUEST", {
        data: {
          reason: "INVALID_INPUT",
          issues: [
            createSafeFieldIssue("allocationSharesInvalid", [
              "allocations",
              0,
              "percentage",
            ]),
          ],
        },
      }),
    );
    mount();
    await screen.findByTestId("costs-empty");
    await userEvent.type(screen.getByTestId("cost-amount"), "10");
    await userEvent.selectOptions(
      screen.getByTestId("cost-method"),
      "percentage",
    );
    await userEvent.click(screen.getByTestId("cost-participation-person"));
    await userEvent.type(screen.getByTestId("cost-share-person"), "100");
    await userEvent.click(screen.getByTestId("cost-save"));
    await waitFor(() =>
      expectFieldError(screen.getByTestId("cost-share-person")),
    );
    expect(screen.getByTestId("cost-share-person")).toHaveValue("100");
    expect(screen.getByTestId("cost-amount")).toHaveValue("10");
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
      await waitFor(() =>
        expect(
          within(document.getElementById("claim-proofs")!).getAllByRole(
            "listitem",
          ),
        ).toHaveLength(1),
      );
      const picker = screen.getByTestId("link-proof-entry");
      expect(within(picker).getByTestId("proof-option-proof")).toHaveValue(
        "proof",
      );
      expect(within(picker).queryByTestId("proof-option-foreign")).toBeNull();
      await userEvent.selectOptions(picker, "proof");
      await waitFor(() =>
        expect(mocks.link).toHaveBeenCalledWith({
          partnershipId: "own",
          entryId: "entry",
          proofDocumentId: "proof",
        }),
      );
      await userEvent.upload(
        screen.getByTestId("proof-file"),
        new File(["test"], "test.pdf", { type: "application/pdf" }),
      );
      await userEvent.click(screen.getByTestId("proof-upload"));
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
        expect(screen.getByRole("progressbar")).toHaveValue(100),
      );
      expect(
        within(document.getElementById("claim-proofs")!).getByTestId(
          "proof-feedback",
        ),
      ).toBeInTheDocument();
      expect(screen.getByTestId("proof-upload")).toBeEnabled();
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
            createSafeFieldIssue("payoutAccountRequired", ["payoutAccount"]),
          ],
        },
        {
          key: "entries",
          passed: false,
          gaps: [createSafeFieldIssue("entryRequired", ["entries"])],
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
          gaps: [createSafeFieldIssue("entryRequiredForCheck", ["entries"])],
        })),
      ],
      calculatedPayableEur: null,
    };
    mount();
    const checklist = await screen.findByTestId("submission-checklist");
    expect(within(checklist).getAllByRole("listitem")).toHaveLength(7);
    expect(within(checklist).getAllByRole("link")).toHaveLength(7);
    expect(
      within(checklist).getByTestId("submission-gap-payoutAccount"),
    ).toHaveAttribute("href", "#claim-payout");
    expect(screen.getByTestId("claim-submit")).toBeDisabled();
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
            createSafeFieldIssue("allocationSharesInvalid", [
              "entries",
              "entry",
              "allocations",
            ]),
          ],
        },
        {
          key: "proofDocuments",
          passed: false,
          gaps: [
            createSafeFieldIssue("proofDocumentRequired", [
              "entries",
              "entry",
              "proofDocuments",
            ]),
          ],
        },
        { key: "participations", passed: true, gaps: [] },
        {
          key: "journeys",
          passed: false,
          gaps: [
            createSafeFieldIssue("journeyRequired", [
              "participations",
              "person",
              "journey",
            ]),
          ],
        },
        { key: "fundingRules", passed: true, gaps: [] },
      ],
      calculatedPayableEur: null,
    };
    mount();
    expect(
      await screen.findByTestId("submission-gap-entries-entry-allocations"),
    ).toHaveAttribute("href", "#cost-entry");
    expect(
      screen.getByTestId("submission-gap-entries-entry-proofDocuments"),
    ).toHaveAttribute("href", "#proof-entry");
    expect(
      screen.getByTestId("submission-gap-participations-person-journey"),
    ).toHaveAttribute("href", "#journey-gap-person");
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
    const client = createQueryClient();
    const project = {
      queryKey: orpcQuery.projects.get.queryKey({
        input: { projectId: "project" },
      }),
      queryFn: async () => mocks.draft?.status,
    };
    expect(await client.query(project)).toBe("editable");
    mount(client);
    expect(await screen.findByTestId("calculated-payable")).toHaveAttribute(
      "data-payable",
      "726.00",
    );
    await userEvent.click(screen.getByTestId("claim-submit"));
    expect(mocks.submit).not.toHaveBeenCalled();
    expect(
      within(screen.getByTestId("claim-submission")).getByRole("alert"),
    ).toContainElement(screen.getByTestId("claim-submit-confirm"));
    await userEvent.click(screen.getByTestId("claim-submit-confirm"));
    await waitFor(() =>
      expect(mocks.submit).toHaveBeenCalledWith({ partnershipId: "own" }),
    );
    await waitFor(() =>
      expect(
        document.querySelector('[data-draft-status="submitted"]'),
      ).toBeInTheDocument(),
    );
    expect(await client.query(project)).toBe("submitted");
    expect(screen.getByTestId("claim-locked")).toBeInTheDocument();
    expect(screen.getByTestId("claim-payout-select")).toBeDisabled();
    expect(screen.queryByTestId("cost-save")).toBeNull();
    expect(screen.queryByTestId("journey-save")).toBeNull();
    expect(screen.queryByTestId("proof-upload")).toBeNull();
  });

  it("renders a previously submitted Claim read-only on initial load", async () => {
    mocks.draft = { id: "claim", partnershipId: "own", status: "submitted" };
    mount();
    expect(await screen.findByTestId("claim-locked")).toBeInTheDocument();
    expect(screen.getByTestId("claim-payout-select")).toBeDisabled();
    expect(screen.queryByTestId("claim-submit")).toBeNull();
    expect(screen.queryByTestId("journey-save")).toBeNull();
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
                  createSafeFieldIssue("proofDocumentRequired", [
                    "entries",
                    "entry",
                    "proofDocuments",
                  ]),
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
    expect(await screen.findByTestId("calculated-payable")).toHaveAttribute(
      "data-payable",
      "726.00",
    );
    await userEvent.click(screen.getByTestId("claim-submit"));
    await userEvent.click(screen.getByTestId("claim-submit-confirm"));
    expect(
      await within(screen.getByTestId("claim-submission")).findByRole("alert"),
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId("submission-gap-entries-entry-proofDocuments"),
    ).toHaveAttribute("href", "#proof-entry");
    expect(screen.getByTestId("claim-submit")).toBeDisabled();
    expect(screen.getByTestId("cost-save")).toBeInTheDocument();
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
      await screen.findByTestId("payout-account-create"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("claim-payout-select")).toBeNull();
    expect(screen.getByTestId("claim-draft-save")).toBeDisabled();
    await userEvent.type(screen.getByTestId("account-holder"), "Example");
    await userEvent.type(
      screen.getByTestId("account-iban"),
      "DE89370400440532013001",
    );
    await userEvent.click(screen.getByTestId("payout-account-create"));
    expect(
      await within(
        screen.getByTestId("account-iban").closest("form")!,
      ).findByRole("alert"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("account-iban")).toHaveValue(
      "DE89370400440532013001",
    );
    expect(mocks.saveDraft).not.toHaveBeenCalled();
    await userEvent.clear(screen.getByTestId("account-iban"));
    await userEvent.type(
      screen.getByTestId("account-iban"),
      "DE89 3704 0044 0532 0130 00",
    );
    await userEvent.click(screen.getByTestId("payout-account-create"));
    await waitFor(() =>
      expect(screen.getByTestId("payout-option-new-account")).toHaveValue(
        "new-account",
      ),
    );
    expect(mocks.createAccount).toHaveBeenLastCalledWith({
      partnershipId: "own",
      accountHolder: "Example",
      iban: "DE89 3704 0044 0532 0130 00",
      bic: "",
    });
    expect(screen.getByTestId("claim-draft-save")).toBeDisabled();
    expect(mocks.select).not.toHaveBeenCalled();
    await userEvent.selectOptions(
      screen.getByTestId("claim-payout-select"),
      "new-account",
    );
    await waitFor(() =>
      expect(screen.getByTestId("claim-draft-save")).toBeEnabled(),
    );
    expect(mocks.saveDraft).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId("claim-draft-save"));
    await waitFor(() =>
      expect(mocks.saveDraft).toHaveBeenCalledWith({ partnershipId: "own" }),
    );
  }, 30_000);

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
      await screen.findByTestId("payout-account-create"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("claim-payout-select")).toBeNull();
    expect(document.querySelector('li[id="journey-person"]')).toBeInTheDocument();
    expect(screen.queryByTestId("journey-option-person")).toBeNull();
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
  ],
  [
    "unsupported media",
    415,
    { code: "UNSUPPORTED_MEDIA_TYPE", reason: "PROOF_MEDIA_UNSUPPORTED" },
  ],
  [
    "missing Claim",
    400,
    { code: "BAD_REQUEST", reason: "CLAIM_REQUIRED_FOR_PROOF" },
  ],
  [
    "locked Claim",
    getErrorStatus(situationCatalog.claimNotEditable.code),
    safeErrorResponseBody(situationCatalog.claimNotEditable),
  ],
  [
    "missing selection",
    400,
    { code: "BAD_REQUEST", reason: "ACTIVE_ORGANIZATION_REQUIRED" },
  ],
  [
    "missing Membership",
    403,
    { code: "FORBIDDEN", reason: "ORGANIZATION_MEMBERSHIP_REQUIRED" },
  ],
  [
    "scoped absence",
    404,
    { code: "NOT_FOUND", reason: "PROJECT_PARTNERSHIP_NOT_FOUND" },
  ],
  ["missing session", 401, { code: "UNAUTHORIZED", reason: "SESSION_REQUIRED" }],
  [
    "storage failure",
    500,
    { code: "INTERNAL_SERVER_ERROR", reason: "PROOF_UPLOAD_FAILED" },
  ],
  [
    "wrong status",
    400,
    { code: "UNAUTHORIZED", reason: "SESSION_REQUIRED", error: "private token" },
  ],
  ["wrong code", 403, { code: "FORBIDDEN", reason: "PROOF_FILE_TOO_LARGE" }],
  ["hostile reason", 400, { code: "BAD_REQUEST", reason: "private token" }],
  [
    "legacy prose",
    413,
    { error: "Choose a Proof Document no larger than 10 MB." },
  ],
  ["malformed JSON", 500, "not JSON private token"],
] as const)(
  "keeps failed %s uploads retryable without refreshing Claim data",
  async (_name, status, body) => {
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
      const client = createQueryClient();
      const invalidate = vi.spyOn(client, "invalidateQueries");
      mount(client);
      const user = userEvent.setup();
      await user.upload(
        await screen.findByTestId("proof-file"),
        new File(["test"], "test.pdf", { type: "application/pdf" }),
      );
      await user.click(screen.getByTestId("proof-upload"));
      expect(requests[0].open).toHaveBeenCalledWith(
        "POST",
        "/api/proof-documents",
      );
      expect(requests[0].send).toHaveBeenCalledOnce();
      requests[0].onload?.();
      const feedback = await within(
        document.getElementById("claim-proofs")!,
      ).findByTestId("proof-feedback");
      expect(feedback).toBeInTheDocument();
      if (_name === "locked Claim")
        expect(feedback.querySelector("[data-error-key]")).toHaveAttribute(
          "data-error-key",
          "CLAIM_NOT_EDITABLE",
        );
      expect(invalidate).not.toHaveBeenCalled();
      expect(screen.getByTestId("proof-upload")).toBeEnabled();
      expect(screen.getByRole("progressbar")).toHaveValue(0);
      expect(screen.getByTestId("proof-file")).toHaveProperty("files.length", 1);
    } finally {
      vi.stubGlobal("XMLHttpRequest", original);
    }
  },
);
