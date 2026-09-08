import { AppNavigation } from "@/components/app-navigation";
import { requireSession } from "@/lib/session";

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSession();

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
