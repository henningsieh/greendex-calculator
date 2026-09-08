"use client";

import { LeafIcon, TrophyIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { LiveViewParticipant } from "@/features/liveview/types";
import { cn } from "@/lib/utils";

interface LeaderboardProps {
  participants: LiveViewParticipant[];
}

export function Leaderboard({ participants }: LeaderboardProps) {
  // Sort by lowest CO₂ (most sustainable)
  const sortedParticipants = [...participants].sort(
    (a, b) => a.totalCO2 - b.totalCO2,
  );

  return (
    <Card className="overflow-hidden border-primary/20 bg-card/50 backdrop-blur-sm">
      <div className="border-b border-primary/20 bg-linear-to-r from-teal-500/20 to-emerald-500/20 px-6 py-4">
        <div className="flex items-center gap-3">
          <TrophyIcon className="size-6 text-teal-400" />
          <h2 className="text-2xl font-bold text-foreground">
            Sustainability Champions
          </h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Ranked by lowest CO₂ emissions
        </p>
      </div>

      <div className="divide-y divide-border/50">
        {sortedParticipants.map((participant, index) => {
          const isTopThree = index < 3;
          const medals = ["🥇", "🥈", "🥉"];

          return (
            <div
              className={cn(
                "px-6 py-4 transition-all duration-300 hover:bg-accent/50",
                isTopThree && "bg-linear-to-r from-teal-500/5 to-emerald-500/5",
              )}
              key={participant.id}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    {isTopThree ? (
                      <span className="text-2xl">{medals[index]}</span>
                    ) : (
                      <span className="text-lg font-bold text-muted-foreground">
                        #{index + 1}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold text-foreground">
                        {participant.name}
                      </h3>
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        {participant.country}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {participant.participantTravelLegs.length}{" "}
                      {participant.participantTravelLegs.length === 1
                        ? "journey"
                        : "journeys"}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <LeafIcon className="size-4 text-emerald-400" />
                    <span className="text-2xl font-bold text-teal-400">
                      {participant.totalCO2.toFixed(1)}
                    </span>
                    <span className="text-sm text-muted-foreground">kg CO₂</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
