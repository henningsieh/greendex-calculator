#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function readPkgVersion() {
  const pkgPath = path.resolve(process.cwd(), "package.json");
  if (!fs.existsSync(pkgPath)) {
    console.error(`package.json not found at ${pkgPath}`);
    process.exit(1);
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const v = pkg?.config?.scalarVersion;
  if (!v) {
    console.error(
      "package.json: config.scalarVersion is not set. Please set it to the desired Scalar version.",
    );
    process.exit(1);
  }
  return String(v);
}

function readGeneratedVersion() {
  const outPath = path.resolve(process.cwd(), "src/lib/orpc/scalar-sri.ts");
  if (!fs.existsSync(outPath)) {
    console.error(
      `${outPath} not found. Run 'pnpm run generate:sri' to generate it.`,
    );
    process.exit(1);
  }
  const content = fs.readFileSync(outPath, "utf8");
  const match = content.match(/SCALAR_VERSION\s*=\s*["']([^"']+)["']/);
  if (!match) {
    console.error(
      `${outPath} doesn't contain SCALAR_VERSION. The file may be malformed.`,
    );
    process.exit(1);
  }
  return match[1];
}

const pkgVersion = readPkgVersion();
const genVersion = readGeneratedVersion();

if (pkgVersion !== genVersion) {
  console.error(
    `Scalar version mismatch:\n  package.json config.scalarVersion = "${pkgVersion}"\n  src/lib/orpc/scalar-sri.ts SCALAR_VERSION = "${genVersion}"\n\nRun 'pnpm run generate:sri' to regenerate the SRI file or update package.json to the desired version.`,
  );
  process.exit(2);
}

console.log(
  `OK: SCALAR_VERSION (${genVersion}) matches package.json config.scalarVersion.`,
);
process.exit(0);
