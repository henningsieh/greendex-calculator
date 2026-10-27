import { connection } from "next/server";

import { AppNavigation } from "@/components/app-navigation";
import { CheckInbox } from "@/features/authentication/components/check-inbox";
import { NoOrganizationAccess } from "@/features/authentication/components/no-organization-access";
import { SignOutButton } from "@/features/authentication/components/sign-out-button";
import {
  canManageOrganization,
  canViewPartnerNetwork,
} from "@/features/organizations/access";
import { InvitationAcceptance } from "@/features/organizations/components/invitation-acceptance";
import { SelectOrganization } from "@/features/organizations/components/select-organization";
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
    <div className="min-h-svh bg-muted/35">
      <header className="border-b bg-background">
        <AppNavigation
          activeOrganizationId={context.activeOrganizationId}
          email={session.user.email}
          name={session.user.name}
          showOrganization={canViewOrganization}
          showOrganizationSwitcher={context.showSwitcher}
          showPartnerOrganizations={await canViewPartnerNetwork()}
          staffOrganizations={context.memberships}
        />
      </header>
      <main className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
        {children}
      </main>
    </div>
  );
}
