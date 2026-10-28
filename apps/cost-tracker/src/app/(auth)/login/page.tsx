import { getTranslations } from "@greendex/i18n/server";
import { redirect } from "next/navigation";

import { AuthForm } from "@/features/authentication/components/auth-form";
import { onboardingReturnTo } from "@/features/authentication/onboarding-decision";
import { InvitationAcceptance } from "@/features/organizations/components/invitation-acceptance";
import { orpc } from "@/lib/orpc/orpc";
import { getSession, safeSignInReturnTo } from "@/lib/session";

export async function generateMetadata() {
  const t = await getTranslations("onboarding");
  return { title: t("auth.signIn"), description: t("auth.metadata") };
}

export const instant = false;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const returnTo = onboardingReturnTo((await searchParams).next);
  const decision = await orpc.authentication.onboardingNextStep({
    returnTo,
    authEntry: "login",
  });
  if (decision.entryContext === "organization-invitation") {
    if (decision.nextStep === "authenticate")
      return <AuthForm mode="sign-in" decision={decision} />;
    return (
      <InvitationAcceptance
        returnTo={safeSignInReturnTo(returnTo) ?? "/accept-invitation"}
        initialDecision={decision}
      />
    );
  }
  const next = safeSignInReturnTo(returnTo);
  if (await getSession()) redirect(next ?? "/projects");
  return (
    <AuthForm
      mode="sign-in"
      returnTo={next}
      entryContext={decision.entryContext}
    />
  );
}
