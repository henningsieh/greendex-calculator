// global.d.ts

export {};

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

// This declaration tells TypeScript that any file ending in '.css'
declare module "*.css";
