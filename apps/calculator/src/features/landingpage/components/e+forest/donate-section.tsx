"use client";

import { eForestConfig } from "@greendex/config/e-forest";
import { useTranslations } from "@greendex/i18n/client";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/lib/i18n/routing";

const HowItWorksIcon = eForestConfig.icons.howItWorks;
const PlantingIcon = eForestConfig.icons.planting;
const ContactIcon = eForestConfig.icons.contact;

export function DonateSection() {
  const t = useTranslations("landingPage.EPlusForest");

  return (
    <section className="space-y-12 bg-muted/50 py-12">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl lg:text-5xl">
            {t("donate.title")}
          </h2>
          <p className="mx-auto text-lg text-muted-foreground lg:text-xl">
            {t("donate.description")}
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-2">
          {/* How it works */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <HowItWorksIcon className="size-5" />
                </div>
                <span>{t("donate.howItWorks.title")}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grow space-y-4">
              <p className="text-lg text-muted-foreground">
                {t("donate.howItWorks.p1")}
              </p>
              <p className="text-lg text-muted-foreground">
                {t("donate.howItWorks.p2")}
              </p>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 sm:flex-row">
              <Button asChild className="w-full" size="lg">
                <Link href={eForestConfig.links.calculator} target="_blank">
                  <HowItWorksIcon className="mr-2 size-4" />
                  {t("donate.calculatorButton")}
                </Link>
              </Button>
            </CardFooter>
          </Card>

          {/* We plant trees */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <PlantingIcon className="size-5" />
                </div>
                <span>{t("donate.wePlantTrees.title")}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grow space-y-4">
              <p className="text-lg text-muted-foreground">
                {t("donate.wePlantTrees.p1")}
              </p>
              <p className="text-lg text-muted-foreground">
                {t("donate.wePlantTrees.p2")}
              </p>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 sm:flex-row">
              <Button asChild className="w-full" size="lg" variant="outline">
                <Link href={eForestConfig.links.email}>
                  <ContactIcon className="mr-2 size-4" />
                  {t("donate.contactButton")}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      <div className="container mx-auto flex flex-col items-center justify-center gap-4 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          {t("funding.text")}
        </p>
        <div className="relative h-16 w-60">
          {/* Eager load (no IntersectionObserver wait) but keep low fetch priority. Do NOT use `priority` to avoid preloading. */}
          <Image
            alt="European Commission Logo"
            className="object-contain"
            decoding="async"
            fetchPriority="low"
            fill
            loading="eager"
            quality={70}
            sizes="240px"
            src={eForestConfig.fundingLogo}
          />
        </div>
      </div>
    </section>
  );
}
