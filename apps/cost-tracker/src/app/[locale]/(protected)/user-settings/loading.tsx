import { ProtectedPageSkeleton } from "@/components/protected-shell-skeleton";
import { LoadingTransition } from "@/components/view-transition-boundaries";

export default function Loading() {
  return (
    <LoadingTransition>
      <ProtectedPageSkeleton />
    </LoadingTransition>
  );
}
