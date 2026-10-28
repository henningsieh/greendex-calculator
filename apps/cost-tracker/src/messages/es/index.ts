import { mergeMessages } from "@/messages/merge";

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
