# Unused Code Analysis Report

Generated on: January 24, 2026

## Analysis Summary

**Tool Used:** ts-prune (knip failed due to module resolution issues)

**Total Unused Exports Found:** 250+ items

---

## 1. Definitely Unused - Safe to Delete

These exports have zero references and are not part of public APIs or UI libraries:

### Source Files

<!-- #### `src/lib/email/index.ts`

- `sendPasswordResetEmail` (line 25)
- `sendEmailVerificationEmail` (line 66)
- `sendOrganizationInvitation` (line 120) -->

### Skeleton Components (Potentially Unused)

#### `src/features/participants/components/participants-link-controls.tsx`

- `ParticipationControlsClientSkeleton` (line 213)

#### `src/features/participants/components/participants-list.tsx`

- `ParticipantsListSkeleton` (line 114)

#### `src/features/project-activities/components/project-activities-table.tsx`

- `ProjectActivitiesListSkeleton` (line 287)

#### `src/features/projects/components/project-switcher.tsx`

- `ProjectSwitcherSkeleton` (line 146)

---

## 2. Needs Review - Potentially Intentional/External Usage

### Configuration Files (Likely Entry Points)

- `drizzle.config.ts`: default export (line 5)
- `next.config.ts`: default export (line 57)
- `playwright.config.ts`: default export (line 10)
- `vitest.config.ts`: default export (line 7)

### Instrumentation & Infrastructure

- `src/instrumentation.ts`: `register` (line 6)
- `src/proxy.ts`: `proxy` (line 9), `config` (line 30)

### Next.js Framework Exports

#### Metadata & Layout Exports

- `src/app/layout.tsx`: default, `metadata` (lines 78, 17)
- `src/app/sitemap.ts`: default (line 13)
- `src/app/[locale]/layout.tsx`: `generateStaticParams`, default (lines 43, 49)

#### Page Components (All detected as unused - Next.js App Router convention)

All page.tsx default exports are flagged but are required by Next.js:

- All files matching `src/app/**/page.tsx`
- All files matching `src/app/**/layout.tsx`

#### API Routes (Required by Next.js)

- `src/app/api/auth/[...all]/route.ts`: POST, GET
- `src/app/api/docs/route.ts`: GET
- `src/app/api/openapi-spec/route.ts`: GET
- `src/app/api/openapi/[[...rest]]/route.ts`: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- `src/app/api/rpc/[[...rest]]/route.ts`: GET, POST, PUT, PATCH, DELETE, HEAD

### Provider Components

- `src/components/providers/next-intl-provider.tsx`: `NextIntlProvider` (line 5)

---

## 3. Excluded from Analysis - UI Library Components

All `src/components/ui/**` exports are **EXCLUDED** from cleanup as they are part of the shadcn/ui library:

### Alert Components

- `src/components/ui/alert-dialog.tsx`: AlertDialogPortal, AlertDialogOverlay, AlertDialogTrigger
- `src/components/ui/alert.tsx`: AlertTitle, AlertDescription

### Form & Input Components

- `src/components/ui/aspect-ratio.tsx`: AspectRatio
- `src/components/ui/badge.tsx`: badgeVariants
- `src/components/ui/breadcrumb.tsx`: BreadcrumbEllipsis
- `src/components/ui/button-group.tsx`: ButtonGroup, ButtonGroupSeparator, ButtonGroupText, buttonGroupVariants
- `src/components/ui/calendar.tsx`: CalendarDayButton
- `src/components/ui/carousel.tsx`: CarouselApi, Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext
- `src/components/ui/collapsible.tsx`: Collapsible, CollapsibleTrigger, CollapsibleContent
- `src/components/ui/command.tsx`: CommandDialog, CommandShortcut, CommandSeparator

### Menu & Navigation Components

- `src/components/ui/context-menu.tsx`: All exports (ContextMenu, ContextMenuTrigger, etc.)
- `src/components/ui/dropdown-menu.tsx`: All exports (DropdownMenuPortal, DropdownMenuGroup, etc.)
- `src/components/ui/menubar.tsx`: All exports (Menubar, MenubarMenu, etc.)
- `src/components/ui/navigation-menu.tsx`: All exports (NavigationMenu, NavigationMenuList, etc.)

### Dialog & Overlay Components

- `src/components/ui/dialog.tsx`: DialogOverlay, DialogPortal
- `src/components/ui/drawer.tsx`: All exports (Drawer, DrawerPortal, DrawerOverlay, etc.)
- `src/components/ui/hover-card.tsx`: HoverCard, HoverCardTrigger, HoverCardContent
- `src/components/ui/popover.tsx`: PopoverAnchor
- `src/components/ui/sheet.tsx`: SheetClose, SheetFooter

### Form Components

- `src/components/ui/field.tsx`: FieldTitle
- `src/components/ui/form.tsx`: useFormField, FormDescription
- `src/components/ui/input-group.tsx`: InputGroupText, InputGroupTextarea
- `src/components/ui/input-otp.tsx`: InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator
- `src/components/ui/radio-group.tsx`: RadioGroup, RadioGroupItem
- `src/components/ui/select.tsx`: SelectScrollDownButton, SelectScrollUpButton, SelectSeparator

### Layout & Structure Components

- `src/components/ui/item.tsx`: ItemMedia, ItemActions, ItemGroup, ItemSeparator, ItemDescription, ItemHeader, ItemFooter
- `src/components/ui/kbd.tsx`: Kbd, KbdGroup
- `src/components/ui/pagination.tsx`: All exports (Pagination, PaginationContent, etc.)
- `src/components/ui/scroll-area.tsx`: ScrollArea, ScrollBar
- `src/components/ui/sidebar.tsx`: SidebarGroupAction, SidebarInput, SidebarMenuAction, SidebarMenuBadge, SidebarMenuSkeleton, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem
- `src/components/ui/table.tsx`: TableFooter, TableCaption

### Miscellaneous UI Components

- `src/components/ui/globe.tsx`: GlobeProps
- `src/components/ui/slider.tsx`: Slider
- `src/components/ui/spinner.tsx`: Spinner
- `src/components/ui/switch.tsx`: Switch
- `src/components/ui/text-effect.tsx`: PresetType, PerType, TextEffectProps
- `src/components/ui/toggle-group.tsx`: ToggleGroup, ToggleGroupItem
- `src/components/ui/toggle.tsx`: Toggle

---

## 4. Type-Only Exports (Marked as "used in module")

These are TypeScript type exports that may only be used in type positions. They show as "used in module" by ts-prune but might still be removable if not actually imported elsewhere:

### Component Types

- `src/components/app-sidebar.tsx`: SIDEBAR_GROUP_IDS, SidebarGroupId, SidebarMenuItemDef, SidebarGroupDef
- `src/components/confirm-dialog.tsx`: ConfirmDialog
- `src/components/date-picker-with-input.tsx`: DatePickerWithInputProps
- `src/components/theme-switcher.tsx`: ThemeSwitcherProps
- `src/components/animated-group.tsx`: PresetType

### Configuration Types

- `src/config/eu-countries.ts`: MARKER_SIZE, EUCountryConfig
- `src/config/organizations.ts`: MemberSortField (with satisfies/readonly)
- `src/config/projects.ts`: ProjectSortField (with satisfies/readonly)

### Feature Types

- `src/features/authentication/utils.ts`: AuthCheckResult
- `src/features/liveview/transport-breakdown.tsx`: TransportIcon
- `src/features/participate/types.ts`: AccommodationCategory, FoodFrequency, CarType, Gender
- `src/features/participate/utils.ts`: getOccupancyFactor, getElectricityFactor, isNonEmptyString
- `src/features/projects/types.ts`: (satisfies/readonly pattern)

### Library/Auth Types

- `src/lib/better-auth/index.ts`: `auth` (line 28) - **DO NOT DELETE** - Core auth instance
- `src/lib/email/nodemailer.ts`: SendEmailOptions
- `src/lib/i18n/countries.ts`: CountryData
- `src/lib/i18n/locales.ts`: LocaleData
- `src/lib/i18n/request.ts`: default (line 6)
- `src/lib/theme.ts`: THEMES

### Email Configuration

- `src/lib/email/config/styles.ts`: emailFonts

### Spec/Contract Schemas (marked as "used in module")

- All schema exports in `specs/001-org-registration/contracts/*.contract.ts`

### Generated Next.js Types

- `.next/dev/types/link.d.ts`: default, **next_route_internal_types**
- `.next/dev/types/routes.d.ts`: ParamsOf, PageRoutes, RedirectRoutes, RewriteRoutes

---

## 5. Test Files

- `src/__tests__/e2e/global-setup.ts`: default export (line 94)

---

## Recommendations

### Immediate Actions (Safe to Delete)

1. **Delete unused skeleton components** - 4 skeleton components are not being used
2. **Remove unused email functions** - 3 email sender functions
3. **Clean up unused permission utilities** - 4 permission check functions
4. **Remove unused i18n utilities** - 3 country/city helper functions
5. **Delete unused type exports** - Various types that aren't imported anywhere
6. **Review spec/contract files** - Entire `specs/001-org-registration/contracts/` directory may be obsolete

### Requires Manual Review

1. **`src/lib/utils/index.ts` - `cn` function** - This is typically a core utility, verify it's truly unused
2. **Next.js framework exports** - All page/layout/route exports are required by Next.js conventions
3. **Config file defaults** - Entry points for various tools
4. **`src/lib/better-auth/index.ts` - `auth` export** - Core auth instance, likely used via side effects

### Exclude from Cleanup

1. **All `src/components/ui/**` files\*\* - shadcn/ui library components
2. **All `*.config.ts` default exports** - Tool entry points
3. **All Next.js pages, layouts, and API routes** - Framework conventions
4. **All `.next/` generated files** - Build artifacts

### Estimated Impact

- **Files to potentially delete**: 0 entire files
- **Exports to remove**: ~70-80 exports (excluding UI library and framework requirements)
- **Reduce bundle size**: Minimal (most unused code is tree-shaken anyway)
- **Improve maintainability**: High (reduces confusion about what's actually used)

---

## Next Steps

1. **Verify `cn` utility usage** - Run additional grep search
2. **Review spec/contract files** - Determine if these are documentation or truly unused
3. **Execute cleanup** - Remove unused exports from source files
4. **Run tests** - Verify nothing breaks
5. **Run TypeScript compiler** - Ensure type safety maintained
