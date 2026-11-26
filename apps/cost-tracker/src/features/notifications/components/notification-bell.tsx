"use client";

import { useFormatter, useTranslations } from "@greendex/i18n/client";
import { BellIcon, CheckCheckIcon } from "lucide-react";

import { partnershipClaimPath } from "@/app/paths";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotificationStream } from "@/features/notifications/hooks/use-notification-stream";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationsRead,
  useUnreadNotifications,
} from "@/features/notifications/hooks/use-notifications";
import { useRouter } from "@/lib/i18n/routing";
import type { Outputs } from "@/lib/orpc/router";

type NotificationItem = Outputs["notifications"]["listUnread"]["items"][number];

function unreadBadge(count: number): string {
  return count > 9 ? "9+" : String(count);
}

/**
 * Shell inbox: unread count, recent list, click-through to the Claim, and the
 * live stream that feeds both the query and the toast. The bell is the only
 * mount point, so there is one socket per shell.
 */
export function NotificationBell({ realtimeUrl }: { realtimeUrl?: string }) {
  const t = useTranslations("notifications");
  const format = useFormatter();
  const router = useRouter();
  const { data, isPending, isError } = useUnreadNotifications();
  const markRead = useMarkNotificationsRead();
  const markAllRead = useMarkAllNotificationsRead();
  useNotificationStream(realtimeUrl);

  const count = data?.unreadCount ?? 0;
  const items = data?.items ?? [];

  const openNotification = (item: NotificationItem) => {
    markRead.mutate({ ids: [item.id] });
    if (item.event.type === "claim.paid")
      router.push(partnershipClaimPath(item.event.payload.partnershipId));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative"
            aria-label={t("bell.open", { count })}
            data-testid="notification-bell"
            data-unread-count={count}
          >
            <BellIcon aria-hidden="true" />
            {count > 0 ? (
              <span
                aria-hidden="true"
                className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold tracking-normal text-primary-foreground normal-case"
                data-testid="notification-badge"
              >
                {unreadBadge(count)}
              </span>
            ) : null}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80">
        <div className="px-2 py-1.5">
          <span className="text-sm font-semibold">{t("bell.title")}</span>
        </div>
        {count > 0 ? (
          <DropdownMenuItem
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            closeOnClick={false}
            data-testid="notification-mark-all"
          >
            <CheckCheckIcon aria-hidden="true" />
            {t("bell.markAllRead")}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        {isPending ? (
          <p
            className="px-2 py-4 text-sm text-muted-foreground"
            data-testid="notification-loading"
          >
            {t("bell.loading")}
          </p>
        ) : isError ? (
          <p
            className="px-2 py-4 text-sm text-muted-foreground"
            data-testid="notification-error"
          >
            {t("bell.error")}
          </p>
        ) : items.length === 0 ? (
          <p
            className="px-2 py-4 text-sm text-muted-foreground"
            data-testid="notification-empty"
          >
            {t("bell.empty")}
          </p>
        ) : (
          items.map((item) => (
            <DropdownMenuItem
              key={item.id}
              onClick={() => openNotification(item)}
              className="flex-col items-start"
              data-testid={`notification-item-${item.id}`}
            >
              <span className="text-sm font-medium">
                {t("bell.claimPaidTitle")}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("bell.claimPaidDescription", {
                  amount: format.number(Number(item.event.payload.amountEur), {
                    style: "currency",
                    currency: "EUR",
                  }),
                })}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
