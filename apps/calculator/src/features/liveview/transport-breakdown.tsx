"use client";

import { PARTICIPANT_TRANSPORT_EMISSION_PROFILES } from "@greendex/config/transport-emission-profiles";

import { Card } from "@/components/ui/card";
import { getParticipantTravelLegPresentation } from "@/features/liveview/participant-travel-leg-presentation";
import type { LiveViewProjectStats } from "@/features/liveview/types";

interface TransportBreakdownProps {
  stats: LiveViewProjectStats;
}

/** Render the mock live view's Participant Travel Leg emissions by profile. */
export function TransportBreakdown({ stats }: TransportBreakdownProps) {
  const maxCO2 = Math.max(
    ...PARTICIPANT_TRANSPORT_EMISSION_PROFILES.map(
      (profile) => stats.breakdownByProfile[profile].co2,
    ),
  );

  return (
    <Card tone="glass">
      <div className="border-b border-primary/20 px-6 py-4">
        <h2 className="text-xl font-bold text-foreground">
          Participant Travel Leg CO₂ Breakdown
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Emissions by Transport Emission Profile
        </p>
      </div>

      <div className="space-y-6 p-6">
        {PARTICIPANT_TRANSPORT_EMISSION_PROFILES.map((profile) => {
          const data = stats.breakdownByProfile[profile];
          const percentage = maxCO2 > 0 ? (data.co2 / maxCO2) * 100 : 0;
          const { color, Icon, label } =
            getParticipantTravelLegPresentation(profile);

          return (
            <div className="space-y-2" key={profile}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="size-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">
                      {data.count} {data.count === 1 ? "trip" : "trips"} •{" "}
                      {data.distance.toFixed(0)} km
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-foreground">
                    {data.co2.toFixed(1)}
                  </p>
                  <p className="text-xs text-muted-foreground">kg CO₂</p>
                </div>
              </div>

              <div className="relative h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className={`absolute inset-y-0 left-0 ${color} rounded-full transition-all duration-500`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
