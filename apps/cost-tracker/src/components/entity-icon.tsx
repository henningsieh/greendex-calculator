import { cn } from "cn";
import type { LucideProps } from "lucide-react";
import {
  Building2Icon,
  FolderKanbanIcon,
  UserRoundCogIcon,
  UsersIcon,
} from "lucide-react";

/* Central entity → icon mapping. An Organization, Project or Partner
   Organization always renders with the same icon everywhere (nav tabs,
   switchers, cards, empty states). Extend the registry for new entities;
   never inline another Lucide icon for these four. */
export const ENTITY_ICONS = {
  account: UserRoundCogIcon,
  organization: UsersIcon,
  project: FolderKanbanIcon,
  partnerOrganization: Building2Icon,
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
