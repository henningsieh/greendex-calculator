import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import { NotificationBell } from "@/features/notifications/components/notification-bell";

const mocks = vi.hoisted(() => ({
  useUnread: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
  push: vi.fn(),
  stream: vi.fn(),
}));

vi.mock("@/features/notifications/hooks/use-notifications", () => ({
  useUnreadNotifications: mocks.useUnread,
  useMarkNotificationsRead: () => ({
    mutate: mocks.markRead,
    isPending: false,
  }),
  useMarkAllNotificationsRead: () => ({
    mutate: mocks.markAllRead,
    isPending: false,
  }),
}));

vi.mock("@/features/notifications/hooks/use-notification-stream", () => ({
  useNotificationStream: mocks.stream,
}));

vi.mock("@/lib/i18n/routing", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

const notification = {
  id: "notification-1",
  event: {
    type: "claim.paid" as const,
    version: 1 as const,
    payload: {
      projectId: "project-1",
      partnershipId: "partnership-1",
      claimId: "claim-1",
      amountEur: "1250.00",
      actorUserId: "actor-1",
    },
  },
  createdAt: new Date("2026-11-26T08:00:00.000Z"),
};

function unreadState(
  overrides: Partial<{
    items: (typeof notification)[];
    unreadCount: number;
    isPending: boolean;
    isError: boolean;
  }> = {},
) {
  return {
    data: {
      items: overrides.items ?? [notification],
      unreadCount: overrides.unreadCount ?? 1,
    },
    isPending: overrides.isPending ?? false,
    isError: overrides.isError ?? false,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useUnread.mockReturnValue(unreadState());
});

describe("NotificationBell", () => {
  it("shows the unread count and opens the recent list", async () => {
    const view = render(<NotificationBell />);

    expect(screen.getByTestId("notification-bell")).toHaveAttribute(
      "data-unread-count",
      "1",
    );
    expect(screen.getByTestId("notification-badge")).toBeInTheDocument();
    expect(mocks.stream).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByTestId("notification-bell"));
    expect(
      await screen.findByTestId("notification-item-notification-1"),
    ).toBeInTheDocument();
    view.unmount();
  });

  it("marks a clicked notification read and opens its Claim", async () => {
    render(<NotificationBell />);
    fireEvent.click(screen.getByTestId("notification-bell"));

    fireEvent.click(
      await screen.findByTestId("notification-item-notification-1"),
    );

    expect(mocks.markRead).toHaveBeenCalledExactlyOnceWith({
      ids: ["notification-1"],
    });
    expect(mocks.push).toHaveBeenCalledExactlyOnceWith(
      "/partnerships/partnership-1/claim",
    );
  });

  it("marks all notifications read from the list header", async () => {
    render(<NotificationBell />);
    fireEvent.click(screen.getByTestId("notification-bell"));

    fireEvent.click(await screen.findByTestId("notification-mark-all"));

    expect(mocks.markAllRead).toHaveBeenCalledOnce();
  });

  it("shows the empty and loading states without a badge", async () => {
    mocks.useUnread.mockReturnValue(unreadState({ items: [], unreadCount: 0 }));
    const view = render(<NotificationBell />);
    expect(screen.queryByTestId("notification-badge")).toBeNull();
    fireEvent.click(screen.getByTestId("notification-bell"));
    expect(await screen.findByTestId("notification-empty")).toBeVisible();
    view.unmount();

    mocks.useUnread.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    });
    render(<NotificationBell />);
    fireEvent.click(screen.getByTestId("notification-bell"));
    expect(await screen.findByTestId("notification-loading")).toBeVisible();
  });
});
