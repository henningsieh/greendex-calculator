"use client";

import { useTranslations } from "@greendex/i18n/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  LoaderCircleIcon,
} from "lucide-react";
import { useState } from "react";

import { EntityIcon } from "@/components/entity-icon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import type { OrganizationMembershipSummary } from "@/features/organizations/staff-eligibility";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "@/lib/i18n/routing";

type OrganizationSwitcherProps = {
  organizations: Pick<OrganizationMembershipSummary, "id" | "name">[];
  activeOrganizationId: string;
  /**
   * `header` keeps the bespoke header trigger. `sidebar` renders a full-width
   * SidebarMenuButton team-switcher trigger with identical switch behavior.
   */
  layout?: "header" | "sidebar";
};

/**
 * The single staff Organization switcher (ADR-0015). Lists only the
 * caller's Memberships with the current Organization explicit, and switches
 * through the supported Better Auth active-Organization API. Switching
 * invalidates Organization-scoped UI data and refreshes the shell so stale
 * data or capabilities can neither authorize nor leak; the server
 * re-authorizes every request regardless.
 */
export function OrganizationSwitcher({
  organizations,
  activeOrganizationId,
  layout = "header",
}: OrganizationSwitcherProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations("organizations.switcher");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const active = organizations.find(
    (organization) => organization.id === activeOrganizationId,
  );

  async function switchOrganization(organizationId: string) {
    if (organizationId === activeOrganizationId || pendingId !== null) return;
    setPendingId(organizationId);
    setFailed(false);

    try {
      await authClient.organization.setActive({ organizationId });
      await queryClient.invalidateQueries();
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            layout === "sidebar" ? (
              <SidebarMenuButton
                aria-label={t("aria", {
                  organization: active?.name ?? t("select"),
                })}
                data-testid="organization-switcher"
                disabled={pendingId !== null}
                size="lg"
                tooltip={active?.name ?? t("select")}
              />
            ) : (
              <Button
                data-testid="organization-switcher"
                aria-label={t("aria", {
                  organization: active?.name ?? t("select"),
                })}
                disabled={pendingId !== null}
                size="sm"
                variant="outline"
              />
            )
          }
        >
          {layout === "sidebar" ? (
            <>
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <EntityIcon entity="organization" className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm/tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-semibold">
                  {active?.name ?? t("select")}
                </span>
                <span className="truncate text-xs">{t("acting")}</span>
              </div>
              {pendingId !== null ? (
                <LoaderCircleIcon
                  aria-hidden="true"
                  className="animate-spin group-data-[collapsible=icon]:hidden"
                />
              ) : (
                <ChevronsUpDownIcon className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
              )}
            </>
          ) : (
            <>
              <EntityIcon data-icon="inline-start" entity="organization" />
              <span className="hidden md:inline">
                {active?.name ?? t("select")}
              </span>
              {pendingId !== null ? (
                <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
              ) : (
                <ChevronDownIcon aria-hidden="true" />
              )}
            </>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t("acting")}</DropdownMenuLabel>
            {organizations.map((organization) => {
              const current = organization.id === activeOrganizationId;

              return (
                <DropdownMenuItem
                  data-testid={`switch-organization-${organization.id}`}
                  aria-current={current ? "true" : undefined}
                  key={organization.id}
                  onClick={() => void switchOrganization(organization.id)}
                >
                  {organization.name}
                  {current && (
                    <CheckIcon aria-hidden="true" className="ml-auto" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {failed ? (
        <p role="alert" data-switch-status="failed">
          {t("failed")}
        </p>
      ) : null}
    </div>
  );
}
