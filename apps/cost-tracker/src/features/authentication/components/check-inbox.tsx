"use client";

import { MailCheckIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function CheckInbox({ email }: { email: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <section className="w-full max-w-md" aria-labelledby="check-inbox-heading">
      <h1
        className="mb-6 font-heading text-3xl font-semibold tracking-tight"
        id="check-inbox-heading"
        ref={heading}
        tabIndex={-1}
      >
        Check your inbox
      </h1>
      <Alert
        variant="info"
        emphasis="prominent"
        data-testid="auth-verification-message"
      >
        <MailCheckIcon aria-hidden="true" />
        <AlertTitle>You&apos;re one step closer</AlertTitle>
        <AlertDescription>
          <p>
            We sent a verification link to <strong>{email}</strong>.
          </p>
          <p>
            Open the link to verify your personal login and continue where you
            left off in Cost Tracker.
          </p>
          <p>If you don&apos;t see it, check your spam folder too.</p>
        </AlertDescription>
      </Alert>
    </section>
  );
}
