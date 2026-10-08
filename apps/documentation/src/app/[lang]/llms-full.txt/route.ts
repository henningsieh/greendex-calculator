import { LANGUAGE_CODES } from "@greendex/config/languages";
import { cacheLife } from "next/cache";

import { getLLMText, source } from "@/lib/source";

/**
 * Return cached page titles and processed Markdown from all documentation
 * languages, separated by blank lines, using the `max` cache profile.
 * Page text loading failures reject the result; no partial text is returned.
 */
async function getFullLLMText(): Promise<string> {
  "use cache";
  cacheLife("max");

  const scan = source.getPages().map(getLLMText);
  const scanned = await Promise.all(scan);
  return scanned.join("\n\n");
}

/**
 * Serve the combined documentation text for all languages regardless of the
 * route language. Text loading failures propagate.
 */
export async function GET() {
  return new Response(await getFullLLMText());
}

/**
 * Return one route parameter set per configured documentation language
 * for prerendering.
 */
export function generateStaticParams() {
  return LANGUAGE_CODES.map((lang) => ({ lang }));
}
