import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { getSession, safeSignInReturnTo } from "@/lib/session";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create an account for the Greendex Cost Tracker.",
};

// Keep the signed-in redirect before the authentication form paints.
export const instant = false;

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const next = safeSignInReturnTo((await searchParams).next);
  if (await getSession()) redirect(next ?? "/projects");

  return <AuthForm mode="sign-up" returnTo={next} />;
}
