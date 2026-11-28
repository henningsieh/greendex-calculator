import {
  NOTIFICATION_CREATED_EVENT,
  createClaimPaidEvent,
} from "@greendex/notifications";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useNotificationStream } from "@/features/notifications/hooks/use-notification-stream";

const mocks = vi.hoisted(() => ({
  io: vi.fn(),
  on: vi.fn(),
  disconnect: vi.fn(),
  connect: vi.fn(),
  toastAdd: vi.fn(),
  invalidate: vi.fn(),
}));

vi.mock("socket.io-client", () => ({ io: mocks.io }));

vi.mock("@/components/ui/toast", () => ({
  toast: { add: mocks.toastAdd },
}));

vi.mock("@/lib/orpc/orpc", () => ({
  orpcQuery: {
    notifications: {
      listUnread: { queryKey: () => ["notifications", "listUnread"] },
    },
  },
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useQueryClient: () => ({ invalidateQueries: mocks.invalidate }),
}));

vi.mock("@greendex/i18n/client", () => ({
  useTranslations: () => (key: string, values?: { amount?: string }) =>
    values?.amount ? `${key} ${values.amount}` : key,
  useFormatter: () => ({
    number: (value: number) => `EUR ${value.toFixed(2)}`,
  }),
}));

function handlerFor(event: string) {
  const call = mocks.on.mock.calls.find(([name]) => name === event);
  if (!call) throw new Error(`Missing socket handler for ${event}`);
  return call[1] as (payload: unknown) => void;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.io.mockReturnValue({
    on: mocks.on,
    disconnect: mocks.disconnect,
    connect: mocks.connect,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useNotificationStream", () => {
  it("does not connect without a configured realtime origin", () => {
    const view = renderHook(() => useNotificationStream(undefined));
    expect(mocks.io).not.toHaveBeenCalled();
    view.unmount();
  });

  it("connects with credentials and refreshes the unread query on connect", () => {
    const view = renderHook(() => useNotificationStream("http://realtime.test"));

    expect(mocks.io).toHaveBeenCalledExactlyOnceWith("http://realtime.test", {
      withCredentials: true,
    });
    handlerFor("connect")(undefined);
    expect(mocks.invalidate).toHaveBeenCalledWith({
      queryKey: ["notifications", "listUnread"],
    });

    view.unmount();
    expect(mocks.disconnect).toHaveBeenCalledOnce();
  });

  it("retries only a temporarily unavailable session with bounded backoff", async () => {
    vi.useFakeTimers();
    const view = renderHook(() => useNotificationStream("http://realtime.test"));
    const connectError = handlerFor("connect_error") as (error: Error) => void;

    connectError(new Error("unauthorized"));
    await vi.advanceTimersByTimeAsync(5_000);
    expect(mocks.connect).not.toHaveBeenCalled();

    connectError(new Error("session_unavailable"));
    await vi.advanceTimersByTimeAsync(999);
    expect(mocks.connect).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(mocks.connect).toHaveBeenCalledOnce();

    connectError(new Error("session_unavailable"));
    await vi.advanceTimersByTimeAsync(1_999);
    expect(mocks.connect).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(mocks.connect).toHaveBeenCalledTimes(2);

    view.unmount();
  });

  it("validates pushed events, toasts a paid Claim, and invalidates unread", () => {
    renderHook(() => useNotificationStream("http://realtime.test"));
    const handler = handlerFor(NOTIFICATION_CREATED_EVENT);

    handler({ id: "invalid" });
    expect(mocks.toastAdd).not.toHaveBeenCalled();

    handler({
      id: "notification-1",
      event: createClaimPaidEvent({
        projectId: "project-1",
        partnershipId: "partnership-1",
        claimId: "claim-1",
        amountEur: "1250.00",
        actorUserId: "actor-1",
      }),
      createdAt: "2026-11-26T08:00:00.000Z",
    });

    expect(mocks.toastAdd).toHaveBeenCalledExactlyOnceWith({
      title: "toast.title",
      description: "toast.description EUR 1250.00",
      type: "info",
    });
    expect(mocks.invalidate).toHaveBeenCalledOnce();
  });
});
