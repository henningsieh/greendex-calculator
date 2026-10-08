import { generate as DefaultImage } from "fumadocs-ui/og";
import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";

import { getPageImage, source } from "@/lib/source";

/**
 * Return cached title and description for a page in the default documentation
 * language, or null if absent, using the `max` profile. The last slug segment
 * is treated as the image filename and discarded without validation.
 */
async function getOgData(
  slug: string[],
): Promise<{ title: string; description?: string } | null> {
  "use cache";
  cacheLife("max");

  const page = source.getPage(slug.slice(0, -1));
  if (!page) return null;
  return { title: page.data.title, description: page.data.description };
}

/**
 * Return a 1200 by 630 pixel Open Graph image for the requested page.
 * The last slug segment is discarded for lookup, and the route language is
 * ignored in favor of the default documentation language. Missing pages
 * trigger Next.js not-found handling.
 */
export async function GET(
  _req: Request,
  { params }: RouteContext<"/[lang]/og/docs/[...slug]">,
) {
  const { slug } = await params;
  const data = await getOgData(slug);
  if (!data) notFound();

  return new ImageResponse(
    <DefaultImage
      title={data.title}
      description={data.description}
      site="My App"
    />,
    {
      width: 1200,
      height: 630,
    },
  );
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({
    lang: page.locale,
    slug: getPageImage(page).segments,
  }));
}
