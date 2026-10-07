import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";

import { getLLMText, source } from "@/lib/source";

async function getPageMarkdown(
  slug: string[] | undefined,
): Promise<string | null> {
  "use cache";
  cacheLife("max");

  const page = source.getPage(slug);
  if (!page) return null;
  return getLLMText(page);
}

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
