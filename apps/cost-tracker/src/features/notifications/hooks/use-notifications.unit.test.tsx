import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useMarkAllNotificationsRead,
  useMarkNotificationsRead,
} from "@/features/notifications/hooks/use-notifications";

const mocks = vi.hoisted(() => ({
  markRead: vi.fn(),
  markAllRead: vi.fn(),
  toastAdd: vi.fn(),
}));

vi.mock("@/lib/orpc/orpc", () => ({
  orpcQuery: {
    notifications: {
      listUnread: {
        queryKey: () => ["notifications", "listUnread"],
        queryOptions: () => ({
          queryKey: ["notifications", "listUnread"],
          queryFn: async () => ({ items: [], unreadCount: 0 }),
        }),
      },
      markRead: { mutationOptions: () => ({ mutationFn: mocks.markRead }) },
      markAllRead: {
        mutationOptions: () => ({ mutationFn: mocks.markAllRead }),
      },
    },
  },
}));

vi.mock("@/components/ui/toast", () => ({
  toast: { add: mocks.toastAdd },
}));

vi.mock("@greendex/i18n/client", () => ({
  useTranslations: () => (key: string) => key,
}));

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("notification read mutations", () => {
  it("invalidates unread after a successful mark-read", async () => {
    mocks.markRead.mockResolvedValue({ updated: 1, unreadCount: 0 });
    const queryClient = new QueryClient();
    const invalidate = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const { result } = renderHook(() => useMarkNotificationsRead(), {
      wrapper: wrapper(queryClient),
    });

    await result.current.mutateAsync({ ids: ["notification-1"] });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["notifications", "listUnread"],
    });
  });

  it("shows accessible feedback when a read mutation fails", async () => {
    mocks.markRead.mockRejectedValue(new Error("access denied"));
    mocks.markAllRead.mockRejectedValue(new Error("access denied"));
    const queryClient = new QueryClient();
    const markRead = renderHook(() => useMarkNotificationsRead(), {
      wrapper: wrapper(queryClient),
    });
    const markAll = renderHook(() => useMarkAllNotificationsRead(), {
      wrapper: wrapper(queryClient),
    });

    await expect(
      markRead.result.current.mutateAsync({ ids: ["notification-1"] }),
    ).rejects.toThrow("access denied");
    await waitFor(() =>
      expect(mocks.toastAdd).toHaveBeenCalledWith({
        title: "bell.updateFailed",
        type: "error",
      }),
    );

    mocks.toastAdd.mockClear();
    await expect(markAll.result.current.mutateAsync()).rejects.toThrow(
      "access denied",
    );
    await waitFor(() =>
      expect(mocks.toastAdd).toHaveBeenCalledWith({
        title: "bell.updateFailed",
        type: "error",
      }),
    );
  });
});
