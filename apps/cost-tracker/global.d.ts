// global.d.ts

import messages from "./src/messages/en.json";

declare module "next-intl" {
  interface AppConfig {
    Messages: typeof messages;
  }
}

// This declaration tells TypeScript that any file ending in '.css'
declare module "*.css";
