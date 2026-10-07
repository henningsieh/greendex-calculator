import { LANGUAGE_CODES } from "@greendex/config/languages";
import { cacheLife } from "next/cache";

import { source } from "@/lib/source";

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

export async function GET() {
  return new Response(await getLLMIndex());
}

export function generateStaticParams() {
  return LANGUAGE_CODES.map((lang) => ({ lang }));
}
