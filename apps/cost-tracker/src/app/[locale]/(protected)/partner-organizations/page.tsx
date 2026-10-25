import PartnerOrganizationsPage, {
  metadata as routeMetadata,
} from "@/app/(protected)/partner-organizations/page";

// Identity exports: re-export syntax falsely exposes transitive auth to the persistence guard.
export default PartnerOrganizationsPage;
export const metadata = routeMetadata;
