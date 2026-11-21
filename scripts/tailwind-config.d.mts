export declare const SCRIPT_DIR: string;
export declare const ROOT: string;
export declare const TAILWIND_CONFIG_FILE: string;
export declare const TAILWIND_REM: number;
export declare const TAILWIND_SOURCE_GLOBS: string[];
export declare const TAILWIND_EXCLUDE_GLOBS: string[];

export declare function isTailwindSourcePath(file: string): boolean;
export declare function tailwindOxlintArgs(options?: {
  fix?: boolean;
  files?: string[];
}): string[];
