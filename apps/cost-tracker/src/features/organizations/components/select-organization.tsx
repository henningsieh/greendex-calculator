"use client";

import { Building2Icon, LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { SignOutButton } from "@/features/authentication/components/sign-out-button";
import type { OrganizationMembershipSummary } from "@/features/organizations/staff-eligibility";
import { authClient } from "@/lib/auth-client";

type SelectOrganizationProps = {
  organizations: Pick<OrganizationMembershipSummary, "id" | "name">[];
};

/**
 * Recovery for a missing, stale, or revoked active Organization (ADR-0015).
 * Renders inline with no staff actions and no redirects, so the shell can
 * neither show unusable actions nor loop: choosing a Membership re-anchors
 * the session through the supported Better Auth API and refreshes the
 * shell. Creating a new Organization is intentionally absent here — Better
 * Auth only lets Membership-free Users create one, and that case keeps the
 * existing creation empty state.
 */
export function SelectOrganization({ organizations }: SelectOrganizationProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function selectOrganization(organizationId: string) {
    if (pendingId !== null) return;
    setPendingId(organizationId);
    setFailed(false);

    try {
      await authClient.organization.setActive({ organizationId });
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl items-center px-5 py-10 sm:px-8">
      <Empty variant="outlined">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Building2Icon />
          </EmptyMedia>
          <EmptyTitle>Select an Organization</EmptyTitle>
          <EmptyDescription>
            Your previous Organization context is no longer available. Choose
            which Organization to continue with — this only changes which
            Organization you act for, never your Memberships or Project
            Participations.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <ul className="flex w-full flex-col gap-2">
            {organizations.map((organization) => (
              <li key={organization.id}>
                <Button
                  className="w-full"
                  disabled={pendingId !== null}
                  onClick={() => void selectOrganization(organization.id)}
                  type="button"
                  variant="outline"
                >
                  {pendingId === organization.id && (
                    <LoaderCircleIcon
                      aria-hidden="true"
                      className="animate-spin"
                      data-icon="inline-start"
                    />
                  )}
                  {organization.name}
                </Button>
              </li>
            ))}
          </ul>
          {failed ? (
            <p role="alert">
              Could not select that Organization. It may have been removed —
              choose another one.
            </p>
          ) : null}
          <SignOutButton />
        </EmptyContent>
      </Empty>
    </main>
  );
}
