import ProtectedLayout from "@/components/protected-layout";
import { readSidebarPreference } from "@/lib/ui-preferences/server";

export default async function LocaleProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Read the persisted sidebar state above the shell boundary: the first
  // fallback has to reserve the same sidebar column, or the header and main
  // shift sideways as soon as the real shell streams in.
  const sidebarOpen = await readSidebarPreference();

  return <ProtectedLayout sidebarOpen={sidebarOpen}>{children}</ProtectedLayout>;
}
