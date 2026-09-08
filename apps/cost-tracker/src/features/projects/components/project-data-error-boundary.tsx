"use client";

import { ORPCError } from "@orpc/client";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import Link from "next/link";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";

type ProjectDataErrorBoundaryProps = {
  children: React.ReactNode;
  resource: string;
};

type ProjectDataErrorFallbackProps = FallbackProps & {
  resource: string;
};

function getErrorMessage(error: unknown, resource: string) {
  if (error instanceof ORPCError) {
    if (error.code === "FORBIDDEN") {
      return `You no longer have access to these ${resource}.`;
    }

    if (error.code === "UNAUTHORIZED") {
      return "Your session has ended. Sign in again to continue.";
    }
  }

  return `We couldn't load ${resource}. Try again.`;
}

function ProjectDataErrorFallback({
  error,
  resetErrorBoundary,
  resource,
}: ProjectDataErrorFallbackProps) {
  const sessionExpired =
    error instanceof ORPCError && error.code === "UNAUTHORIZED";

  return (
    <Alert variant="destructive">
      <AlertTitle>Unable to load {resource}</AlertTitle>
      <AlertDescription>{getErrorMessage(error, resource)}</AlertDescription>
      <AlertAction>
        {sessionExpired ? (
          <Link
            className={buttonVariants({ size: "sm", variant: "outline" })}
            href="/login"
          >
            Sign in
          </Link>
        ) : (
          <Button
            onClick={resetErrorBoundary}
            size="sm"
            type="button"
            variant="outline"
          >
            Try again
          </Button>
        )}
      </AlertAction>
    </Alert>
  );
}

/**
 * Recovers a hydrated Project-data query after a suspense error.
 *
 * The nested QueryErrorResetBoundary clears TanStack Query's error state before
 * react-error-boundary retries rendering the view.
 */
export function ProjectDataErrorBoundary({
  children,
  resource,
}: ProjectDataErrorBoundaryProps) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          fallbackRender={(props) => (
            <ProjectDataErrorFallback {...props} resource={resource} />
          )}
          onReset={reset}
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
