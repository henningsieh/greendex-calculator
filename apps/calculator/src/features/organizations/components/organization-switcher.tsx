/* eslint-disable shadcn/no-restyle -- Organization switcher intentionally owns sidebar-specific interaction states. */
"use client";

import { useTranslations } from "@greendex/i18n/client";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";

import { useAppLoading } from "@/components/providers/loading-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateOrganizationModal } from "@/features/organizations/components/create-organization-modal";
import { ORGANIZATION_ICONS } from "@/features/organizations/organization-icons";
import { authClient } from "@/lib/better-auth/auth-client";
import { useRouter } from "@/lib/i18n/routing";
import { orpcQuery } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";

export function OrganizationSwitcher() {
  const t = useTranslations("app.loading");
  const { startLoading, stopLoading } = useAppLoading({
    message: t("switchingOrganization"),
    mode: "organization",
  });
  const queryClient = useQueryClient();
  const router = useRouter();

  // Use oRPC queries for consistency
  const { data: session } = useSuspenseQuery(
    orpcQuery.betterauth.getSession.queryOptions(),
  );

  const { data: organizations } = useSuspenseQuery(
    orpcQuery.organizations.list.queryOptions(),
  );

  const { data: activeOrganization } = useSuspenseQuery(
    orpcQuery.organizations.getActive.queryOptions(),
  );

  const { isMobile, state } = useSidebar();

  if (!(session && activeOrganization && organizations)) {
    return null;
  }

  const handleSelectOrganization = async (organizationId: string) => {
    startLoading();

    try {
      // 1. Switch organization on the server (this should trigger your hook)
      await authClient.organization.setActive({
        organizationId,
      });

      // Invalidate session / projects / active organization
      // Run invalidations in parallel to avoid sequential delays
      await Promise.all([
        // queryClient.invalidateQueries(
        //   orpcQuery.betterauth.getSession.queryOptions(),
        // ),
        queryClient.invalidateQueries(orpcQuery.projects.list.queryOptions()),
        queryClient.invalidateQueries(
          orpcQuery.organizations.getActive.queryOptions(),
        ),
        queryClient.invalidateQueries(
          orpcQuery.organizations.getRole.queryOptions(),
        ),
        queryClient.invalidateQueries(
          orpcQuery.organizations.getStats.queryOptions({
            input: {
              organizationId,
            },
          }),
        ),
      ]);
      router.refresh(); // Force immediate refresh to ensure navigation completes
    } catch (error) {
      console.error("Failed to switch organization:", error);
    } finally {
      stopLoading();
    }
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className={cn(
                "group/menubutton",
                "border border-sidebar-accent/80 text-sidebar-foreground/80 ring-sidebar-accent",
                "hover:bg-sidebar-primary/30 hover:text-sidebar-foreground",
                "data-[state=open]:bg-sidebar-primary/20 data-[state=open]:text-sidebar-foreground/60",
              )}
              size="lg"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary group-hover/menubutton:bg-primary/60">
                <ORGANIZATION_ICONS.organization className="size-4 text-primary-foreground" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-none">
                <span className="truncate">{activeOrganization.name}</span>
              </div>
              <ChevronsUpDownIcon className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            variant="sidebar"
            className={cn(
              state === "expanded" && "w-(--radix-dropdown-menu-trigger-width)",
              state === "collapsed" && "w-72",
            )}
            side={isMobile ? undefined : "right"}
            sideOffset={4}
          >
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onSelect={() => handleSelectOrganization(org.id)}
              >
                {org.name}
                {org.id === activeOrganization.id && (
                  <CheckIcon className="ml-auto" />
                )}
              </DropdownMenuItem>
            ))}
            {organizations && organizations.length > 0 && (
              <DropdownMenuSeparator />
            )}
            <CreateOrganizationModal
              label="Add Organization"
              triggerNode={
                <DropdownMenuItem
                  className="flex justify-center"
                  onSelect={(e) => e.preventDefault()}
                  variant="default"
                >
                  <PlusIcon className="size-4" />
                  Add Organization
                </DropdownMenuItem>
              }
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export const OrganizationSwitcherSkeleton = () => {
  const { open: isSidebarOpen } = useSidebar();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Skeleton
          className={cn("w-full rounded-md", isSidebarOpen ? "h-12" : "h-8")}
        />
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
