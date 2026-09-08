"use client";

import {
  LeafIcon,
  TreePineIcon,
  TrendingDownIcon,
  UsersIcon,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import type { LiveViewProjectStats } from "@/features/liveview/types";

interface StatsOverviewProps {
  stats: LiveViewProjectStats;
}

export function StatsOverview({ stats }: StatsOverviewProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="border-teal-500/30 bg-linear-to-br from-teal-500/20 to-teal-500/5 backdrop-blur-sm">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-sm text-muted-foreground">Participants</p>
              <p className="text-3xl font-bold text-foreground">
                {stats.totalParticipants}
              </p>
            </div>
            <div className="flex size-12 items-center justify-center rounded-full bg-teal-500/20">
              <UsersIcon className="size-6 text-teal-400" />
            </div>
          </div>
        </div>
      </Card>

      <Card className="border-emerald-500/30 bg-linear-to-br from-emerald-500/20 to-emerald-500/5 backdrop-blur-sm">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-sm text-muted-foreground">Total CO₂</p>
              <p className="text-3xl font-bold text-foreground">
                {stats.totalCO2.toFixed(0)}
              </p>
              <p className="text-xs text-muted-foreground">kg emissions</p>
            </div>
            <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/20">
              <LeafIcon className="size-6 text-emerald-400" />
            </div>
          </div>
        </div>
      </Card>

      <Card className="border-cyan-500/30 bg-linear-to-br from-cyan-500/20 to-cyan-500/5 backdrop-blur-sm">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-sm text-muted-foreground">Average CO₂</p>
              <p className="text-3xl font-bold text-foreground">
                {stats.averageCO2.toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground">kg per person</p>
            </div>
            <div className="flex size-12 items-center justify-center rounded-full bg-cyan-500/20">
              <TrendingDownIcon className="size-6 text-cyan-400" />
            </div>
          </div>
        </div>
      </Card>

      <Card className="border-green-500/30 bg-linear-to-br from-green-500/20 to-green-500/5 backdrop-blur-sm">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-sm text-muted-foreground">Trees to Plant</p>
              <p className="text-3xl font-bold text-foreground">
                {stats.treesNeeded}
              </p>
              <p className="text-xs text-muted-foreground">to offset</p>
            </div>
            <div className="flex size-12 items-center justify-center rounded-full bg-green-500/20">
              <TreePineIcon className="size-6 text-green-400" />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
