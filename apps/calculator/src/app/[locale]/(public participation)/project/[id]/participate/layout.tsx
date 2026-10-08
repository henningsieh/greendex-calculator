import { notFound } from "next/navigation";

import { ParticipateHeader } from "@/features/participate/components/participate-header";
import { getProjectData } from "@/features/projects/utils";

// instant = false: kept on purpose — the project is resolved per request
// from the public link id (uncached read, invalid links 404). The form must
// render complete; a skeleton shell adds no value on a single-purpose link
// page. Caching with tags is a deliberate follow-up (#246).
export const instant = false;

/**
 * Public Project Participation Layout
 *
 * This layout ensures that new invited participants can access this by public link.
 * No authentication is required.
 * - Unauthenticated users -> can access (public participation) pages
 * - Project Participants provide Participant Travel Legs for arrival and departure
 */
export default async function PublicParticipateLayout({
  children,
  params,
}: Readonly<{
  params: Promise<{
    id: string;
  }>;
  children: React.ReactNode;
}>) {
  const { id: projectId } = await params;
  const project = await getProjectData(projectId);

  if (!project) {
    notFound();
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8">
      <ParticipateHeader project={project} />
      {children}
    </div>
  );
}
