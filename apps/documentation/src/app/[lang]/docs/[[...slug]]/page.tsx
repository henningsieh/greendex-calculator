import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import { createRelativeLink } from "fumadocs-ui/mdx";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { LLMCopyButton, ViewOptions } from "@/components/ai/page-actions";
import { getMDXComponents } from "@/components/mdx-components";
import { getPageImage, source } from "@/lib/source";

// export default async function Page(props: PageProps<"/[lang]/docs/[[...slug]]">) {

export default function Page(props: PageProps<"/[lang]/docs/[[...slug]]">) {
  return (
    <Suspense fallback={<DocsContentSkeleton />}>
      <LocalizedDocsPage {...props} />
    </Suspense>
  );
}

async function LocalizedDocsPage(props: PageProps<"/[lang]/docs/[[...slug]]">) {
  const { slug, lang } = await props.params;

  const page = source.getPage(slug, lang);

  if (!page) notFound();

  const MDX = page.data.body;
  const gitConfig = {
    user: "username",
    repo: "repo",
    branch: "main",
  };

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className="mb-0">{page.data.description}</DocsDescription>
      <div className="flex flex-row items-center gap-2 border-b pb-6">
        <LLMCopyButton markdownUrl={`${page.url}.mdx`} />
        <ViewOptions
          markdownUrl={`${page.url}.mdx`}
          // update it to match your repo
          githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/docs/content/docs/${page.path}`}
        />
      </div>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  // return source.generateParams();
  return source.generateParams("slug", "locale");
}

function DocsContentSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-4">
      <div className="h-10 w-1/2 animate-pulse rounded-xl bg-muted/60" />
      <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
      <div className="h-4 w-5/6 animate-pulse rounded bg-muted/40" />
      <div className="h-4 w-2/3 animate-pulse rounded bg-muted/40" />
      <div className="h-64 w-full animate-pulse rounded-xl bg-muted/40" />
    </div>
  );
}

export async function generateMetadata(
  props: PageProps<"/[lang]/docs/[[...slug]]">,
): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      images: getPageImage(page).url,
    },
  };
}
