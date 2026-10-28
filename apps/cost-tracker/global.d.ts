// global.d.ts

import type { Messages } from "./src/messages/en";

declare module "next-intl" {
  interface AppConfig {
    Messages: Messages;
  }
}

// This declaration tells TypeScript that any file ending in '.css'
declare module "*.css";
