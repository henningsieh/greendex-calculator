"use client";

import { GoogleIcon } from "@greendex/auth/oauth-icons";
import { ArrowRightIcon, LoaderCircleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFormStatus } from "react-dom";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type AuthFormProps = {
  mode: "sign-in" | "sign-up";
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const isSignIn = mode === "sign-in";

  async function submit(formData: FormData) {
    setError(undefined);
    setNotice(undefined);

    const email = String(formData.get("email"));
    const password = String(formData.get("password"));
    const name = String(formData.get("name"));

    try {
      const result = isSignIn
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ name, email, password });

      if (result.error) {
        setError(result.error.message ?? "Authentication failed.");
        return;
      }

      if (!isSignIn) {
        setNotice(
          "Check your inbox to verify your email, then return here to sign in.",
        );
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("We could not complete this request. Please try again.");
    }
  }

  async function signInWithGoogle() {
    setError(undefined);

    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
      });

      if (result.error) {
        setError(result.error.message ?? "Google sign-in failed.");
      }
    } catch {
      setError("Google sign-in could not start. Please try again.");
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-9">
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          {isSignIn ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-3 leading-7 text-muted-foreground">
          {isSignIn
            ? "Sign in to continue managing Project travel costs."
            : "Set up your account to begin organizing shared journey costs."}
        </p>
      </div>

      <form action={submit}>
        <FieldGroup className="gap-6">
          <Button onClick={signInWithGoogle} type="button" variant="outline">
            <GoogleIcon data-icon="inline-start" />
            Continue with Google
          </Button>

          <FieldSeparator>or use email</FieldSeparator>

          {!isSignIn && (
            <Field>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input
                autoComplete="name"
                id="name"
                minLength={2}
                name="name"
                placeholder="Your name"
                required
              />
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="email">Email address</FieldLabel>
            <Input
              autoComplete="email"
              id="email"
              name="email"
              placeholder="you@example.org"
              required
              type="email"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              autoComplete={isSignIn ? "current-password" : "new-password"}
              id="password"
              minLength={8}
              name="password"
              required
              type="password"
            />
            {!isSignIn && (
              <FieldDescription>Use at least 8 characters.</FieldDescription>
            )}
          </Field>

          {error && <FieldError>{error}</FieldError>}
          {notice && (
            <output className="rounded-xl bg-secondary px-4 py-3 text-sm leading-6 text-secondary-foreground">
              {notice}
            </output>
          )}

          <SubmitButton isSignIn={isSignIn} />
        </FieldGroup>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        {isSignIn ? "New to Cost Tracker?" : "Already have an account?"}{" "}
        <Link
          className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
          href={isSignIn ? "/register" : "/login"}
        >
          {isSignIn ? "Create an account" : "Sign in"}
        </Link>
      </p>

      <Link
        className={cn(
          buttonVariants({ size: "sm", variant: "ghost" }),
          "mx-auto mt-5 flex w-fit",
        )}
        href="/"
      >
        Back to home
      </Link>
    </div>
  );
}

function SubmitButton({ isSignIn }: { isSignIn: boolean }) {
  const { pending } = useFormStatus();

  const label = pending
    ? isSignIn
      ? "Signing in"
      : "Creating account"
    : isSignIn
      ? "Sign in"
      : "Create account";

  return (
    <Button disabled={pending} type="submit">
      {pending && (
        <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
      )}
      {label}
      {!pending && <ArrowRightIcon data-icon="inline-end" />}
    </Button>
  );
}
