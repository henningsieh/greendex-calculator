"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const result = await authClient.signOut();
    if (!result.error) router.replace("/");
  }

  return (
    <Button onClick={signOut} size="sm" variant="ghost">
      Sign out
    </Button>
  );
}
