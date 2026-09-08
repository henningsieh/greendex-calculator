/**
 * @greendex/auth
 * Better Auth configuration and utilities
 *
 * This package provides the authentication setup.
 * The actual auth instance must be created in the app with app-specific config
 * (env variables, email handlers, etc.)
 */

// Export types
export type { AuthClientConfig } from "./auth-client";
export type { Session, User } from "better-auth/types";

// Export auth client utilities
export { createAuthClient } from "./auth-client";
