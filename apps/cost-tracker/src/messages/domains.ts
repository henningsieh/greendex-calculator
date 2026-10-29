export const messageDomains = [
  "claims",
  "common",
  "onboarding",
  "organizations",
  "participations",
  "partnerships",
  "projects",
  "settings",
  "shell",
] as const;

export type MessageDomain = (typeof messageDomains)[number];

export const messageBundleRoutes = [
  ["features/authentication/", "onboarding"],
  ["features/participant-onboarding/", "participations"],
  ["features/user-settings/", "settings"],
  ["features/claims/", "claims"],
  ["features/organizations/", "organizations"],
  ["features/participations/", "participations"],
  ["features/partnerships/", "partnerships"],
  ["features/projects/", "projects"],
  ["components/confirm-dialog.tsx", "common"],
  ["components/", "shell"],
  ["app/(protected)/projects/[id]/participants/", "participations"],
  ["app/(protected)/partnerships/[id]/participants/", "participations"],
  ["app/(protected)/partnerships/[id]/claim/", "claims"],
  ["app/(protected)/claims/", "claims"],
  ["app/(protected)/organization/", "organizations"],
  ["app/(protected)/partner-organizations/", "partnerships"],
  ["app/(protected)/projects/", "projects"],
  ["app/(protected)/user-settings/", "settings"],
  ["app/(auth)/", "onboarding"],
  ["app/(setup)/setup-links/", "partnerships"],
  ["app/(setup)/participant/", "participations"],
  ["app/(setup)/participant-invitations/", "participations"],
  ["app/(setup)/participant-links/", "participations"],
  ["app/(setup)/", "onboarding"],
  ["app/design-system/", "shell"],
  ["app/page.tsx", "shell"],
] as const satisfies readonly (readonly [string, MessageDomain])[];

export function getMessageDomain(sourcePath: string): MessageDomain | undefined {
  return messageBundleRoutes.find(([prefix]) =>
    sourcePath.startsWith(prefix),
  )?.[1];
}
