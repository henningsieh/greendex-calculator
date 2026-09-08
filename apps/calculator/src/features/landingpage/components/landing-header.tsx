"use client";

import { useTranslations } from "@greendex/i18n/client";
import { ChevronDownIcon, MenuIcon } from "lucide-react";
import { useState } from "react";

import {
  ABOUT_PATH,
  E_FOREST_PATH,
  HOME_PATH,
  LIBRARY_PATH,
  LOGIN_PATH,
  SIGNUP_PATH,
  TIPS_AND_TRICKS_PATH,
  WORKSHOPS_ANCHOR,
} from "@/app/routes";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Item, ItemContent, ItemTitle } from "@/components/ui/item";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Logo } from "@/features/landingpage/components/logo";
import { Link } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

export const LandingHeader = () => {
  const t = useTranslations("landingPage.header");
  const [menuOpen, setMenuOpen] = useState(false);

  // Main navigation items - grouped logically
  const mainNavItems = [
    {
      name: t("navigation.workshops"),
      href: WORKSHOPS_ANCHOR,
    },
  ] as const;

  // Resources dropdown items
  const resourcesItems = [
    {
      name: t("navigation.tipsAndTricks"),
      href: TIPS_AND_TRICKS_PATH,
    },
    {
      name: t("navigation.library"),
      href: LIBRARY_PATH,
    },
  ] as const;

  // About dropdown items
  const aboutItems = [
    {
      name: "E+ Forest",
      href: E_FOREST_PATH,
    },
    {
      name: t("navigation.about"),
      href: ABOUT_PATH,
    },
  ] as const;

  return (
    <header>
      <nav className="fixed z-20 w-full px-4">
        <div
          className={cn(
            "mx-auto mt-3 max-w-5xl rounded-2xl border border-border/40",
            "bg-background/40 px-4 shadow-sm backdrop-blur-lg",
            "sm:px-6 lg:px-8",
          )}
        >
          <div className="flex h-14 items-center justify-between gap-4">
            {/* Logo */}
            <Link
              aria-label="GREENDEX home"
              className="flex items-center"
              href={HOME_PATH}
            >
              <Logo />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden items-center gap-6 lg:flex">
              {/* Main nav items */}
              {mainNavItems.map((item) => (
                <Link
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  href={item.href}
                  key={item.name}
                >
                  {item.name}
                </Link>
              ))}

              {/* Resources Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                    {t("navigation.resources")}
                    <ChevronDownIcon className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40">
                  {resourcesItems.map((item) => (
                    <DropdownMenuItem asChild key={item.name}>
                      <Link className="w-full cursor-pointer" href={item.href}>
                        {item.name}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* About Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                    {t("navigation.about")}
                    <ChevronDownIcon className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40">
                  {aboutItems.map((item) => (
                    <DropdownMenuItem asChild key={item.name}>
                      <Link className="w-full cursor-pointer" href={item.href}>
                        {item.name}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Desktop Actions */}
            <div className="hidden items-center gap-3 lg:flex">
              <ThemeSwitcher className="h-8 rounded-md" />
              <LocaleSwitcher className="h-8 rounded-md" />
              <div className="h-4 w-px bg-border" />
              <Button asChild size="sm" variant="ghost">
                <Link href={LOGIN_PATH}>{t("navigation.login")}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href={SIGNUP_PATH}>{t("navigation.signup")}</Link>
              </Button>
            </div>

            {/* Mobile Menu */}
            <div className="flex items-center gap-2 lg:hidden">
              <ThemeSwitcher className="hidden h-8 rounded-md sm:flex" />
              <LocaleSwitcher className="h-8 rounded-md" />
              <Sheet onOpenChange={setMenuOpen} open={menuOpen}>
                <SheetTrigger asChild>
                  <Button
                    aria-label={t("navigation.openMenu")}
                    className="h-8 w-8"
                    size="icon"
                    variant="ghost"
                  >
                    <MenuIcon className="size-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right">
                  <SheetHeader className="pb-6 text-left">
                    <SheetTitle className="flex items-center gap-2">
                      <Logo />
                    </SheetTitle>
                    <SheetDescription className="sr-only">
                      {t("navigation.openMenu")}
                    </SheetDescription>
                  </SheetHeader>
                  <nav
                    aria-label={t("navigation.openMenu")}
                    className="flex flex-1 flex-col justify-between"
                  >
                    <ul className="m-2 flex flex-col gap-1">
                      {/* Main nav item */}
                      <li>
                        <Item asChild size="sm">
                          <Link
                            href={WORKSHOPS_ANCHOR}
                            onClick={() => setMenuOpen(false)}
                          >
                            <ItemContent>
                              <ItemTitle className="text-base font-medium">
                                {t("navigation.workshops")}
                              </ItemTitle>
                            </ItemContent>
                          </Link>
                        </Item>
                      </li>

                      {/* Resources section */}
                      <li className="pt-4">
                        <p className="px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                          {t("navigation.resources")}
                        </p>
                      </li>
                      {resourcesItems.map((item) => (
                        <li key={item.name}>
                          <Item asChild size="sm">
                            <Link
                              href={item.href}
                              onClick={() => setMenuOpen(false)}
                            >
                              <ItemContent>
                                <ItemTitle className="text-base font-medium">
                                  {item.name}
                                </ItemTitle>
                              </ItemContent>
                            </Link>
                          </Item>
                        </li>
                      ))}

                      {/* About section */}
                      <li className="pt-4">
                        <p className="px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                          {t("navigation.about")}
                        </p>
                      </li>
                      {aboutItems.map((item) => (
                        <li key={item.name}>
                          <Item asChild size="sm">
                            <Link
                              href={item.href}
                              onClick={() => setMenuOpen(false)}
                            >
                              <ItemContent>
                                <ItemTitle className="text-base font-medium">
                                  {item.name}
                                </ItemTitle>
                              </ItemContent>
                            </Link>
                          </Item>
                        </li>
                      ))}
                    </ul>

                    <div className="m-6 space-y-4">
                      <div className="space-y-3">
                        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                          {t("navigation.settings")}
                        </p>
                        <div className="flex items-center justify-between">
                          <LocaleSwitcher className="rounded-md" />
                          <ThemeSwitcher className="rounded-md" />
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 pt-4">
                        <Button asChild variant="outline">
                          <Link
                            href={LOGIN_PATH}
                            onClick={() => setMenuOpen(false)}
                          >
                            {t("navigation.login")}
                          </Link>
                        </Button>
                        <Button asChild>
                          <Link
                            href={SIGNUP_PATH}
                            onClick={() => setMenuOpen(false)}
                          >
                            {t("navigation.signup")}
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
};
