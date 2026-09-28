---
name: "UI Components"
description: "shadcn primitives, feature components, forms, and accessibility"
applyTo: "apps/calculator/src/components/**/*.ts,apps/calculator/src/components/**/*.tsx,apps/calculator/src/features/**/components/**/*.ts,apps/calculator/src/features/**/components/**/*.tsx,apps/cost-tracker/src/components/**/*.ts,apps/cost-tracker/src/components/**/*.tsx,apps/cost-tracker/src/features/**/components/**/*.ts,apps/cost-tracker/src/features/**/components/**/*.tsx"
---

# UI Components

## Official documentation and skill

Use existing local primitives before adding another abstraction. Inspect the owning app's `components.json`, start with the official [shadcn/ui `llms.txt` index](https://ui.shadcn.com/llms.txt), and fetch only the needed [component documentation](https://ui.shadcn.com/docs). Use the official `shadcn` skill as supplementary project-aware workflow guidance.

For the design-system lint that verifies these rules, use the official [`@shadcn/lint` README](https://github.com/shadcn-ui/lint) and fetch only the needed page ([adoption](https://github.com/shadcn-ui/lint/blob/main/docs/adoption.md), [rules](https://github.com/shadcn-ui/lint/blob/main/docs/rules.md)). The installed plugin version in the root manifest is authoritative over upstream examples.

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

## Design-system lint

`@shadcn/lint` runs as an Oxlint JS plugin. The single source of truth is the repository-root `.oxlintrc.json`, which every workspace Oxlint run discovers, so `pnpm run lint` already includes these rules. `pnpm run lint:design-system` is the focused, check-only pass (no `--fix`) over the enforced app source.

- The plugin is declared as a root devDependency; do not duplicate it per workspace.
- Enforcement follows the upstream [adoption guide](https://github.com/shadcn-ui/lint/blob/main/docs/adoption.md): one rule (`shadcn/no-restyle`), strict where clean, deferred elsewhere. Cost Tracker enforces it as `error` with `allow: ["layout"]` via an `overrides` entry for `apps/cost-tracker/src/**`; layout classes such as `mt-4` and `w-full` stay allowed. Calculator and Documentation keep the rule `off` in their own `overrides` entries until each app's migration resolves its findings, then flip to the same strict shape.
- Do not reintroduce global `contracts` to silence a deferred app; fix its callers (variants first) and then promote its override.
- Config paths in `ignorePatterns` and `overrides` resolve against the config file directory, so write them repository-root-relative (`apps/calculator/src/...`), not workspace-relative.
- The rule is enforced as `error` where the adoption reached clean; keep new exceptions explicit: use a variant for reusable appearances, a contract when callers own part of a component's API, a documented file-level disable only for dense bespoke screens, and `eslint-disable-next-line shadcn/no-restyle -- <reason>` for a single intentional treatment.
- The cost-tracker scope currently carries four narrow contracts (callers own layout and spacing on `FieldGroup`, `CardHeader`, `CardContent`, and `PopoverContent`) and two documented single-file exceptions (`user-settings-tabs.tsx` owns its bespoke line-tab system; `sign-out-button.tsx` owns its prominent square header treatment). Point new cases at this list first; do not grow it silently.
- The focused `lint:design-system` command uses `-D shadcn/no-restyle` and fails on new violations. Do not add a warning cap; the rule is already enforced as an error where it applies.
- Re-run `pnpm run format && pnpm run lint` after changing component class usage, and never edit component internals to silence a caller-side finding.
- `lint:design-system` pins the rules adopted so far (`shadcn/no-restyle`); extend that command when you adopt another rule.

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

## Temporary upstream divergence

- `.oxlintrc.json` keeps `react/set-state-in-effect` at `warn` except for the vendored `apps/calculator/src/hooks/use-mobile.ts` hook, which triggers it while upstream has not merged a React 19 fix yet.
- Before touching that hook or the lint rule, check [shadcn-ui/ui#11603](https://github.com/shadcn-ui/ui/pull/11603) (preferred `useSyncExternalStore` rewrite; fallback [#10433](https://github.com/shadcn-ui/ui/pull/10433)). If merged, sync the hook via the `shadcn` CLI diff workflow and flip the rule back to `warn`.

Local component source and `components.json` override upstream examples. [Code standards](code-standards.md) remain applicable.
