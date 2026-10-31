"use client";

/**
 * Mock live-view dashboard.
 *
 * This click-dummy intentionally owns generated Participant Travel Legs locally. It
 * has no participant-travel persistence, questionnaire persistence, or real-time
 * backend; a future implementation can replace the mock state with a live feed.
 */

import { MapPinnedIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Leaderboard } from "@/features/liveview/leaderboard";
import { LiveIndicator } from "@/features/liveview/live-indicator";
import {
  calculateLiveViewStats,
  createMockParticipantTravelLeg,
} from "@/features/liveview/mock-participant-travel";
import { StatsOverview } from "@/features/liveview/stats-overview";
import { TransportBreakdown } from "@/features/liveview/transport-breakdown";
import type { LiveViewParticipant } from "@/features/liveview/types";
import { useHydrated } from "@/hooks/use-hydrated";

function generateMockParticipants(): LiveViewParticipant[] {
  const names = [
    "Emma Schmidt",
    "Lucas Dubois",
    "Sofia Rossi",
    "Miguel Santos",
    "Anna Kowalski",
    "Jonas Nielsen",
    "Maria Garcia",
    "Lukas Müller",
    "Elena Popescu",
    "Dimitri Ivanov",
    "Chiara Bianchi",
    "Oscar Andersson",
  ];
  const countries = [
    "Germany",
    "France",
    "Italy",
    "Portugal",
    "Poland",
    "Denmark",
    "Spain",
    "Austria",
    "Romania",
    "Bulgaria",
    "Italy",
    "Sweden",
  ];

  return names.map((name, index) => {
    const participantTravelLegs = Array.from(
      { length: Math.floor(Math.random() * 3) + 1 },
      (_, legIndex) => createMockParticipantTravelLeg(`${index}-${legIndex}`),
    );

    return {
      id: `participant-${index}`,
      name,
      country: countries[index],
      participantTravelLegs,
      totalCO2: participantTravelLegs.reduce(
        (total, leg) => total + leg.co2Kg,
        0,
      ),
    };
  });
}

function DashboardLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="mx-auto mb-4 size-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const hydrated = useHydrated();

  if (!hydrated) {
    return <DashboardLoading />;
  }

  return <LiveViewDashboard />;
}

function LiveViewDashboard() {
  const [participants, setParticipants] = useState<LiveViewParticipant[]>(
    generateMockParticipants,
  );
  const stats = useMemo(
    () => calculateLiveViewStats(participants),
    [participants],
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setParticipants((previousParticipants) => {
        const participantIndex = Math.floor(
          Math.random() * previousParticipants.length,
        );
        const newLeg = createMockParticipantTravelLeg(`${Date.now()}`);

        return previousParticipants.map((participant, index) => {
          if (index !== participantIndex) return participant;

          const participantTravelLegs = [
            ...participant.participantTravelLegs,
            newLeg,
          ].slice(-50);

          return {
            ...participant,
            participantTravelLegs,
            totalCO2: participantTravelLegs.reduce(
              (total, leg) => total + leg.co2Kg,
              0,
            ),
          };
        });
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  if (!stats) {
    return <DashboardLoading />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="relative">
        <div className="sticky top-0 z-10 border-b border-primary/20 bg-background/80 backdrop-blur-md">
          <div className="container mx-auto px-4 py-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-xl bg-linear-to-br from-teal-600 to-emerald-800">
                  <MapPinnedIcon className="size-7" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-foreground">
                    Mock Project Name
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Project&apos;s welcome message or tagline goes here
                  </p>
                </div>
              </div>
              <LiveIndicator />
            </div>
          </div>
        </div>

        <div className="container mx-auto space-y-8 px-4 py-8">
          <StatsOverview stats={stats} />
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Leaderboard participants={participants} />
            </div>
            <div className="lg:col-span-1">
              <TransportBreakdown stats={stats} />
            </div>
          </div>
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              🌱 Together we&apos;re creating a greener future • Every journey
              counts • Plant trees, offset carbon
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
