"use client";

import { useTranslations } from "@greendex/i18n/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/components/ui/toast";
import { orpcQuery } from "@/lib/orpc/orpc";

const unreadQueryKey = orpcQuery.notifications.listUnread.queryKey();

/**
 * The unread query is both the bell's data source and the offline catch-up:
 * it fetches on mount, refetches on window focus, and the live stream
 * invalidates the same key after connect or a pushed notification.
 */
export function useUnreadNotifications() {
  return useQuery({
    ...orpcQuery.notifications.listUnread.queryOptions({ input: {} }),
    meta: { costTrackerORPC: true },
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  const t = useTranslations("notifications");
  return useMutation({
    ...orpcQuery.notifications.markRead.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: unreadQueryKey });
    },
    onError: () => {
      toast.add({ title: t("bell.updateFailed"), type: "error" });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const t = useTranslations("notifications");
  return useMutation({
    ...orpcQuery.notifications.markAllRead.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: unreadQueryKey });
    },
    onError: () => {
      toast.add({ title: t("bell.updateFailed"), type: "error" });
    },
  });
}
