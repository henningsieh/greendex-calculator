import { mergeMessages } from "@/messages/merge";

import apiErrors from "./apiErrors.json";
import claims from "./claims.json";
import common from "./common.json";
import onboarding from "./onboarding.json";
import organizations from "./organizations.json";
import participations from "./participations.json";
import partnerships from "./partnerships.json";
import projects from "./projects.json";
import settings from "./settings.json";
import shell from "./shell.json";

const messages = mergeMessages([
  apiErrors,
  claims,
  common,
  onboarding,
  organizations,
  participations,
  partnerships,
  projects,
  settings,
  shell,
]);

export default messages;

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };

export type Messages = Widen<typeof messages>;
