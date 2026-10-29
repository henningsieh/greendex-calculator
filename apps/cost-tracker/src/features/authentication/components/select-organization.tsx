"use client";

import { useTranslations } from "@greendex/i18n/client";
import { Building2Icon, LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";

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
  onSelected?: () => Promise<void>;
  signOutDestination?: string;
};

export function SelectOrganization({
  organizations,
  onSelected,
  signOutDestination,
}: SelectOrganizationProps) {
  const router = useRouter();
  const t = useTranslations("onboarding");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function selectOrganization(organizationId: string) {
    if (pendingId !== null) return;
    setPendingId(organizationId);
    setFailed(false);

    try {
      const result = await authClient.organization.setActive({ organizationId });
      if (result.error) {
        setFailed(true);
        return;
      }
      if (onSelected) await onSelected();
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
          <EmptyTitle>
            <h1 ref={heading} tabIndex={-1}>
              {t("selection.heading")}
            </h1>
          </EmptyTitle>
          <EmptyDescription>{t("selection.description")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <ul className="flex w-full flex-col gap-2">
            {organizations.map((organization) => (
              <li key={organization.id}>
                <Button
                  data-testid={`select-organization-${organization.id}`}
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
            <p role="alert" data-select-status="failed">
              {t("selection.error")}
            </p>
          ) : null}
          <SignOutButton destination={signOutDestination} />
        </EmptyContent>
      </Empty>
    </main>
  );
}
