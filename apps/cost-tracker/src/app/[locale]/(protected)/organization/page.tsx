import OrganizationPage, {
  metadata as routeMetadata,
} from "@/app/(protected)/organization/page";

// Identity exports: re-export syntax falsely exposes transitive auth to the persistence guard.
export default OrganizationPage;
export const metadata = routeMetadata;
