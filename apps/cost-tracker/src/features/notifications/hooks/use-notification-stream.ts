"use client";

import { useFormatter, useTranslations } from "@greendex/i18n/client";
import {
  NOTIFICATION_CREATED_EVENT,
  NotificationCreatedSchema,
} from "@greendex/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { io } from "socket.io-client";

import { toast } from "@/components/ui/toast";
import { orpcQuery } from "@/lib/orpc/orpc";

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const RECONNECT_MAX_ATTEMPTS = 5;

/**
 * One socket per mounted shell. Payloads are validated before they reach the
 * toast or cache; unknown shapes are ignored. Connect and every pushed event
 * invalidate the unread query, so reconnect and window focus both catch up.
 */
export function useNotificationStream(realtimeUrl: string | undefined) {
  const queryClient = useQueryClient();
  const format = useFormatter();
  const t = useTranslations("notifications");

  useEffect(() => {
    if (!realtimeUrl) return;

    const socket = io(realtimeUrl, { withCredentials: true });
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryAttempt = 0;
    const scheduleReconnect = () => {
      if (retryAttempt >= RECONNECT_MAX_ATTEMPTS) return;
      const delay = Math.min(
        RECONNECT_BASE_MS * 2 ** retryAttempt,
        RECONNECT_MAX_MS,
      );
      retryAttempt += 1;
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        socket.connect();
      }, delay);
    };
    const refreshUnread = () => {
      void queryClient.invalidateQueries({
        queryKey: orpcQuery.notifications.listUnread.queryKey(),
      });
    };
    socket.on("connect", () => {
      retryAttempt = 0;
      refreshUnread();
    });
    socket.on("connect_error", (error: Error) => {
      if (error.message === "session_unavailable") scheduleReconnect();
    });
    socket.on(NOTIFICATION_CREATED_EVENT, (payload: unknown) => {
      const parsed = NotificationCreatedSchema.safeParse(payload);
      if (!parsed.success) return;
      const { event } = parsed.data;
      if (event.type !== "claim.paid") return;
      toast.add({
        title: t("toast.title"),
        description: t("toast.description", {
          amount: format.number(Number(event.payload.amountEur), {
            style: "currency",
            currency: "EUR",
          }),
        }),
        type: "info",
      });
      refreshUnread();
    });

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      socket.disconnect();
    };
  }, [format, queryClient, realtimeUrl, t]);
}
