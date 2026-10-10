import { AppNavigation } from "@/components/app-navigation";
import { NoOrganizationAccess } from "@/features/authentication/components/no-organization-access";
import {
  canManageOrganization,
  canViewPartnerNetwork,
} from "@/features/organizations/access";
import { SelectOrganization } from "@/features/organizations/components/select-organization";
import { resolveStaffOrganizationContext } from "@/features/organizations/staff-eligibility";
import { orpc } from "@/lib/orpc/orpc";
import { requireSession } from "@/lib/session";

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSession();
  // Shell context, not policy: the caller's Memberships bootstrap the
  // active-Membership gate and the switcher list. Procedures re-authorize
  // every request, so this gate only decides which shell renders.
  const memberships = await orpc.organizations.listMemberships();
  const context = resolveStaffOrganizationContext({
    memberships,
    activeOrganizationId: session.session.activeOrganizationId ?? null,
  });

  if (context.status === "no-membership") {
    const newlyRegistered =
      Date.now() - session.user.createdAt.getTime() < 10 * 60 * 1000;

    return <NoOrganizationAccess autoOpen={newlyRegistered} />;
  }

  // Missing, stale, or revoked active context: inline selection recovery.
  // No staff actions render and nothing redirects, so this cannot loop.
  if (context.status === "select") {
    return <SelectOrganization organizations={context.memberships} />;
  }

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
