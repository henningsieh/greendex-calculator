import { redirect } from "next/navigation";
import { connection } from "next/server";

import { AppNavigation } from "@/components/app-navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { env } from "@/env";
import { CheckInbox } from "@/features/authentication/components/check-inbox";
import { InvitationAcceptance } from "@/features/authentication/components/invitation-acceptance";
import { NoOrganizationAccess } from "@/features/authentication/components/no-organization-access";
import { SelectOrganization } from "@/features/authentication/components/select-organization";
import { SignOutButton } from "@/features/authentication/components/sign-out-button";
import { BreadcrumbNav } from "@/features/breadcrumbs/components/breadcrumb-nav";
import {
  canManageOrganization,
  canViewPartnerNetwork,
} from "@/features/organizations/access";
import { resolveStaffOrganizationContext } from "@/features/organizations/staff-eligibility";
import { orpc } from "@/lib/orpc/orpc";
import { getSession } from "@/lib/session";
import { readSidebarPreference } from "@/lib/ui-preferences/server";
import { persistentViewTransitionName } from "@/lib/view-transitions";

export async function ProtectedShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await connection();
  const session = await getSession();
  // Redirect the shell for signed-out Users; route children execute independently.
  if (!session) redirect("/login");
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
  const sidebarDefaultOpen = await readSidebarPreference();
  return (
    <SidebarProvider defaultOpen={sidebarDefaultOpen}>
      <AppSidebar
        userName={session.user.name}
        userEmail={session.user.email}
        activeOrganizationId={context.activeOrganizationId}
        showOrganization={canViewOrganization}
        showOrganizationSwitcher={context.showSwitcher}
        showPartnerOrganizations={await canViewPartnerNetwork()}
        staffOrganizations={context.memberships}
      />
      <div className="min-h-svh w-full min-w-0 bg-muted/35">
        <header
          className="border-b bg-background"
          style={{
            viewTransitionName: persistentViewTransitionName.appHeader,
          }}
        >
          <div className="flex items-start gap-1">
            <div className="min-w-0 flex-1">
              <AppNavigation
                email={session.user.email}
                name={session.user.name}
                realtimeUrl={env.NEXT_PUBLIC_REALTIME_URL}
              />
            </div>
          </div>
          <BreadcrumbNav />
        </header>
        {/* `@container/content` makes the Project register and its filters
            respond to this content column, not the viewport. Expanding or
            collapsing the sidebar changes the column width and therefore
            switches the table to record cards (and back) on its own. */}
        <main className="@container/content mx-auto w-full max-w-7xl px-5 py-6 sm:px-8.5 lg:px-10 lg:py-8">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
