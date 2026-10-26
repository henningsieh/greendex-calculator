import ProtectedLayout from "@/app/(protected)/layout";

// Identity export: re-export syntax falsely exposes transitive auth to the persistence guard.
export default ProtectedLayout;
