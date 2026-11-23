import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import { Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import type { ProjectListState } from "@/features/projects/list-query-options";
import messagesDe from "@/messages/de";
import messagesEn from "@/messages/en-GB";
import messagesSi from "@/messages/sl";

const mocks = vi.hoisted(() => ({
  availableScopes: { hosted: true, partner: false },
  getListOptions: vi.fn(),
  toastAdd: vi.fn(),
}));

vi.mock("@/components/ui/toast", () => ({
  toast: { add: mocks.toastAdd },
}));
vi.mock("@/features/projects/list-query-options", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  getProjectAvailableScopesQueryOptions: () => ({
    queryKey: ["projects", "available-scopes"],
    queryFn: async () => mocks.availableScopes,
  }),
  getProjectListQueryOptions: mocks.getListOptions.mockImplementation(
    (scope: "hosted" | "partner", state: { cursor?: string }) => {
      // URL-state tests use resolved data. Real asynchronous row ordering is
      // covered by projects.spec.ts; two suspense consumers of an empty mock
      // otherwise repeatedly remount while the testing adapter updates.
      const data = {
        scope,
        rows: [],
        previousCursor: state.cursor ? "previous-page" : undefined,
        nextCursor: "next-page",
        metrics: {
          whole: {
            projectCount: 0,
            partnerOrganizationCount: 0,
          },
          filtered: {
            projectCount: 0,
            partnerOrganizationCount: 0,
          },
        },
        partnerOptions: [],
      };
      return {
        staleTime: Infinity,
        queryKey: ["projects", scope, state],
        initialData: data,
        queryFn: async () => data,
      };
    },
  ),
  getProjectPartnerFilterQueryOptions: (state: ProjectListState) =>
    mocks.getListOptions("hosted", {
      ...state,
      partnerOrganizationIds: [],
      cursor: undefined,
    }),
}));

import { ProjectList } from "@/features/projects/components/project-list";

function renderList(
  {
    onUrlUpdate,
    searchParams = "?scope=partner&cursor=partner-cursor",
    hasStaffMembership = true,
  }: {
    onUrlUpdate: (event: UrlUpdateEvent) => void;
    searchParams?: string;
    hasStaffMembership?: boolean;
  },
  locale: "en-GB" | "de" | "sl" = "en-GB",
) {
  window.history.replaceState({}, "", `/projects${searchParams}`);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <NuqsTestingAdapter
      hasMemory
      onUrlUpdate={(event) => {
        window.history.replaceState({}, "", `/projects${event.queryString}`);
        onUrlUpdate(event);
      }}
      searchParams={searchParams}
    >
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<p>Loading Projects</p>}>
          <ProjectList
            hasStaffMembership={hasStaffMembership}
            preference={{ accountKey: "test", visibility: {} }}
          />
        </Suspense>
      </QueryClientProvider>
    </NuqsTestingAdapter>,
    { locale },
  );
}

describe("Project list Nuqs URL state", { timeout: 10_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.availableScopes = { hosted: true, partner: false };
  });

  it("replaces an unavailable Partner URL before creating the Hosted query", async () => {
    const onUrlUpdate = vi.fn();
    renderList({ onUrlUpdate });

    await screen.findByTestId("project-scope-hosted", {}, { timeout: 10_000 });

    expect(mocks.getListOptions).toHaveBeenCalledWith(
      "hosted",
      expect.objectContaining({ cursor: undefined }),
    );
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalledOnce());
    const update = onUrlUpdate.mock.calls[0]?.[0] as UrlUpdateEvent;
    expect(update.options.history).toBe("replace");
    expect(update.searchParams.get("scope")).toBe("hosted");
    expect(update.searchParams.has("cursor")).toBe(false);
    expect(mocks.toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ type: "info" }),
    );
  });

  it("drops a cursor from another format version, rewrites the URL and explains it", async () => {
    const onUrlUpdate = vi.fn();
    const staleCursor = Buffer.from(
      JSON.stringify({ version: 4, id: "project-1" }),
      "utf8",
    ).toString("base64url");

    renderList({
      onUrlUpdate,
      searchParams: `?scope=hosted&cursor=${staleCursor}`,
    });

    expect(await screen.findByTestId("project-list")).toBeTruthy();
    // The stale cursor never reaches the query.
    expect(mocks.getListOptions).toHaveBeenCalledWith(
      "hosted",
      expect.objectContaining({ cursor: undefined }),
    );
    await waitFor(() =>
      expect(mocks.toastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error" }),
      ),
    );
    const update = onUrlUpdate.mock.calls[0]?.[0] as UrlUpdateEvent;
    expect(update.options.history).toBe("replace");
    expect(update.searchParams.has("cursor")).toBe(false);
  });

  it("renders the guidance Empty without tabs when a staff member has no available scope", async () => {
    const onUrlUpdate = vi.fn();
    mocks.availableScopes = { hosted: false, partner: false };

    renderList({ onUrlUpdate, hasStaffMembership: true });

    expect(await screen.findByTestId("projects-empty")).toBeTruthy();
    expect(screen.queryByTestId("projects-unavailable")).toBeNull();
    expect(screen.queryByTestId("project-scope-hosted")).toBeNull();
    expect(screen.queryByTestId("project-scope-partner")).toBeNull();
    expect(mocks.getListOptions).not.toHaveBeenCalled();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it("keeps the unavailable Empty without tabs for a participant without staff standing", async () => {
    const onUrlUpdate = vi.fn();
    mocks.availableScopes = { hosted: false, partner: false };

    renderList({ onUrlUpdate, hasStaffMembership: false });

    expect(await screen.findByTestId("projects-unavailable")).toBeTruthy();
    expect(screen.queryByTestId("projects-empty")).toBeNull();
    expect(screen.queryByTestId("project-scope-hosted")).toBeNull();
    expect(screen.queryByTestId("project-scope-partner")).toBeNull();
    expect(mocks.getListOptions).not.toHaveBeenCalled();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it("writes server-provided cursors to the URL without using browser history", async () => {
    const onUrlUpdate = vi.fn();
    const browserBack = vi.spyOn(window.history, "back");
    renderList({
      onUrlUpdate,
      searchParams: "?scope=hosted&cursor=direct-page-two",
    });

    fireEvent.click(
      await screen.findByTestId("previous-project-page", {}, { timeout: 10_000 }),
    );

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalledOnce());
    const update = onUrlUpdate.mock.calls[0]?.[0] as UrlUpdateEvent;
    expect(update.options.history).toBe("push");
    expect(update.searchParams.get("cursor")).toBe("previous-page");

    fireEvent.click(screen.getByTestId("next-project-page"));
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalledTimes(2));
    const nextUpdate = onUrlUpdate.mock.calls[1]?.[0] as UrlUpdateEvent;
    expect(nextUpdate.options.history).toBe("push");
    expect(nextUpdate.searchParams.get("cursor")).toBe("next-page");
    expect(browserBack).not.toHaveBeenCalled();
  });

  it.each(["hosted", "partner"] as const)(
    "keeps a valid %s URL unchanged",
    async (scope) => {
      const onUrlUpdate = vi.fn();
      mocks.availableScopes = { hosted: true, partner: true };
      renderList({
        onUrlUpdate,
        searchParams: `?scope=${scope}&cursor=${scope}-cursor`,
      });

      await screen.findByTestId("project-scope-hosted", {}, { timeout: 10_000 });

      expect(mocks.getListOptions).toHaveBeenCalledWith(
        scope,
        expect.objectContaining({ cursor: `${scope}-cursor` }),
      );
      expect(onUrlUpdate).not.toHaveBeenCalled();
      expect(mocks.toastAdd).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["startDate", "endDate", "name", "status"],
    ["status", "name", "endDate", "startDate"],
  ])(
    "preserves and toggles every sort priority through real URL state: %s",
    async (...fields) => {
      const user = userEvent.setup();
      const onUrlUpdate = vi.fn();
      const sort = fields.map((field) => ({ field, direction: "desc" }));
      const testIds: Record<string, string> = {
        startDate: "start",
        endDate: "end",
        name: "name",
        status: "status",
      };
      renderList({
        onUrlUpdate,
        searchParams: `?scope=hosted&sort=${encodeURIComponent(JSON.stringify(sort))}`,
      });
      for (const [index, field] of fields.entries()) {
        await user.click(
          await screen.findByTestId(`sort-project-${testIds[field]}`),
        );
        sort[index] = { field, direction: "asc" };
        await waitFor(() => {
          const update = onUrlUpdate.mock.calls.at(-1)?.[0] as UrlUpdateEvent;
          expect(JSON.parse(update?.searchParams.get("sort") ?? "null")).toEqual(
            sort,
          );
        });
        expect(mocks.getListOptions).toHaveBeenLastCalledWith(
          "hosted",
          expect.objectContaining({ sort }),
        );
      }
    },
  );

  it("edits and resets the complete ordered sorting", async () => {
    const user = userEvent.setup();
    const onUrlUpdate = vi.fn();
    const sort = [
      { field: "startDate", direction: "desc" },
      { field: "endDate", direction: "desc" },
    ];
    renderList({
      onUrlUpdate,
      searchParams: `?scope=hosted&sort=${encodeURIComponent(JSON.stringify(sort))}`,
    });
    await user.click(await screen.findByTestId("project-sort-menu"));
    await user.click(screen.getByTestId("project-sort-up-endDate"));
    await waitFor(() =>
      expect(
        JSON.parse(
          onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get("sort") ?? "null",
        ),
      ).toEqual([sort[1], sort[0]]),
    );
    await user.click(screen.getByTestId("project-sort-direction-endDate"));
    await waitFor(() =>
      expect(
        JSON.parse(
          onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get("sort") ?? "null",
        ),
      ).toEqual([{ field: "endDate", direction: "asc" }, sort[0]]),
    );
    await user.click(screen.getByTestId("project-sort-remove-startDate"));
    await waitFor(() =>
      expect(
        JSON.parse(
          onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get("sort") ?? "null",
        ),
      ).toEqual([{ field: "endDate", direction: "asc" }]),
    );
    expect(screen.getByTestId("project-sort-remove-endDate")).toBeDisabled();
    await user.click(screen.getByTestId("project-sort-reset"));
    await waitFor(() =>
      expect(onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.has("sort")).toBe(
        false,
      ),
    );
  });

  it.each([
    { locale: "en-GB", messages: messagesEn },
    { locale: "de", messages: messagesDe },
    { locale: "sl", messages: messagesSi },
  ] as const)(
    "commits the selected sort option to the URL (%s)",
    async ({ locale }) => {
      const user = userEvent.setup();
      const onUrlUpdate = vi.fn();
      mocks.availableScopes = { hosted: true, partner: true };
      renderList({ onUrlUpdate, searchParams: "?scope=hosted" }, locale);

      await user.click(
        await screen.findByTestId("sort-project-start", {}, { timeout: 10_000 }),
      );

      await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
      const update = onUrlUpdate.mock.calls.at(-1)?.[0] as UrlUpdateEvent;
      expect(update.options.history).toBe("push");
      expect(JSON.parse(update.searchParams.get("sort") ?? "null")).toEqual([
        { field: "status", direction: "asc" },
        { field: "startDate", direction: "desc" },
      ]);
    },
  );

  it("passes the default Status selection without writing it to the URL", async () => {
    const onUrlUpdate = vi.fn();
    renderList({
      onUrlUpdate,
      searchParams: "?scope=hosted&cursor=page-two",
    });

    await screen.findByTestId("project-status-filter", {}, { timeout: 10_000 });
    expect(mocks.getListOptions).toHaveBeenLastCalledWith(
      "hosted",
      expect.objectContaining({ status: ["open", "ready"] }),
    );
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it("writes a repeated Status selection and resets the cursor", async () => {
    const user = userEvent.setup();
    const onUrlUpdate = vi.fn();
    renderList({
      onUrlUpdate,
      searchParams: "?scope=hosted&cursor=page-two",
    });

    await user.click(
      await screen.findByTestId("project-status-filter", {}, { timeout: 10_000 }),
    );
    expect(await screen.findByTestId("project-status-open")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByTestId("project-status-ready")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByTestId("project-status-archived")).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await user.click(screen.getByTestId("project-status-archived"));

    await waitFor(() => {
      const update = onUrlUpdate.mock.calls.at(-1)?.[0] as UrlUpdateEvent;
      expect(update.searchParams.getAll("status")).toEqual([
        "open",
        "ready",
        "archived",
      ]);
      expect(update.searchParams.has("cursor")).toBe(false);
    });
    expect(mocks.getListOptions).toHaveBeenLastCalledWith(
      "hosted",
      expect.objectContaining({
        status: ["open", "ready", "archived"],
        cursor: undefined,
      }),
    );
  });

  it("canonicalizes clearing every Status or choosing All to the full selection", async () => {
    const user = userEvent.setup();
    const onUrlUpdate = vi.fn();
    renderList({ onUrlUpdate, searchParams: "?scope=hosted" });

    await user.click(
      await screen.findByTestId("project-status-filter", {}, { timeout: 10_000 }),
    );
    await user.click(
      await screen.findByTestId("project-status-open", {}, { timeout: 10_000 }),
    );
    await user.click(screen.getByTestId("project-status-ready"));

    // Unchecking the last value means "everything", not "nothing".
    await waitFor(() => {
      const update = onUrlUpdate.mock.calls.at(-1)?.[0] as UrlUpdateEvent;
      expect(update.searchParams.getAll("status")).toEqual([
        "open",
        "ready",
        "archived",
      ]);
    });
    expect(mocks.getListOptions).toHaveBeenLastCalledWith(
      "hosted",
      expect.objectContaining({ status: ["open", "ready", "archived"] }),
    );

    await user.click(screen.getByTestId("project-status-open"));
    await waitFor(() =>
      expect(mocks.getListOptions).toHaveBeenLastCalledWith(
        "hosted",
        expect.objectContaining({ status: ["ready", "archived"] }),
      ),
    );

    await user.click(screen.getByTestId("project-status-all"));
    await waitFor(() => {
      const update = onUrlUpdate.mock.calls.at(-1)?.[0] as UrlUpdateEvent;
      expect(update.searchParams.getAll("status")).toEqual([
        "open",
        "ready",
        "archived",
      ]);
    });
  });
});
