import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const configFile = ".oxlintrc.json";

export type Diagnostic = {
  code: string;
  severity: string;
  filename: string;
  message: string;
  line: number;
  column: number;
};

type JsonDiagnostic = {
  code: string;
  severity: string;
  filename: string;
  message: string;
  labels?: { span?: { line?: number; column?: number } }[];
};

/**
 * Lint one throwaway fixture and return oxlint's JSON report.
 *
 * The repository config applies unless `config` replaces it, so a case either
 * exercises the real rule wiring or the plugin alone. Findings are read from
 * `--format json`: the human-readable report changes shape with the reporter
 * and the terminal, which makes text assertions fragile.
 */
export function lint({
  source,
  app = "cost-tracker",
  file = "validation-schemas.ts",
  config,
}: {
  source: string;
  app?: string;
  file?: string;
  config?: unknown;
}): { status: number | null; diagnostics: Diagnostic[] } {
  const fixture = mkdtempSync(join(tmpdir(), "oxlint-fixture-"));
  try {
    const path = `apps/${app}/src/features/example/${file}`;
    mkdirSync(dirname(join(fixture, path)), { recursive: true });
    mkdirSync(join(fixture, "scripts"));
    symlinkSync(join(root, "node_modules"), join(fixture, "node_modules"), "dir");
    for (const name of ["oxlint-domain.mjs", "oxlint-i18n.mjs"])
      copyFileSync(join(root, "scripts", name), join(fixture, "scripts", name));
    if (config) writeFileSync(join(fixture, configFile), JSON.stringify(config));
    else copyFileSync(join(root, configFile), join(fixture, configFile));
    writeFileSync(join(fixture, path), source);

    const result = spawnSync(
      join(root, "node_modules/.bin/oxlint"),
      ["--format", "json", "--config", configFile, path],
      { cwd: fixture, encoding: "utf8" },
    );
    if (result.error) throw result.error;

    const report = JSON.parse(result.stdout) as {
      diagnostics?: JsonDiagnostic[];
    };
    return {
      status: result.status,
      diagnostics: (report.diagnostics ?? []).map((diagnostic) => ({
        code: diagnostic.code,
        severity: diagnostic.severity,
        filename: diagnostic.filename,
        message: diagnostic.message,
        line: diagnostic.labels?.[0]?.span?.line ?? 0,
        column: diagnostic.labels?.[0]?.span?.column ?? 0,
      })),
    };
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

export const byCode = (diagnostics: Diagnostic[], code: string) =>
  diagnostics.filter((diagnostic) => diagnostic.code === code);

export const severities = (diagnostics: Diagnostic[], code: string) =>
  byCode(diagnostics, code).map((diagnostic) => diagnostic.severity);

export const lines = (diagnostics: Diagnostic[], code: string) =>
  byCode(diagnostics, code).map((diagnostic) => diagnostic.line);
