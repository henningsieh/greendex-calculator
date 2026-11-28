import type { ProtectedPage } from "@/features/breadcrumbs/breadcrumb-routes";

export type OrganizationPageKind = Extract<ProtectedPage, "settings" | "team">;
