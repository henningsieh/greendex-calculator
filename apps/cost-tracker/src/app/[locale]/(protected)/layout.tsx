import ProtectedLayout from "@/components/protected-layout";

export default function LocaleProtectedLayout({
  children,
  breadcrumb,
}: Readonly<{ children: React.ReactNode; breadcrumb?: React.ReactNode }>) {
  return <ProtectedLayout breadcrumb={breadcrumb}>{children}</ProtectedLayout>;
}
