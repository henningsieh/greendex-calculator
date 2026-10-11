import { openapi } from "@orpc/openapi";
import { z } from "zod";

import { env } from "@/env";
import { auth } from "@/lib/better-auth";
import { SessionSchema } from "@/lib/better-auth/validation-schemas";
import { base } from "@/lib/orpc/context";
import { authorized } from "@/lib/orpc/middleware";

/**
 * Public hello world procedure
 * Simple demonstration of a basic oRPC procedure
 */
export const helloWorld = base
  .meta(openapi({ method: "POST" }))
  .input(
    z.object({
      name: z.string().optional().default("World"),
    }),
  )
  .handler(({ input }) => {
    return {
      message: `Hello, ${input.name}!`,
      timestamp: new Date().toISOString(),
    };
  });

/**
 * Public health check procedure
 * Returns server status and uptime
 */
export const getHealth = base.meta(openapi({ method: "GET" })).handler(() => {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
  };
});

/**
 * Protected procedure example
 * Requires authentication and returns user info
 */
export const getProfile = authorized
  .meta(
    openapi({
      method: "GET",
      path: "/users/profile",
      summary: "Get user profile",
    }),
  )
  .handler(({ context, errors }) => {
    if (!(context.user && context.session)) {
      throw errors.UNAUTHORIZED();
    }
    return {
      user: {
        id: context.user.id,
        name: context.user.name,
        email: context.user.email,
      },
      session: {
        id: context.session.id,
        expiresAt: context.session.expiresAt,
      },
    };
  });

/**
 * Get authentication session using Better Auth
 * Returns session and user info if authenticated
 */
export const getSession = base
  .meta(
    openapi({
      method: "GET",
      path: "/auth/session",
      summary: "Get authentication session",
    }),
  )
  .output(SessionSchema)
  .handler(async ({ context, errors }) => {
    try {
      const session = await auth.api.getSession({
        headers: context.headers,
      });
      return session;
    } catch (error) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to fetch session",
        cause: error,
      });
    }
  });

/**
 * Sign in with email and password using Better Auth
 * Returns session and user info on successful authentication
 */
export const signIn = base
  .meta(
    openapi({
      method: "POST",
      path: "/auth/sign-in",
      summary: "Sign in with email and password",
    }),
  )
  .input(
    z.object({
      email: z.email(),
      password: z.string().min(1),
    }),
  )
  .output(z.custom<Awaited<ReturnType<typeof auth.api.signInEmail>>>())
  .handler(async ({ input, context, errors }) => {
    try {
      const result = await auth.api.signInEmail({
        body: input,
        headers: context.headers,
      });
      return result;
    } catch (error) {
      // Check if this is an authentication failure (invalid credentials)
      const isAuthError =
        error &&
        typeof error === "object" &&
        "statusCode" in error &&
        error.statusCode === 401;

      if (isAuthError) {
        throw errors.UNAUTHORIZED({
          message: "Invalid email or password",
          cause: error,
        });
      }

      // Other errors (server issues, rate limiting, etc.) are server errors
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to sign in",
        cause: error,
      });
    }
  });

/**
 * Sign up with email and password using Better Auth
 * Returns session and user info on successful registration
 */
export const signUp = base
  .meta(
    openapi({
      method: "POST",
      path: "/auth/sign-up",
      summary: "Sign up with email and password",
    }),
  )
  .input(
    z.object({
      name: z.string().min(1),
      email: z.email(),
      password: z.string().min(8),
    }),
  )
  .output(z.custom<Awaited<ReturnType<typeof auth.api.signUpEmail>>>())
  .handler(async ({ input, context, errors }) => {
    try {
      const result = await auth.api.signUpEmail({
        body: input,
        headers: context.headers,
      });
      return result;
    } catch (error) {
      // Better Auth throws errors for validation failures, which are client errors
      throw errors.BAD_REQUEST({
        message: "Failed to sign up",
        cause: error,
      });
    }
  });

/**
 * Sign out using Better Auth
 * Invalidates the current session
 */
export const signOut = base
  .meta(
    openapi({
      method: "POST",
      path: "/auth/sign-out",
      summary: "Sign out and invalidate session",
    }),
  )
  .output(z.custom<Awaited<ReturnType<typeof auth.api.signOut>>>())
  .handler(async ({ context, errors }) => {
    try {
      const result = await auth.api.signOut({
        headers: context.headers,
      });
      return result;
    } catch (error) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to sign out",
        cause: error,
      });
    }
  });
