import { RadioIcon } from "lucide-react";

export function LiveIndicator() {
  return (
    <div className="flex items-center gap-2 rounded-full border border-red-500/50 bg-red-500/20 px-4 py-2">
      <RadioIcon className="size-% animate-pulse text-red-500" />
      <span className="text-sm font-semibold text-red-500">LIVE</span>
    </div>
  );
}
