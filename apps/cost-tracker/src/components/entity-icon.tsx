import { cn } from "cn";
import type { LucideProps } from "lucide-react";
import {
  BuildingComplexIcon,
  ClipboardCheckIcon,
  FolderKanbanIcon,
  HotelIcon,
  UserRoundCogIcon,
} from "lucide-react";

/* Central entity → icon mapping. An Organization, Project, Partner
   Organization, Claim or Account always renders with the same icon everywhere
   (nav tabs, switchers, cards, empty states). Extend the registry for new
   entities; never inline another Lucide icon for these five. */
export const ENTITY_ICONS = {
  account: UserRoundCogIcon,
  project: FolderKanbanIcon,
  organization: BuildingComplexIcon,
  partnerOrganization: HotelIcon,
  claim: ClipboardCheckIcon,
} as const;

export type EntityKind = keyof typeof ENTITY_ICONS;

export function EntityIcon({
  entity,
  className,
  ...props
}: { entity: EntityKind; className?: string } & Omit<
  LucideProps,
  "aria-hidden"
>) {
  const Icon = ENTITY_ICONS[entity];
  return <Icon aria-hidden="true" className={cn(className)} {...props} />;
}
