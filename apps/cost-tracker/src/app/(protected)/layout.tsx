import { AppNavigation } from "@/components/app-navigation";
import { NoOrganizationAccess } from "@/features/authentication/components/no-organization-access";
import { hasOrganizationMembership, requireSession } from "@/lib/session";

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSession();
  if (!(await hasOrganizationMembership())) {
    const newlyRegistered =
      Date.now() - session.user.createdAt.getTime() < 10 * 60 * 1000;

    return <NoOrganizationAccess autoOpen={newlyRegistered} />;
  }

  return (
    <div className="min-h-svh bg-muted/35">
      <header className="border-b bg-background">
        <AppNavigation email={session.user.email} name={session.user.name} />
      </header>
      <main className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
        {children}
      </main>
    </div>
  );
}
