import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { InvitationRecovery } from "@/features/organizations/components/invitation-acceptance";
import { orpc } from "@/lib/orpc/orpc";
import { getSession, safeSignInReturnTo } from "@/lib/session";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create an account for the Greendex Cost Tracker.",
};

// Signed-in visitors redirect before the sign-up form paints; no wrong-audience flash.
export const instant = false;

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const rawNext = (await searchParams).next;
  const next = safeSignInReturnTo(rawNext);

  const decision = await orpc.authentication.onboardingNextStep({
    returnTo: typeof rawNext === "string" ? rawNext : undefined,
  });
  if (decision.entryContext === "organization-invitation" && !next)
    return <InvitationRecovery reason="STAFF_INVITATION_NOT_FOUND" />;
  if (await getSession()) redirect(next ?? "/projects");

  return (
    <AuthForm
      mode="sign-up"
      returnTo={next}
      entryContext={decision.entryContext}
    />
  );
}
