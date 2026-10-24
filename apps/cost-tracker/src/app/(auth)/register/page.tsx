import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
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
  const next = safeSignInReturnTo((await searchParams).next);
  if (await getSession()) redirect(next ?? "/projects");

  const decision = await orpc.authentication.onboardingNextStep({
    returnTo: next,
  });
  return (
    <AuthForm
      mode="sign-up"
      returnTo={next}
      entryContext={decision.entryContext}
    />
  );
}
