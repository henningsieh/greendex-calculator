import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { QuestionnaireForm } from "@/features/participate/components/participate-form";
import { getProjectData } from "@/features/projects/utils";

// See apps/calculator/docs/README.md#instant-navigation-opt-outs.
export const instant = false;

interface ParticipatePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ParticipatePage({ params }: ParticipatePageProps) {
  const { id } = await params;

  const project = await getProjectData(id);

  if (!project) {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <QuestionnaireForm project={project} />
    </Suspense>
  );
}
