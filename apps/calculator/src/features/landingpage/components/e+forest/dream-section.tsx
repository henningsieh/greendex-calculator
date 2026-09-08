import { eForestConfig } from "@greendex/config/e-forest";
import { useTranslations } from "@greendex/i18n/client";
import { ExternalLinkIcon, MapPinIcon, TreesIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/lib/i18n/routing";

export function DreamSection() {
  const t = useTranslations("landingPage.EPlusForest.dream");

  return (
    <section className="py-12">
      <div className="container mx-auto max-w-7xl px-4 text-center">
        <h2 className="mb-8 text-3xl font-bold md:text-4xl lg:text-5xl">
          {t("title")}
        </h2>
        <div className="space-y-6 text-lg text-muted-foreground lg:text-xl">
          <p>{t("p1")}</p>
          <p>{t("p2")}</p>

          <Separator className="mx-auto my-8 max-w-5xl" />

          {/* Forest Initiatives */}
          <div className="mx-auto max-w-5xl">
            <h3 className="mb-6 text-2xl font-semibold text-foreground md:text-3xl">
              {t("ourForests.title")}
            </h3>
            <div className="grid gap-6 md:grid-cols-2">
              {/* Portugal Forest */}
              <Card className="text-left transition-shadow hover:shadow-lg">
                <CardHeader>
                  <div className="mb-2 flex items-center gap-2">
                    <TreesIcon className="size-5 text-green-600" />
                    <Badge className="bg-green-600/10 text-green-700 dark:bg-green-400/10 dark:text-green-400">
                      {t("ourForests.portugal.status")}
                    </Badge>
                  </div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <MapPinIcon className="size-4" />
                    {t("ourForests.portugal.location")}
                  </CardTitle>
                  <CardDescription className="text-base">
                    {t("ourForests.portugal.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg bg-muted/50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {t("ourForests.portugal.treesLabel")}
                      </span>
                      <span className="text-2xl font-bold text-foreground">
                        100+
                      </span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                  <Button asChild className="w-full" variant="outline">
                    <Link href={eForestConfig.links.article1} target="_blank">
                      <ExternalLinkIcon className="mr-2 size-4" />
                      {t("ourForests.readArticle")}
                    </Link>
                  </Button>
                  <Button asChild className="w-full" size="sm" variant="ghost">
                    <Link href={eForestConfig.links.article2} target="_blank">
                      {t("ourForests.readMore")}
                    </Link>
                  </Button>
                </CardFooter>
              </Card>

              {/* Other Locations */}
              <Card className="text-left transition-shadow hover:shadow-lg">
                <CardHeader>
                  <div className="mb-2 flex items-center gap-2">
                    <TreesIcon className="size-5 text-emerald-600" />
                    <Badge className="bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400">
                      {t("ourForests.expanding.status")}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl">
                    {t("ourForests.expanding.title")}
                  </CardTitle>
                  <CardDescription className="text-base">
                    {t("ourForests.expanding.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <MapPinIcon className="size-4 text-muted-foreground" />
                    <span className="text-sm">
                      {t("ourForests.expanding.slovenia")}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPinIcon className="size-4 text-muted-foreground" />
                    <span className="text-sm">
                      {t("ourForests.expanding.cyprus")}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPinIcon className="size-4 text-muted-foreground" />
                    <span className="text-sm">
                      {t("ourForests.expanding.netherlands")}
                    </span>
                  </div>
                </CardContent>
                <CardFooter>
                  <p className="text-sm text-muted-foreground italic">
                    {t("ourForests.expanding.joinUs")}
                  </p>
                </CardFooter>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
