import { connection } from "next/server";
import { Suspense } from "react";

import { AppNavigation } from "@/components/app-navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { ProtectedPageSkeleton } from "@/components/protected-shell-skeleton";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { CheckInbox } from "@/features/authentication/components/check-inbox";
import { InvitationAcceptance } from "@/features/authentication/components/invitation-acceptance";
import { NoOrganizationAccess } from "@/features/authentication/components/no-organization-access";
import { SelectOrganization } from "@/features/authentication/components/select-organization";
import { SignOutButton } from "@/features/authentication/components/sign-out-button";
import {
  canManageOrganization,
  canViewPartnerNetwork,
} from "@/features/organizations/access";
import { resolveStaffOrganizationContext } from "@/features/organizations/staff-eligibility";
import { orpc } from "@/lib/orpc/orpc";
import { getSession } from "@/lib/session";

export async function ProtectedShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await connection();
  const session = await getSession();
  if (!session) return children;
  const decision = await orpc.authentication.onboardingNextStep({});
  if (decision.nextStep === "verify-email") {
    return (
      <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-6 p-5">
        <CheckInbox email={decision.email} />
        <SignOutButton />
        <div hidden>{children}</div>
      </main>
    );
  }
  if (decision.nextStep === "resolve-invitation")
    return (
      <main className="mx-auto w-full max-w-xl p-5">
        <InvitationAcceptance returnTo="/projects" initialDecision={decision} />
        <div hidden>{children}</div>
      </main>
    );
  if (decision.nextStep === "create-organization")
    return (
      <>
        <NoOrganizationAccess />
        <div hidden>{children}</div>
      </>
    );
  if (decision.nextStep === "select-organization") {
    return (
      <>
        <SelectOrganization
          organizations={decision.availableActions[0].organizations}
        />
        <div hidden>{children}</div>
      </>
    );
  }
  if (decision.nextStep !== "continue") return children;

  const memberships = await orpc.organizations.listMemberships();
  const context = resolveStaffOrganizationContext({
    memberships,
    activeOrganizationId: session.session.activeOrganizationId ?? null,
  });
  if (context.status !== "ready") return null;

  const canViewOrganization = await canManageOrganization();

  return (
    <SidebarProvider>
      <AppSidebar
        activeOrganizationId={context.activeOrganizationId}
        showOrganization={canViewOrganization}
        showOrganizationSwitcher={context.showSwitcher}
        showPartnerOrganizations={await canViewPartnerNetwork()}
        staffOrganizations={context.memberships}
      />
      <div className="min-h-svh w-full bg-muted/35">
        <header className="border-b bg-background">
          <div className="flex items-start gap-1">
            <SidebarTrigger className="mt-4 ml-3 shrink-0" />
            <div className="min-w-0 flex-1">
              <AppNavigation
                email={session.user.email}
                name={session.user.name}
                showOrganization={canViewOrganization}
                showPartnerOrganizations={await canViewPartnerNetwork()}
              />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
          <Suspense fallback={<ProtectedPageSkeleton />}>{children}</Suspense>
        </main>
      </div>
    </SidebarProvider>
  );
}
