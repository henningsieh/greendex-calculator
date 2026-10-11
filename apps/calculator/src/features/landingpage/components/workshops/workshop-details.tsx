"use client";

import { WORKSHOP_LINKS } from "@greendex/config/workshops";
import { useTranslations } from "@greendex/i18n/client";
import { CheckCircle2Icon, ExternalLinkIcon } from "lucide-react";

import { DASHBOARD_PATH } from "@/app/routes";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { WorkshopType } from "@/features/landingpage/types";
import { Link } from "@/lib/i18n/routing";

/**
 * Render workshop detail UI for the specified workshop type.
 *
 * Renders the workshop header, sections (with steps and optional links), and a call-to-action
 * based on translation keys for the provided `type`.
 *
 * @param type - The workshop `CalculatorType` used to select translations and section/step content.
 * @returns A React element containing the full workshop details UI for the given `type`.
 */
export function WorkshopDetails({ type }: { type: WorkshopType }) {
  const t = useTranslations("landingPage.workshops");

  // Helper to get link configuration for a step
  const getStepLinks = (
    stepKey: string,
  ): {
    linkKey: string;
    href: string;
    isExternal: boolean;
  }[] => {
    const linkMap: Record<
      string,
      {
        linkKey: string;
        href: string;
        isExternal: boolean;
      }[]
    > = {
      create: [
        {
          linkKey: "openApp",
          href: DASHBOARD_PATH,
          isExternal: false,
        },
      ],
      map: [
        {
          linkKey: "erasmusCalculator",
          href: WORKSHOP_LINKS.erasmusCalculator,
          isExternal: true,
        },
        {
          linkKey: "googleMaps",
          href: WORKSHOP_LINKS.googleMaps,
          isExternal: true,
        },
      ],
      plant: [
        {
          linkKey: "eForest",
          href: WORKSHOP_LINKS.eForest,
          isExternal: true,
        },
      ],
      read: [
        {
          linkKey: "challengesDescription",
          href: WORKSHOP_LINKS.challengesDescription,
          isExternal: true,
        },
      ],
      present: [
        {
          linkKey: "challengesPresentation",
          href: WORKSHOP_LINKS.challengesPresentation,
          isExternal: true,
        },
      ],
      introduce: [
        {
          linkKey: "greendexWebsite",
          href: WORKSHOP_LINKS.greendexWebsite,
          isExternal: true,
        },
      ],
    };

    return linkMap[stepKey] || [];
  };

  // Get workshop metadata from translations
  const title = t(`types.${type}.title`);
  const duration = t(`types.${type}.duration`);
  const description = t(`types.${type}.description`);

  // Get sections for this workshop type
  const sectionsData = t.raw(`details.${type}.sections`) as Record<
    string,
    {
      title: string;
      steps: Record<
        string,
        {
          title: string;
          content: string;
        }
      >;
    }
  >;

  return (
    <>
      {/* Header */}
      <div className="space-y-4 text-center">
        <h2 className="text-3xl font-semibold lg:text-4xl">{title}</h2>
        <Badge className="px-4 pt-1 text-sm" variant="secondary">
          {duration}
        </Badge>
        <p className="mx-auto max-w-5xl text-lg text-muted-foreground">
          {description}
        </p>
      </div>

      <Separator className="my-12" />

      {/* Workshop Sections */}
      <div className="space-y-8">
        {Object.entries(sectionsData).map(([sectionKey, section]) => (
          <Card key={sectionKey}>
            <CardHeader>
              <CardTitle className="text-2xl">{section.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion className="w-full" collapsible type="single">
                {Object.entries(section.steps).map(([stepKey, step], stepIdx) => {
                  const links = getStepLinks(stepKey);

                  return (
                    <AccordionItem
                      key={stepKey}
                      value={`step-${sectionKey}-${stepKey}`}
                    >
                      <AccordionTrigger className="text-left">
                        <div className="flex items-start gap-3">
                          <CheckCircle2Icon className="mt-1 size-5 shrink-0 text-primary" />
                          <span className="font-medium">
                            {stepIdx + 1}. {step.title}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pl-8">
                        <div className="space-y-4">
                          <div className="whitespace-pre-line text-muted-foreground">
                            {step.content}
                          </div>
                          {links.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {links.map((link) => (
                                <Button
                                  asChild
                                  key={link.linkKey}
                                  size="sm"
                                  variant="outline"
                                >
                                  {link.isExternal ? (
                                    <a
                                      className="inline-flex items-center gap-2"
                                      href={link.href}
                                      rel="noopener noreferrer"
                                      target="_blank"
                                    >
                                      {t(`links.${link.linkKey}`)}
                                      <ExternalLinkIcon className="size-3" />
                                    </a>
                                  ) : (
                                    <Link href={link.href}>
                                      {t(`links.${link.linkKey}`)}
                                    </Link>
                                  )}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Call to Action */}
      <Card className="mt-12 border-primary/20">
        <CardHeader>
          <CardTitle>Ready to Start?</CardTitle>
          <CardDescription>
            Begin your carbon footprint calculation journey today
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href={DASHBOARD_PATH}>{t("links.openApp")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/#workshops">View All Workshops</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
