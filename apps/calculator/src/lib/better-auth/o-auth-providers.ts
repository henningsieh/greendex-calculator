import { GoogleIcon, GitHubIcon, DiscordIcon } from "@greendex/auth/oauth-icons";
import type { ComponentProps, ElementType } from "react";

export const SUPPORTED_OAUTH_PROVIDERS = ["google", "discord", "github"] as const;
export type SupportedOAuthProvider = (typeof SUPPORTED_OAUTH_PROVIDERS)[number];

export const SUPPORTED_OAUTH_PROVIDER_DETAILS: Record<
  SupportedOAuthProvider,
  {
    name: string;
    Icon: ElementType<ComponentProps<"svg">>;
  }
> = {
  google: {
    name: "Google",
    Icon: GoogleIcon,
  },
  discord: {
    name: "Discord",
    Icon: DiscordIcon,
  },
  github: {
    name: "GitHub",
    Icon: GitHubIcon,
  },
};
