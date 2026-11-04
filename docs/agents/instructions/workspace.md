---
name: "Workspace and Turborepo"
description: "pnpm catalog, workspace dependencies, Turbo tasks, and environment forwarding"
applyTo: "package.json,apps/*/package.json,packages/*/package.json,pnpm-workspace.yaml,turbo.json,.node-version"
---

# Workspace and Turborepo

Use this instruction whenever changing a manifest, dependency version, workspace package, or Turbo task.

## Sources of truth

- Workspaces and shared versions: `pnpm-workspace.yaml`
- Root task entrypoints and runtime pins: `package.json`
- Task graph, caching, outputs, and forwarded environment: root and workspace `turbo.json` files
- Package ownership: the nearest workspace `package.json`
- Resolved dependency graph: `pnpm-lock.yaml`

## Dependency ownership

- Declare a dependency in every workspace that imports it directly.
- Use `workspace:*` for internal `@greendex/*` packages.
- Put shared framework/tool versions in the `catalog` section of `pnpm-workspace.yaml` and consume them with `"catalog:"`.
- Keep package-specific libraries in the owning workspace manifest.
- Shared packages declare React or framework peer dependencies when their public API requires the consumer to supply them.
- Root dev dependencies are limited to repository-wide orchestration and quality tools.
- Keep exactly one Next.js install for the workspace: pin it in the catalog and expose that install at the repository root with `publicHoistPattern` rather than adding a second root dependency.
- Use an override only for a deliberate transitive-resolution fix that the catalog cannot express; document why it exists.

## Single Next.js install

Resolve version-matched Next.js documentation from the catalog-managed installation at `node_modules/next/dist/docs/`. Keep the root link to that installation rather than a separate dependency or downloaded documentation copy.

## Adding or updating a dependency

1. Identify every workspace that imports the package.
2. Decide whether the version belongs in the shared catalog or the owning manifest.
3. Use a workspace-targeted pnpm command, for example `pnpm --filter <workspace> add <package>`.
4. Inspect all manifest and `pnpm-lock.yaml` changes.
5. Run type checking and the affected tests.

Do not edit `pnpm-lock.yaml` manually.

## Turbo tasks

- Define reusable root task entrypoints in `package.json`; define workspace implementations in workspace manifests.
- Declare generated outputs so Turbo can cache only reproducible artifacts.
- Include shared lint configuration and tooling in lint task inputs so relevant changes invalidate cached results.
- Mark persistent processes and non-cacheable lifecycle/database tasks appropriately.
- Keep dependency ordering explicit with `dependsOn`.
- Do not add a task merely to alias a single command unless it is part of the repository workflow.

## Environment forwarding

Preserve the application-required environment variables when changing Turbo tasks. Inspect the current task configuration and package scripts for forwarding and loading behavior; deployment requirements live in the [Coolify runbook](coolify.md).

Each application owns its `.env` and `.env.example`. Configure local `DATABASE_URL` in the shared `packages/database/.env`, not a repository-root environment file. Include relevant environment files in cached task inputs.

## Runtime consistency

- Node.js must satisfy the root `engines.node`; `.node-version` provides the local baseline.
- Use the pnpm version declared by `packageManager`.
- Keep core package versions synchronized through the catalog rather than repeating numeric versions across manifests.
