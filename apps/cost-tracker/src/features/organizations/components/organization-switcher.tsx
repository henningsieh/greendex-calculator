"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  Building2Icon,
  CheckIcon,
  ChevronDownIcon,
  LoaderCircleIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { OrganizationMembershipSummary } from "@/features/organizations/staff-eligibility";
import { authClient } from "@/lib/auth-client";

type OrganizationSwitcherProps = {
  organizations: Pick<OrganizationMembershipSummary, "id" | "name">[];
  activeOrganizationId: string;
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
}: OrganizationSwitcherProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
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
            <Button
              aria-label={`Acting Organization: ${active?.name ?? "unknown"}. Switch Organization`}
              disabled={pendingId !== null}
              size="sm"
              variant="outline"
            />
          }
        >
          <Building2Icon aria-hidden="true" data-icon="inline-start" />
          {active?.name ?? "Select Organization"}
          {pendingId !== null ? (
            <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
          ) : (
            <ChevronDownIcon aria-hidden="true" />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Acting Organization</DropdownMenuLabel>
            {organizations.map((organization) => {
              const current = organization.id === activeOrganizationId;

              return (
                <DropdownMenuItem
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
        <p role="alert">Could not switch Organization. Try again.</p>
      ) : null}
    </div>
  );
}
