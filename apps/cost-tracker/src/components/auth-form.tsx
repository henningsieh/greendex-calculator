"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [message, setMessage] = useState<string>();

  async function submit(formData: FormData) {
    const email = String(formData.get("email"));
    const password = String(formData.get("password"));
    const name = String(formData.get("name"));
    const result =
      mode === "sign-in"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ name, email, password });
    if (result.error)
      setMessage(result.error.message ?? "Authentication failed.");
    else router.replace("/");
  }

  return (
    <form
      action={submit}
      className="flex w-full max-w-sm flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm"
    >
      <div>
        <h1 className="font-heading text-2xl font-semibold">Cost Tracker</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to manage Project travel costs.
        </p>
      </div>
      {mode === "sign-up" && (
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            className="rounded-md border bg-background px-3 py-2"
            required
            name="name"
          />
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          className="rounded-md border bg-background px-3 py-2"
          required
          name="email"
          type="email"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          className="rounded-md border bg-background px-3 py-2"
          required
          minLength={8}
          name="password"
          type="password"
        />
      </label>
      {message && (
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
      )}
      <Button type="submit">
        {mode === "sign-in" ? "Sign in" : "Create account"}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          authClient.signIn.social({ provider: "google", callbackURL: "/" })
        }
      >
        Continue with Google
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
      >
        {mode === "sign-in" ? "Create an account" : "Use an existing account"}
      </Button>
    </form>
  );
}
