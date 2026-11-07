import { Suspense } from "react";

import { ProtectedShell } from "@/components/protected-shell";
import { ProtectedShellSkeleton } from "@/components/protected-shell-skeleton";

export default function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Suspense fallback={<ProtectedShellSkeleton />}>
      <ProtectedShell>{children}</ProtectedShell>
    </Suspense>
  );
}
