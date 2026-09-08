import { AppNavigation } from "@/components/app-navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { SiteBrand } from "@/components/site-brand";
import { requireSession } from "@/lib/session";

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSession();

  return (
    <div className="min-h-svh bg-muted/35">
      <header className="bg-background">
        <div className="mx-auto flex h-18 w-full max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <SiteBrand href="/dashboard" />
          <div className="lg:hidden">
            <SignOutButton />
          </div>
        </div>
        <AppNavigation email={session.user.email} name={session.user.name} />
      </header>
      <main className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
        {children}
      </main>
    </div>
  );
}
