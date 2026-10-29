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
