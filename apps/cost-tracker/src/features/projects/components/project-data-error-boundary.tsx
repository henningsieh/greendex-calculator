"use client";

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
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";

type ProjectDataErrorBoundaryProps = {
  children: React.ReactNode;
  resource: string;
};

type ProjectDataErrorFallbackProps = FallbackProps & {
  resource: string;
};

function ProjectDataErrorFallback({
  error,
  resetErrorBoundary,
  resource,
}: ProjectDataErrorFallbackProps) {
  const errorMessage = getORPCRequestErrorMessage(error);

  return (
    <Alert variant="destructive">
      <AlertTitle>Unable to load {resource}</AlertTitle>
      <AlertDescription>{errorMessage.text}</AlertDescription>
      <AlertAction>
        {errorMessage.sessionExpired ? (
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
            Retry
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
