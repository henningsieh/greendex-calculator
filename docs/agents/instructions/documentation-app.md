---
name: "Documentation Application"
description: "Greendex Fumadocs source loading, localization, layouts, search, and LLM routes"
applyTo: "apps/documentation/src/**/*.ts,apps/documentation/src/**/*.tsx,apps/documentation/source.config.ts"
---

# Documentation Application

## Official documentation

Confirm installed Fumadocs versions in `apps/documentation/package.json` and `pnpm-lock.yaml`. Start with the official [Fumadocs `llms.txt` index](https://fumadocs.vercel.app/llms.txt), fetch only the needed pages, and compare them with installed declarations and Greendex source. A generic site-reading skill is not Fumadocs API authority and is not installed.

Greendex owns documentation source loading, locale integration, layouts, navigation, search, and LLM-facing routes in `apps/documentation/`. Preserve these application boundaries; do not copy Fumadocs tutorials into this repository.

The documentation app also renders Tailwind + shadcn primitives from `apps/documentation/src/components/`, so the shared design-system lint rules from the root `.oxlintrc.json` apply here. Read [UI components](shadcn.md) before changing component class usage.
