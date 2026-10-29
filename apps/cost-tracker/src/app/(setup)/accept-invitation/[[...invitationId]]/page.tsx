import { getTranslations } from "@greendex/i18n/server";
import { redirect } from "next/navigation";

import { InvitationAcceptance } from "@/features/authentication/components/invitation-acceptance";
import { orpc } from "@/lib/orpc/orpc";
import { invitationReturnTo } from "@/lib/session";

export async function generateMetadata() {
  const t = await getTranslations("onboarding");
  return { title: t("invitation.heading") };
}

export const instant = false;

export default async function OrganizationInvitationPage({
  params,
}: {
  params: Promise<{ invitationId?: string[] }>;
}) {
  const { invitationId } = await params;
  const returnTo =
    invitationId?.length === 1
      ? (invitationReturnTo(`/accept-invitation/${invitationId[0]}`) ??
        "/accept-invitation")
      : "/accept-invitation";
  const decision = await orpc.authentication.onboardingNextStep({ returnTo });
  if (
    decision.nextStep === "authenticate" &&
    decision.entryContext === "organization-invitation"
  ) {
    const action = decision.availableActions[0];
    redirect(`/${action.entry}?next=${encodeURIComponent(action.returnTo)}`);
  }
  if (decision.nextStep === "continue")
    redirect(decision.availableActions[0].destination);
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-6">
      <InvitationAcceptance returnTo={returnTo} initialDecision={decision} />
    </main>
  );
}
