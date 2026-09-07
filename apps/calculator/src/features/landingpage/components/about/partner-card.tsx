import type { Partner } from "@greendex/config/partners";
import { getLocale, getTranslations } from "@greendex/i18n/server";
import { ExternalLinkIcon } from "lucide-react";
import Image from "next/image";

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
import { getCountryData } from "@/lib/i18n/countries";
import { Link } from "@/lib/i18n/routing";

interface PartnerCardProps {
  partner: Partner;
}

export async function PartnerCard({ partner }: PartnerCardProps) {
  const t = await getTranslations("landingPage.about");
  const locale = await getLocale();

  const countryData = partner.countryCode
    ? getCountryData(partner.countryCode, locale)
    : null;

  return (
    <Card className="flex h-full flex-col overflow-hidden transition-all duration-300 hover:shadow-lg hover:ring-1 hover:ring-primary/20">
      <CardHeader className="flex flex-row gap-4 space-y-0 pb-4">
        {/* Logo Container */}
        <div className="relative flex size-20 shrink-0 items-center justify-center rounded-xl border bg-white p-2 shadow-sm dark:bg-card">
          <Image
            alt={`${partner.name} logo`}
            className="object-contain p-1"
            fill
            sizes="80px"
            src={partner.logo}
          />
        </div>

        {/* Title & Badge & Country */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-2 text-lg leading-tight md:text-xl">
              {partner.name}
            </CardTitle>
            <Badge className="shrink-0" variant="secondary">
              {t("partnerBadge")}
            </Badge>
          </div>

          {countryData && (
            <CardDescription className="flex items-center gap-1.5 font-medium text-muted-foreground/80">
              {countryData.Flag && (
                <countryData.Flag
                  aria-hidden="true"
                  className="h-3.5 w-auto rounded-[2px] shadow-sm"
                />
              )}
              <span className="truncate">{countryData.name}</span>
            </CardDescription>
          )}
        </div>
      </CardHeader>

      <CardContent className="grow text-sm leading-relaxed text-muted-foreground">
        <p>{partner.description}</p>
      </CardContent>

      <CardFooter className="flex items-center justify-end border-t">
        {partner.website && (
          <Button asChild className="gap-2" size="sm" variant="secondaryoutline">
            <Link
              aria-label={`${t("visitWebsite")}: ${partner.name}`}
              href={partner.website}
              rel="noopener noreferrer"
              target="_blank"
              title={`${t("visitWebsite")}: ${partner.name}`}
            >
              {t("visitWebsite")}
              <ExternalLinkIcon />
            </Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
