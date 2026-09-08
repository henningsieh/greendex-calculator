import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to the Greendex Cost Tracker.",
};

export default async function LoginPage() {
  if (await getSession()) redirect("/dashboard");

  return <AuthForm mode="sign-in" />;
}
