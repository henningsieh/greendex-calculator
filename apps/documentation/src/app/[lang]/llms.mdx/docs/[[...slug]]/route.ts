import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";

import { getLLMText, source } from "@/lib/source";

/**
 * Return the page title and processed Markdown in the default documentation
 * language, or null if the page is absent, cached with the `max` profile.
 * An undefined slug selects the root page. Text loading failures propagate.
 */
async function getPageMarkdown(
  slug: string[] | undefined,
): Promise<string | null> {
  "use cache";
  cacheLife("max");

  const page = source.getPage(slug);
  if (!page) return null;
  return getLLMText(page);
}

/**
 * Serve `text/markdown` for the slug in the default documentation language;
 * the route language is not used for lookup. Missing pages trigger Next.js
 * not-found handling, while text loading failures propagate.
 */
export async function GET(
  _req: Request,
  { params }: RouteContext<"/[lang]/llms.mdx/docs/[[...slug]]">,
) {
  const { slug } = await params;
  const text = await getPageMarkdown(slug);
  if (text === null) notFound();

  return new Response(text, {
    headers: {
      "Content-Type": "text/markdown",
    },
  });
}

export function generateStaticParams() {
  return source.generateParams();
}
