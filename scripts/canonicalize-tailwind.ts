import {
  changedTailwindSources,
  createTailwindCanonicalizer,
} from "./tailwind-canonical";
import { ROOT } from "./tailwind-config.mjs";

async function main() {
  const explicit = process.argv.slice(2);
  const files = explicit.length ? explicit : changedTailwindSources(ROOT);
  const canonicalizer = await createTailwindCanonicalizer();
  const changed = await canonicalizer.canonicalizeFiles(files, { root: ROOT });
  console.log(`Tailwind canonicalizer updated ${changed} file(s).`);
}

void main();
