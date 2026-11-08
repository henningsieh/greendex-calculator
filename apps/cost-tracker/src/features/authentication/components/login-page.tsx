import { getTranslations } from "@greendex/i18n/server";

import { AuthForm } from "@/features/authentication/components/auth-form";
import { InvitationAcceptance } from "@/features/authentication/components/invitation-acceptance";
import { onboardingReturnTo } from "@/features/authentication/onboarding-decision";
import { redirect } from "@/lib/i18n/routing";
import { orpc } from "@/lib/orpc/orpc";
import { getSession, safeSignInReturnTo } from "@/lib/session";

export async function generateMetadata() {
  const t = await getTranslations("onboarding");
  return { title: t("auth.signIn"), description: t("auth.metadata") };
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
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
  if (await getSession())
    redirect({ href: next ?? "/projects", locale: (await params).locale });
  return (
    <AuthForm
      mode="sign-in"
      returnTo={next}
      entryContext={decision.entryContext}
    />
  );
}
