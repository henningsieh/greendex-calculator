"use client";

import { useFormatter, useTranslations } from "@greendex/i18n/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Users2Icon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PROJECT_ICONS } from "@/features/projects/components/project-icons";
import { orpcQuery } from "@/lib/orpc/orpc";

interface ParticipantsListProps {
  activeProjectId: string;
}

/**
 * Render a card displaying participants for the specified project.
 *
 * @param activeProjectId - The project identifier used to fetch and display its participants.
 * @returns A React element showing a participants card with a header (title and count), an empty state when there are no participants, or a list of participant rows including avatar, name, email, and joined date.
 */
export function ParticipantsList({ activeProjectId }: ParticipantsListProps) {
  const format = useFormatter();
  const t = useTranslations("project.details");

  const { data: participants } = useSuspenseQuery(
    orpcQuery.projects.getParticipants.queryOptions({
      input: {
        projectId: activeProjectId,
      },
    }),
  );

  return (
    <Card tone="subtle">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PROJECT_ICONS.participants className="size-5 text-secondary" />
          {t("participants")}
        </CardTitle>
        <CardDescription>
          {participants?.length || 0} {t("people-joined")}
        </CardDescription>
      </CardHeader>

      {!participants || participants.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users2Icon className="size-12" />
            </EmptyMedia>
            <EmptyTitle>{t("no-participants-yet")}</EmptyTitle>
            <EmptyDescription>
              {t("share-the-participation-link")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <CardContent>
          {participants.map((participant) => (
            <div
              className="flex items-center gap-4 rounded-xl border border-secondary/20 bg-background p-4 transition-colors hover:border-secondary/40 hover:bg-secondary/5"
              key={participant.id}
            >
              <Avatar>
                <AvatarImage
                  alt={participant.user.name}
                  src={participant.user.image || undefined}
                />
                <AvatarFallback>
                  {participant.user.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium">{participant.user.name}</p>
                <p className="text-sm text-muted-foreground">
                  {participant.user.email}
                </p>
              </div>
              <div className="text-sm text-muted-foreground">
                {t("joined-on")}{" "}
                {format.dateTime(participant.createdAt, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

// UNUSED: ParticipantsListSkeleton
// /**
//  * Renders a skeleton placeholder UI for the participants list used while participant data is loading.
//  *
//  * @returns A React element showing an animated card with placeholder rows that mimic participant entries.
//  */
// export function ParticipantsListSkeleton() {
//   const t = useTranslations(\"project.details\");
//   return (
//     <Card className=\"border border-border/60 bg-card/80 shadow-sm\">
//       <CardHeader>
//         <div className=\"flex items-center gap-3\">
//           <div className=\"border border-secondary/30 bg-secondary/10 p-2 text-secondary\">
//             <UsersIcon className=\"size-5\" />
//           </div>
//           <div>
//             <div className=\"animate-pulse text-xs font-medium tracking-[0.2em] text-secondary/70 uppercase\">
//               {t(\"participants\")}
//             </div>
//             <div className=\"mt-1 h-6 w-32 animate-pulse rounded bg-secondary/50\" />
//           </div>
//         </div>
//       </CardHeader>

//       <CardContent>
//         <div className=\"space-y-2\">
//           {Array.from({ length: 7 }).map((_, index) => (
//             <div
//               className=\"flex animate-pulse items-center gap-4 rounded-xl border border-secondary/20 bg-background p-4\"
//               key={index}
//             >
//               <div className=\"size-10 rounded-full bg-secondary/50\" />
//               <div className=\"flex-1 space-y-2\">
//                 <div className=\"h-4 w-1/3 rounded bg-secondary/50\" />
//                 <div className=\"h-3 w-1/2 rounded bg-secondary/50\" />
//               </div>
//               <div className=\"h-3 w-24 rounded bg-secondary/50\" />
//             </div>
//           ))}
//         </div>
//       </CardContent>
//     </Card>
//   );
// }
