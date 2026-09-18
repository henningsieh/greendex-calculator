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
- Task graph, caching, outputs, and forwarded environment: `turbo.json`
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

## Single Next.js install

The catalog pins one `next` version for the whole workspace, and `publicHoistPattern: [next]` in `pnpm-workspace.yaml` exposes that same install at the repository root. This keeps the Next.js documentation single-sourced:

- the Next.js-managed agent-rules block in the root `AGENTS.md` resolves `node_modules/next/dist/docs` verbatim;
- the bundled version-matched docs exist once, not per app;
- Next.js documentation is resolved from the single catalog-managed installation at `node_modules/next/dist/docs/` from the repository root; do not regenerate a downloaded documentation corpus.

Do not add `next` to the root `dependencies`: a root install can resolve a second, differently peer-suffixed copy. Keep the link, not a copy.
- Use an override only for a deliberate transitive-resolution fix that the catalog cannot express; document why it exists.

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
- Keep lint inputs complete: the `lint` task hashes `$TURBO_ROOT$/.oxlintrc.json` plus the root `package.json` and `pnpm-lock.yaml`, so a config or lint-plugin version change invalidates cached results.
- Mark persistent processes and non-cacheable lifecycle/database tasks appropriately.
- Keep dependency ordering explicit with `dependsOn`.
- Do not add a task merely to alias a single command unless it is part of the repository workflow.

## Critical environment forwarding

Coolify and local application scripts provide environment variables to Turbo. The `build` and `start` tasks in `turbo.json` require:

```json
"env": ["*"]
```

This setting is critical: without it, workspace processes do not receive the injected environment expected by application validation and build/start code. Preserve it when editing the task graph.

Each application owns its local `.env` and `.env.example`; do not recreate a repository-root environment file. Turbo does not load these files. Next.js loads the documentation environment, while Calculator package scripts use `dotenv-cli` so its Next.js and Socket.IO processes receive one consistent environment. Keep `.env*` in the build task inputs so changes invalidate the correct package's cache.

## Runtime consistency

- Node.js must satisfy the root `engines.node`; `.node-version` provides the local baseline.
- Use the pnpm version declared by `packageManager`.
- Keep core package versions synchronized through the catalog rather than repeating numeric versions across manifests.
