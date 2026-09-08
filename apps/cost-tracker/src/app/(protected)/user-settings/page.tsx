import type { Metadata } from "next";

import { EditNameForm } from "@/features/user-settings/components/edit-name-form";
import { ThemeSettings } from "@/features/user-settings/components/theme-settings";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "User settings" };

export default async function UserSettingsPage() {
  const session = await requireSession();

  return (
    <div className="max-w-5xl">
      <header className="max-w-2xl">
        <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
          User settings
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          Choose how Cost Tracker looks and keep your account details current.
        </p>
      </header>

      <div className="mt-12 divide-y border-y">
        <section className="grid gap-7 py-9 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-12 lg:py-11">
          <div>
            <h2 className="font-heading text-xl font-semibold">Appearance</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Your choice is saved in this browser.
            </p>
          </div>
          <ThemeSettings />
        </section>

        <section className="grid gap-7 py-9 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-12 lg:py-11">
          <div>
            <h2 className="font-heading text-xl font-semibold">
              Account details
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Keep the identity shown to other Project members accurate.
            </p>
          </div>
          <EditNameForm email={session.user.email} name={session.user.name} />
        </section>
      </div>
    </div>
  );
}
