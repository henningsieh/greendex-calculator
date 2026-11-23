import { Suspense } from "react";

import { ProtectedShell } from "@/components/protected-shell";
import { ProtectedShellSkeleton } from "@/components/protected-shell-skeleton";

export default function ProtectedLayout({
  children,
  breadcrumb,
  sidebarOpen,
}: Readonly<{
  children: React.ReactNode;
  breadcrumb?: React.ReactNode;
  /** Persisted sidebar state, so the fallback reserves the same column. */
  sidebarOpen: boolean;
}>) {
  return (
    <Suspense fallback={<ProtectedShellSkeleton sidebarOpen={sidebarOpen} />}>
      <ProtectedShell breadcrumb={breadcrumb}>{children}</ProtectedShell>
    </Suspense>
  );
}
