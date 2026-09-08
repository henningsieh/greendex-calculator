# Agent Instructions

**Greendex Calculator** — A Next.js 16 app for carbon footprint calculations with organization management, questionnaires, and internationalization.

---

## 🚨 Critical Rules

### Forbidden Commands

Never execute commands that start the development server or any forced/hard git commands:

- `pnpm run dev`, `npm run dev`, `yarn dev`, or any dev server! Most of the time there is already a dev server running on port 3000.
- `git push --force`, `git reset --hard`, or destructive git operations

### Allowed Commands

- **Building and starting the project's app**: `pnpm run build`, `pnpm run start`
- **Docker build**: `DOCKER_BUILDKIT=1 docker build --secret id=NEXT_PUBLIC_BASE_URL,env=NEXT_PUBLIC_BASE_URL --secret id=NEXT_PUBLIC_SOCKET_URL,env=NEXT_PUBLIC_SOCKET_URL --secret id=BETTER_AUTH_SECRET,env=BETTER_AUTH_SECRET --secret id=GOOGLE_CLIENT_ID,env=GOOGLE_CLIENT_ID --secret id=GOOGLE_CLIENT_SECRET,env=GOOGLE_CLIENT_SECRET --secret id=DISCORD_CLIENT_ID,env=DISCORD_CLIENT_ID --secret id=DISCORD_CLIENT_SECRET,env=DISCORD_CLIENT_SECRET --secret id=GITHUB_CLIENT_ID,env=GITHUB_CLIENT_ID --secret id=GITHUB_CLIENT_SECRET,env=GITHUB_CLIENT_SECRET --secret id=SMTP_HOST,env=SMTP_HOST --secret id=SMTP_PORT,env=SMTP_PORT --secret id=SMTP_SENDER,env=SMTP_SENDER --secret id=SMTP_USERNAME,env=SMTP_USERNAME --secret id=SMTP_PASSWORD,env=SMTP_PASSWORD --secret id=SMTP_SECURE,env=SMTP_SECURE -t greendex-calculator .`
- **Linting/Formatting**: `pnpm run lint`, `pnpm run format`
- **Testing**: `pnpm run test`, `pnpm run test:run`, `pnpm run test:coverage`
- **Git (read-only + commits)**: `git status`, `git log`, `git diff`, `git add`, `git commit`, `git checkout -b`
- **Static analysis**: File reads, searches, code inspection

---

## Commit Conventions

Every commit message must follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) as maintained by the [conventionalcommits.org project](https://github.com/conventional-commits/conventionalcommits.org).

Use this structure:

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

- Use a recognized type such as `feat`, `fix`, `docs`, `refactor`, `test`, `build`, `ci`, `chore`, or `perf`.
- Keep the description imperative, concise, and without a trailing period.
- Add a scope when it clarifies the affected area, for example `docs:` or `fix(calculator):`.
- Mark breaking changes with `!` after the type/scope (for example, `feat!:`) and/or a `BREAKING CHANGE:` footer explaining the migration.
- Keep each commit focused on one logical change; do not use vague messages such as `updates` or `WIP`.

Before creating a commit, verify that its subject matches the grammar and that any breaking change is explicitly documented.

## Essential Context

| What                 | Value                 | Notes                                          |
| -------------------- | --------------------- | ---------------------------------------------- |
| **Package Manager**  | `pnpm`                | Use pnpm for all installs/scripts              |
| **Node.js**          | 22+                   | `.node-version` and root `engines.node`        |
| **Node Modules**     | ESM only              | Workspace manifests declare `"type": "module"` |
| **Linter/Formatter** | Oxc                   | Root `.oxlintrc.json` and `.oxfmtrc.json`      |
| **Test Runner**      | Vitest + Playwright   | Calculator tests under `apps/calculator/src/`  |
| **Framework**        | Next.js 16 + React 19 | App Router, React Compiler enabled             |

## Coolify Development Deployment

Greendex currently uses **only** Coolify’s `development` environment. Treat this as the shared deployed development system; no separate production environment is configured yet.

### Access and resource identity

| Resource               | Identifier / access                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Coolify host           | `188.245.144.137` (`ssh coolify`)                                                                                                   |
| SSH identity           | `~/.ssh/coolify` (already configured by the local `coolify` SSH alias; use the alias, never copy a private key into the repository) |
| Coolify project        | `t40wk84o88wkgcocs80k0wws` (`greendex`)                                                                                             |
| Coolify environment    | `rc04oc8sksggs48ggkwsgsg0` (`development`)                                                                                          |
| Calculator application | `wokgg0808c8k44cgk480444c`                                                                                                          |
| Calculator URL         | `https://greendex.apps.sieh.org`                                                                                                    |
| Health check           | `GET /api/rpc/health` on port `3000`                                                                                                |

Coolify API credentials are configured outside this repository. Use the existing local Coolify access rather than placing API tokens in Git, source files, or documentation.

### Databases

Both PostgreSQL resources are private Docker-network services on the host’s external `coolify` network. Connect applications by the database UUID hostname on port `5432`; do not use the host IP/public-port form for application-to-database traffic.

| Purpose                | Coolify database UUID      | Internal host              | Port   |
| ---------------------- | -------------------------- | -------------------------- | ------ |
| Local-development data | `m0w8wog0kgocssg4w4gg4wow` | `m0w8wog0kgocssg4w4gg4wow` | `5432` |
| Live Greendex data     | `a004oogs4cwss04cok0wwckk` | `a004oogs4cwss04cok0wwckk` | `5432` |

The deployed calculator currently targets the live database. Its `DATABASE_URL` is managed in Coolify and has this shape (retrieve credentials from Coolify; never commit them):

```text
postgres://postgres:<password>@a004oogs4cwss04cok0wwckk:5432/postgres
```

The live database has SSL disabled because Coolify’s generated SSL mount was invalid. It remains private on the Docker network. Its configured public port (`5488`) is not a usable application connection endpoint.

### Deployment and database rules

- Make persistent resource, environment-variable, database, and lifecycle changes through Coolify’s UI/API. Coolify regenerates `/data/coolify/.../docker-compose.y*ml`; never hand-edit those generated files.
- Deployments can take up to **10 minutes**. After requesting one, wait for it to reach a terminal status before requesting another; check the Coolify deployment UUID/status instead of inferring completion from an old healthy container.
- The live database was initialized with Drizzle migrations. For a new/empty database, apply migrations before testing Better Auth. When executing the migration inside the running container, pass `DATABASE_URL` explicitly because the database task does not declare the build/start task's environment forwarding:

  ```bash
  docker exec <greendex-container> sh -lc \
    'cd /app/packages/database && DATABASE_URL="$DATABASE_URL" pnpm exec drizzle-kit migrate'
  ```

- Confirm a migration by checking that the `verification` table exists; Better Auth social sign-in writes its OAuth state there before redirecting.

### Google OAuth

- Authorized callback URL: `https://greendex.apps.sieh.org/api/auth/callback/google`
- Local callback URL: `http://localhost:3000/api/auth/callback/google`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `BETTER_AUTH_SECRET` are Coolify-managed secrets. Do not expose or replace them in repository files.
- A `POST /api/auth/sign-in/social` 500 before the Google redirect is usually a database/schema failure. Check Greendex container logs and the `verification` table first. A successful initiation creates a verification row and redirects to `accounts.google.com` with the deployed callback URL.

### Architecture Layers

| Layer                | Location                               | Entry point / ownership                                  |
| -------------------- | -------------------------------------- | -------------------------------------------------------- |
| Calculator routes    | `apps/calculator/src/app/`             | Next.js pages, layouts, route handlers                   |
| Calculator features  | `apps/calculator/src/features/`        | Domain procedures, components, schemas                   |
| oRPC                 | `apps/calculator/src/lib/orpc/`        | Router plus internal RPC/OpenAPI adapters                |
| Better Auth          | `apps/calculator/src/lib/better-auth/` | `apps/calculator/src/app/api/auth/[...all]/route.ts`     |
| Database             | `packages/database/`                   | Drizzle client, schemas, migrations                      |
| Email                | `packages/email/`                      | Templates and reusable delivery; app injects SMTP config |
| Internationalization | `packages/i18n/`                       | Messages/exports; calculator owns route integration      |
| Documentation        | `apps/documentation/`                  | Fumadocs application                                     |
| Socket.IO            | `apps/calculator/src/socket-server.ts` | Separate manually started process                        |

**Critical oRPC invariant:** preserve both imports of `@/lib/orpc/client.server` and their effective evaluation order. Read the [oRPC instruction](docs/agents/instructions/orpc.md) and the [official v1 SSR guide](https://v1.orpc.dev/docs/best-practices/optimize-ssr.md) before changing this seam.

---

## Task Routing

1. Start at [`docs/README.md`](docs/README.md) for project documentation.
2. For an unfamiliar or cross-cutting task, use [`docs/agents/agent-workflows.md`](docs/agents/agent-workflows.md).
3. For vendor APIs, use [`docs/agents/integrations.md`](docs/agents/integrations.md). Confirm the installed version before following an online example.
4. Before editing a matching concern, read every scoped instruction below. Its `applyTo` value is a machine-readable scope; this table is the agent router.

### Scoped instruction index

The instruction files below live under [`docs/agents/instructions/`](docs/agents/instructions/).

<!-- AGENT-INSTRUCTION-INDEX-START -->

| Instruction | Read before changing | Scope summary |
| --- | --- | --- |
| `architecture.md` | Module placement, workspace boundaries, SSR/server-client flow | App and package source files |
| `better-auth.md` | Authentication, organizations, sessions, permissions, auth schema | Auth/organization implementation |
| `code-standards.md` | TypeScript, React, persistence, errors, tests | App and package source files |
| `conventions.md` | Manifests, configuration, environment, quality workflow | Repository configuration |
| `coolify.md` | Deployment resources, environment values, managed databases | Deployment configuration and operational documentation |
| `documentation-app.md` | Fumadocs application ownership and integration | Documentation application source |
| `drizzle.md` | Schemas, migrations, and Drizzle ORM/Kit usage | Database source and auth schema generation |
| `email.md` | Templates, localization, delivery, and SMTP injection | Email package and Calculator adapter |
| `i18n.md` | Messages, locale routing/navigation, country presentation | i18n package and localized app routes |
| `orpc.md` | Procedures, middleware, router, OpenAPI, SSR clients | oRPC, feature procedures, app routes |
| `shadcn.md` | Shared/feature components, forms, accessibility | Calculator component files |
| `tanstack-query.md` | Query caching, options, mutations, prefetching, SSR, hydration | Query integration surfaces |
| `tanstack-table.md` | Table v9 features, state, columns, and table tests | Feature tables and table tests |
| `workspace.md` | Dependencies, catalog, workspace packages, Turbo tasks/env | Manifests, workspace and Turbo config |

<!-- AGENT-INSTRUCTION-INDEX-END -->

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

The default five-role label vocabulary is used. See `docs/agents/triage-labels.md`.

### Domain docs

This repository has one domain context. Before changing domain language, read `docs/agents/domain.md` and the canonical `DOMAIN-GLOSSARY.md`.

### Primary documentation

| Task | Read |
| --- | --- |
| Vendor APIs and installed skills | [Integration reference routes](docs/agents/integrations.md) |
| API endpoints and procedures | [oRPC instruction](docs/agents/instructions/orpc.md) |
| Query caching, prefetching, and hydration | [TanStack Query instruction](docs/agents/instructions/tanstack-query.md) |
| Data tables | [TanStack Table instruction](docs/agents/instructions/tanstack-table.md) |
| Authentication and organizations | [Better Auth instruction](docs/agents/instructions/better-auth.md) |
| UI components and forms | [shadcn instruction](docs/agents/instructions/shadcn.md) |
| Internationalization | [Internationalization instruction](docs/agents/instructions/i18n.md) |
| Database schemas and migrations | [Drizzle instruction](docs/agents/instructions/drizzle.md) and `packages/database/` |
| Deployment and managed resources | [Coolify instruction](docs/agents/instructions/coolify.md) |
| Questionnaire flows and calculations | `docs/participate/` |
| Permissions and access control | `docs/projects/permissions.md` |
| Email templates and transport | [Email instruction](docs/agents/instructions/email.md) |
| Code standards and tooling | [Repository conventions](docs/agents/instructions/conventions.md) |

---

## Agent Checklist

Before submitting work:

- [ ] No forbidden commands were executed
- [ ] Both server-side oRPC initialization paths preserved
- [ ] Tests updated for changed functionality
- [ ] `pnpm run format && pnpm run lint` executed and passing
- [ ] `pnpm run check:agent-instructions` passes after instruction changes
- [ ] Matching scoped instructions and topic documentation consulted
- [ ] Git commits are focused and well-described

**The developer is always in control. Agents are assistants, not controllers.**

<!-- intent-skills:start -->

## Skill Loading

Before editing files for a substantial task:

- Run `pnpm dlx @tanstack/intent@latest list` from the workspace root. Root `package.json#intent.skills` exposes repository skills from each workspace package's `skills/` directory.
- If a listed skill matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.

<!-- intent-skills:end -->

<!-- NEXT-AGENTS-MD-START -->[Next.js Docs Index]|root: ./.next-docs|STOP. What you remember about Next.js is WRONG for this project. Always search docs and read before any task.|If docs missing, run this command first: npx @next/codemod agents-md --output AGENTS.md|01-app:{04-glossary.mdx}|01-app/01-getting-started:{01-installation.mdx,02-project-structure.mdx,03-layouts-and-pages.mdx,04-linking-and-navigating.mdx,05-server-and-client-components.mdx,06-fetching-data.mdx,07-mutating-data.mdx,08-caching.mdx,09-revalidating.mdx,10-error-handling.mdx,11-css.mdx,12-images.mdx,13-fonts.mdx,14-metadata-and-og-images.mdx,15-route-handlers.mdx,16-proxy.mdx,17-deploying.mdx,18-upgrading.mdx}|01-app/02-guides:{adopting-partial-prefetching.mdx,ai-agents.mdx,analytics.mdx,authentication-with-cache-components.mdx,authentication.mdx,backend-for-frontend.mdx,building.mdx,caching-without-cache-components.mdx,cdn-caching.mdx,ci-build-caching.mdx,content-security-policy.mdx,css-in-js.mdx,custom-server.mdx,data-security.mdx,debugging.mdx,deploying-to-platforms.mdx,draft-mode.mdx,environment-variables.mdx,forms.mdx,how-revalidation-works.mdx,incremental-static-regeneration-cache-components.mdx,incremental-static-regeneration.mdx,instant-navigation.mdx,instrumentation.mdx,interactive-apps.mdx,internationalization.mdx,json-ld.mdx,lazy-loading.mdx,local-development.mdx,mcp.mdx,mdx.mdx,memory-usage.mdx,migrating-to-cache-components.mdx,multi-tenant.mdx,multi-zones.mdx,offline-support.mdx,open-telemetry.mdx,optimizing-prefetching.mdx,package-bundling.mdx,ppr-platform-guide.mdx,prefetching.mdx,preserving-ui-state.mdx,preventing-flash-before-hydration.mdx,production-checklist.mdx,progressive-web-apps.mdx,public-static-pages.mdx,redirecting.mdx,rendering-philosophy.mdx,sass.mdx,scripts.mdx,self-hosting.mdx,server-actions.mdx,server-and-client-boundary.mdx,single-page-applications.mdx,static-exports.mdx,streaming.mdx,tailwind-v3-css.mdx,third-party-libraries.mdx,videos.mdx,view-transitions.mdx}|01-app/02-guides/client-side-data-fetching:{swr.mdx,tanstack-query.mdx}|01-app/02-guides/migrating:{app-router-migration.mdx,from-create-react-app.mdx,from-vite.mdx}|01-app/02-guides/testing:{cypress.mdx,jest.mdx,playwright.mdx,vitest.mdx}|01-app/02-guides/upgrading:{codemods.mdx,version-14.mdx,version-15.mdx,version-16.mdx}|01-app/03-api-reference:{07-edge.mdx,08-turbopack.mdx}|01-app/03-api-reference/01-directives:{use-cache-private.mdx,use-cache-remote.mdx,use-cache.mdx,use-client.mdx,use-server.mdx}|01-app/03-api-reference/02-components:{font.mdx,form.mdx,image.mdx,link.mdx,script.mdx}|01-app/03-api-reference/03-file-conventions/01-metadata:{app-icons.mdx,manifest.mdx,opengraph-image.mdx,robots.mdx,sitemap.mdx}|01-app/03-api-reference/03-file-conventions/02-route-segment-config:{dynamicParams.mdx,instant.mdx,maxDuration.mdx,preferredRegion.mdx,prefetch.mdx,runtime.mdx}|01-app/03-api-reference/03-file-conventions:{default.mdx,dynamic-routes.mdx,error.mdx,forbidden.mdx,instrumentation-client.mdx,instrumentation.mdx,intercepting-routes.mdx,layout.mdx,loading.mdx,mdx-components.mdx,middleware.mdx,not-found.mdx,page.mdx,parallel-routes.mdx,proxy.mdx,public-folder.mdx,route-groups.mdx,route.mdx,src-folder.mdx,template.mdx,unauthorized.mdx}|01-app/03-api-reference/04-functions:{after.mdx,cacheLife.mdx,cacheTag.mdx,catchError.mdx,connection.mdx,cookies.mdx,draft-mode.mdx,fetch.mdx,forbidden.mdx,generate-image-metadata.mdx,generate-metadata.mdx,generate-sitemaps.mdx,generate-static-params.mdx,generate-viewport.mdx,headers.mdx,image-response.mdx,io.mdx,next-request.mdx,next-response.mdx,next-root-params.mdx,not-found.mdx,permanentRedirect.mdx,redirect.mdx,refresh.mdx,revalidatePath.mdx,revalidateTag.mdx,unauthorized.mdx,unstable_cache.mdx,unstable_noStore.mdx,unstable_rethrow.mdx,updateTag.mdx,use-link-status.mdx,use-offline.mdx,use-params.mdx,use-pathname.mdx,use-report-web-vitals.mdx,use-router.mdx,use-search-params.mdx,use-selected-layout-segment.mdx,use-selected-layout-segments.mdx,userAgent.mdx}|01-app/03-api-reference/05-config/01-next-config-js:{adapterPath.mdx,allowedDevOrigins.mdx,appDir.mdx,assetPrefix.mdx,authInterrupts.mdx,basePath.mdx,cacheComponents.mdx,cacheHandlers.mdx,cacheLife.mdx,cacheMaxMemorySize.mdx,compress.mdx,crossOrigin.mdx,cssChunking.mdx,deploymentId.mdx,devIndicators.mdx,distDir.mdx,env.mdx,expireTime.mdx,exportPathMap.mdx,generateBuildId.mdx,generateEtags.mdx,headers.mdx,htmlLimitedBots.mdx,httpAgentOptions.mdx,images.mdx,incrementalCacheHandlerPath.mdx,inlineCss.mdx,instrumentationClientInject.mdx,logging.mdx,mdxRs.mdx,onDemandEntries.mdx,optimizePackageImports.mdx,output.mdx,outputHashSalt.mdx,pageExtensions.mdx,partialPrefetching.mdx,poweredByHeader.mdx,prefetchInlining.mdx,productionBrowserSourceMaps.mdx,proxyClientMaxBodySize.mdx,reactCompiler.mdx,reactMaxHeadersLength.mdx,reactStrictMode.mdx,redirects.mdx,rewrites.mdx,sassOptions.mdx,serverActions.mdx,serverComponentsHmrCache.mdx,serverExternalPackages.mdx,staleTimes.mdx,staticGeneration.mdx,supportsImmutableAssets.mdx,taint.mdx,trailingSlash.mdx,transpilePackages.mdx,turbopack.mdx,turbopackChunking.mdx,turbopackFileSystemCache.mdx,turbopackIgnoreIssue.mdx,turbopackLocalPostcssConfig.mdx,turbopackMemoryEviction.mdx,turbopackRustReactCompiler.mdx,typedRoutes.mdx,typescript.mdx,urlImports.mdx,useLightningcss.mdx,useOffline.mdx,useTypeScriptCli.mdx,webVitalsAttribution.mdx,webpack.mdx}|01-app/03-api-reference/05-config:{02-typescript.mdx,03-eslint.mdx}|01-app/03-api-reference/06-cli:{create-next-app.mdx,next.mdx}|01-app/03-api-reference/07-adapters:{01-configuration.mdx,02-creating-an-adapter.mdx,03-api-reference.mdx,04-testing-adapters.mdx,05-routing-with-next-routing.mdx,06-implementing-ppr-in-an-adapter.mdx,07-runtime-integration.mdx,08-invoking-entrypoints.mdx,09-output-types.mdx,10-routing-information.mdx,11-use-cases.mdx,12-immutable-static-assets.mdx}|02-pages/01-getting-started:{01-installation.mdx,02-project-structure.mdx,04-images.mdx,05-fonts.mdx,06-css.mdx,11-deploying.mdx}|02-pages/02-guides:{analytics.mdx,authentication.mdx,babel.mdx,ci-build-caching.mdx,content-security-policy.mdx,css-in-js.mdx,custom-server.mdx,debugging.mdx,draft-mode.mdx,environment-variables.mdx,forms.mdx,incremental-static-regeneration.mdx,instrumentation.mdx,internationalization.mdx,lazy-loading.mdx,mdx.mdx,multi-zones.mdx,open-telemetry.mdx,package-bundling.mdx,post-css.mdx,preview-mode.mdx,production-checklist.mdx,redirecting.mdx,sass.mdx,scripts.mdx,self-hosting.mdx,static-exports.mdx,tailwind-v3-css.mdx,third-party-libraries.mdx}|02-pages/02-guides/migrating:{app-router-migration.mdx,from-create-react-app.mdx,from-vite.mdx}|02-pages/02-guides/testing:{cypress.mdx,jest.mdx,playwright.mdx,vitest.mdx}|02-pages/02-guides/upgrading:{codemods.mdx,version-10.mdx,version-11.mdx,version-12.mdx,version-13.mdx,version-14.mdx,version-9.mdx}|02-pages/03-building-your-application/01-routing:{01-pages-and-layouts.mdx,02-dynamic-routes.mdx,03-linking-and-navigating.mdx,05-custom-app.mdx,06-custom-document.mdx,07-api-routes.mdx,08-custom-error.mdx}|02-pages/03-building-your-application/02-rendering:{01-server-side-rendering.mdx,02-static-site-generation.mdx,04-automatic-static-optimization.mdx,05-client-side-rendering.mdx}|02-pages/03-building-your-application/03-data-fetching:{01-get-static-props.mdx,02-get-static-paths.mdx,03-get-server-side-props.mdx,05-client-side.mdx}|02-pages/03-building-your-application/06-configuring:{12-error-handling.mdx}|02-pages/04-api-reference:{06-edge.mdx,08-turbopack.mdx}|02-pages/04-api-reference/01-components:{font.mdx,form.mdx,head.mdx,image-legacy.mdx,image.mdx,link.mdx,script.mdx}|02-pages/04-api-reference/02-file-conventions:{instrumentation.mdx,proxy.mdx,public-folder.mdx,src-folder.mdx}|02-pages/04-api-reference/03-functions:{catchError.mdx,get-initial-props.mdx,get-server-side-props.mdx,get-static-paths.mdx,get-static-props.mdx,next-request.mdx,next-response.mdx,use-params.mdx,use-report-web-vitals.mdx,use-router.mdx,use-search-params.mdx,userAgent.mdx}|02-pages/04-api-reference/04-config/01-next-config-js:{adapterPath.mdx,allowedDevOrigins.mdx,assetPrefix.mdx,basePath.mdx,bundlePagesRouterDependencies.mdx,compress.mdx,crossOrigin.mdx,deploymentId.mdx,devIndicators.mdx,distDir.mdx,env.mdx,exportPathMap.mdx,generateBuildId.mdx,generateEtags.mdx,headers.mdx,httpAgentOptions.mdx,images.mdx,logging.mdx,onDemandEntries.mdx,optimizePackageImports.mdx,output.mdx,pageExtensions.mdx,poweredByHeader.mdx,productionBrowserSourceMaps.mdx,proxyClientMaxBodySize.mdx,reactStrictMode.mdx,redirects.mdx,rewrites.mdx,serverExternalPackages.mdx,trailingSlash.mdx,transpilePackages.mdx,turbopack.mdx,turbopackChunking.mdx,typescript.mdx,urlImports.mdx,useLightningcss.mdx,useTypeScriptCli.mdx,webVitalsAttribution.mdx,webpack.mdx}|02-pages/04-api-reference/04-config:{01-typescript.mdx,02-eslint.mdx}|02-pages/04-api-reference/05-cli:{create-next-app.mdx,next.mdx}|02-pages/04-api-reference/06-adapters:{01-configuration.mdx,02-creating-an-adapter.mdx,03-api-reference.mdx,04-testing-adapters.mdx,05-routing-with-next-routing.mdx,06-runtime-integration.mdx,07-invoking-entrypoints.mdx,08-output-types.mdx,09-routing-information.mdx,10-use-cases.mdx}|03-architecture:{accessibility.mdx,fast-refresh.mdx,nextjs-compiler.mdx,supported-browsers.mdx}|04-community:{01-contribution-guide.mdx,02-rspack.mdx}<!-- NEXT-AGENTS-MD-END -->
