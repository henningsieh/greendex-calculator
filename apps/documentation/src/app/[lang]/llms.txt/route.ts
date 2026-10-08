import { LANGUAGE_CODES } from "@greendex/config/languages";
import { cacheLife } from "next/cache";

import { source } from "@/lib/source";

/**
 * Return a Markdown index of titles, URLs, and descriptions from all
 * documentation languages, cached with the `max` profile.
 */
async function getLLMIndex(): Promise<string> {
  "use cache";
  cacheLife("max");

  const lines: string[] = [];
  lines.push("# Documentation");
  lines.push("");
  for (const page of source.getPages()) {
    lines.push(`- [${page.data.title}](${page.url}): ${page.data.description}`);
  }
  return lines.join("\n");
}

/**
 * Serve the cached documentation index for all languages regardless of
 * the route language.
 */
export async function GET() {
  return new Response(await getLLMIndex());
}

/**
 * Return one route parameter set per configured documentation language
 * for prerendering.
 */
export function generateStaticParams() {
  return LANGUAGE_CODES.map((lang) => ({ lang }));
}
