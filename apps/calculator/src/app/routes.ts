// ============================================================================
// Next.js Route Type Definitions and Path Constants
// ============================================================================
// This module provides type-safe route definitions for the application.
// It integrates with Next.js generated types and next-intl for i18n routing.
//
// Usage:
//   - Import route constants for use with next-intl's Link component
//   - The Link component automatically handles locale prefix injection
//   - Use AppRoute type for type-safe route parameters
// ============================================================================

// @ts-ignore TS2307: module '#next-routes/routes' is generated at build time
import type { AppRoutes } from "#next-routes/routes";

// ============================================================================
// Type Utilities
// ============================================================================

/**
 * Strips the locale prefix from Next.js generated route types.
 *
 * This utility type transforms routes from the format `/${locale}/${path}`
 * to `/${path}` for compatibility with next-intl's automatic locale handling.
 *
 * @template T - The route type to transform (typically from AppRoutes)
 *
 * @example
 *   StripLocale<"/[locale]/org/dashboard"> => "/org/dashboard"
 *   StripLocale<"/[locale]"> => "/"
 *
 * @remarks
 *   Uses distributive conditional types to properly handle union types.
 *   The next-intl Link component will automatically add the locale prefix
 *   when these routes are used.
 */
type StripLocale<T> = T extends `/${string}/${infer R}`
  ? `/${R}`
  : T extends "/[locale]"
    ? "/"
    : T;

/**
 * Application route type with locale prefix removed.
 *
 * Use this type for type-safe route definitions throughout the application.
 * All routes using this type are compatible with next-intl's Link component.
 */
export type AppRoute = StripLocale<AppRoutes>;

// ============================================================================
// Organization Routes
// ============================================================================
// Routes related to organization management and workspace functionality.
// These routes typically require authentication and organization membership.
// ============================================================================

/**
 * Main organization dashboard route.
 * Displays overview of organization activities and metrics.
 */
export const DASHBOARD_PATH: AppRoute = "/org/dashboard";

/**
 * Projects listing route.
 * Shows all active projects within the organization.
 */
export const PROJECTS_PATH: AppRoute = "/org/projects";

/**
 * Individual project detail route.
 * Dynamic route requiring a project ID parameter.
 *
 * @example
 *   // Usage with next-intl Link:
 *   <Link href={PROJECT_DETAIL_PATH.replace('[id]', projectId)}>
 */
export const PROJECT_DETAIL_PATH: AppRoute = "/org/projects/[id]";

/**
 * Archived projects route.
 * Displays projects that have been archived by the organization.
 */
export const PROJECTS_ARCHIVE_PATH: AppRoute = "/org/projects-archive";

/**
 * Organization participants management route.
 * Interface for managing participant data and permissions.
 */
export const PARTICIPANTS_PATH: AppRoute = "/org/participants";

/**
 * Team management route.
 * Manage organization team members, roles, and permissions.
 */
export const TEAM_PATH: AppRoute = "/org/team";

/**
 * Organization settings route.
 * Configure organization-wide preferences and settings.
 */
export const SETTINGS_PATH: AppRoute = "/org/settings";

/**
 * Project creation route.
 * Interface for creating new projects within the organization.
 */
export const CREATE_PROJECT_PATH: AppRoute = "/org/create-project";

/**
 * Organization creation route.
 * Onboarding flow for creating a new organization.
 */
export const CREATE_ORG_PATH: AppRoute = "/org/create";

// ============================================================================
// Authentication Routes
// ============================================================================
// Routes for user authentication and account management flows.
// These routes are typically accessible without authentication.
// ============================================================================

/**
 * User login route.
 * Entry point for existing users to authenticate.
 */
export const LOGIN_PATH: AppRoute = "/login";

/**
 * User registration route.
 * New user account creation flow.
 */
export const SIGNUP_PATH: AppRoute = "/signup";

/**
 * Password recovery initiation route.
 * Allows users to request a password reset email.
 */
export const FORGOT_PASSWORD_PATH: AppRoute = "/forgot-password";

/**
 * Password reset confirmation route.
 * Handles password reset token validation and new password submission.
 */
export const RESET_PASSWORD_PATH: AppRoute = "/reset-password";

/**
 * Email verification route.
 * Handles email confirmation token validation for new accounts.
 */
export const VERIFY_EMAIL_PATH: AppRoute = "/verify-email";

// ============================================================================
// User Account Routes
// ============================================================================
// Routes for individual user account management and preferences.
// These routes require user authentication.
// ============================================================================

/**
 * User settings and preferences route.
 * Personal account configuration and profile management.
 */
export const USER_SETTINGS_PATH: AppRoute = "/org/user/settings";

// ============================================================================
// Public Landing and Content Routes
// ============================================================================
// Publicly accessible routes for marketing, content, and information pages.
// These routes do not require authentication.
// ============================================================================

/**
 * Application home/landing page route.
 * Main entry point for unauthenticated users.
 */
export const HOME_PATH: AppRoute = "/";

/**
 * Workshops section anchor.
 * Hash link to workshops section on the home page.
 *
 * @remarks
 *   This is an anchor link, not a standalone route.
 *   Use for smooth scrolling to the workshops section.
 */
export const WORKSHOPS_ANCHOR = "/#workshops";

/**
 * Resource library route.
 * Browse and access application resource library.
 */
export const LIBRARY_PATH: AppRoute = "/library";

/**
 * Tips and tricks content route.
 * Educational content and best practices guide.
 */
export const TIPS_AND_TRICKS_PATH: AppRoute = "/tips-and-tricks";

/**
 * E-Forest feature route.
 * Access to the e-forest functionality.
 */
export const E_FOREST_PATH: AppRoute = "/e-forest";

/**
 * About page route.
 * Information about the application and organization.
 */
export const ABOUT_PATH: AppRoute = "/about";
