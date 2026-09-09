import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create an account for the Greendex Cost Tracker.",
};

export default async function RegisterPage() {
  if (await getSession()) redirect("/projects");

  return <AuthForm mode="sign-up" />;
}
