import { Suspense } from "react";

import { ProtectedShell } from "@/components/protected-shell";
import { ProtectedShellSkeleton } from "@/components/protected-shell-skeleton";

export default function ProtectedLayout({
  children,
  breadcrumb,
}: Readonly<{ children: React.ReactNode; breadcrumb?: React.ReactNode }>) {
  return (
    <Suspense fallback={<ProtectedShellSkeleton />}>
      <ProtectedShell breadcrumb={breadcrumb}>{children}</ProtectedShell>
    </Suspense>
  );
}
