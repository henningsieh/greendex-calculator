// global.d.ts

import apiErrors from "./src/messages/api-errors/en.json";
import messages from "./src/messages/en.json";

declare module "next-intl" {
  interface AppConfig {
    Messages: typeof messages & { apiErrors: typeof apiErrors };
  }
}

// This declaration tells TypeScript that any file ending in '.css'
declare module "*.css";
