---
name: "UI Components"
description: "shadcn primitives, feature components, forms, and accessibility"
applyTo: "apps/calculator/src/components/**/*.ts,apps/calculator/src/components/**/*.tsx,apps/calculator/src/features/**/components/**/*.ts,apps/calculator/src/features/**/components/**/*.tsx,apps/cost-tracker/src/components/**/*.ts,apps/cost-tracker/src/components/**/*.tsx,apps/cost-tracker/src/features/**/components/**/*.ts,apps/cost-tracker/src/features/**/components/**/*.tsx"
---

# UI Components

## Official documentation and skill

Use existing local primitives before adding another abstraction. Inspect the owning app's `components.json`, start with the official [shadcn/ui `llms.txt` index](https://ui.shadcn.com/llms.txt), and fetch only the needed [component documentation](https://ui.shadcn.com/docs). Use the official `shadcn` skill as supplementary project-aware workflow guidance.

## Locations

Within the owning app:

- Shared shadcn primitives: `src/components/ui/`
- Shared composed components: `src/components/`
- Feature-specific components: `src/features/<feature>/components/`
- Global styles: `src/app/globals.css`
- shadcn configuration: `components.json`

Add a missing upstream component with:

```bash
pnpm --dir apps/<owning-app> dlx shadcn@latest add <component>
```

Review generated dependencies and code before retaining them.

## Composition

- Import each primitive from its concrete module, such as `@/components/ui/button`.
- Prefer composition over adding domain-specific props to shared primitives.
- Keep feature behavior and translations outside low-level UI primitives.
- Use `cn`, existing variants, and Tailwind tokens before introducing custom styling APIs.
- Preserve Server Components unless interaction or browser APIs require a Client Component.

## Forms

- Keep Zod schema, React Hook Form values, defaults, and optionality aligned.
- Use the local field/form primitives for labels, descriptions, controls, and errors.
- Disable or show pending state during mutations and surface success/failure accessibly.
- Optional fields must remain optional in both schema and UI.

## Accessibility

- Use native semantic controls whenever possible.
- Every interactive control needs an accessible name and keyboard behavior.
- Dialogs require a title; form controls require labels; icon-only buttons require accessible text.
- Preserve focus management supplied by Radix primitives.
- Verify loading, empty, error, disabled, and narrow-screen states.

Local component source and `components.json` override upstream examples. [Code standards](code-standards.md) remain applicable.
