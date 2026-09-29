import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { getSession, invitationReturnTo } from "@/lib/session";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to the Greendex Cost Tracker.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const next = invitationReturnTo((await searchParams).next);
  if (await getSession()) redirect(next ?? "/projects");

  return <AuthForm mode="sign-in" returnTo={next} />;
}
