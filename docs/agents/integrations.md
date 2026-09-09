# Integration Reference Routes

For every integration change:

1. Read the linked Greendex map.
2. Confirm the installed version in the owning manifest and `pnpm-lock.yaml`.
3. Load the listed skill when one is available for the task.
4. Fetch only the smallest relevant official page.
5. Resolve conflicts in this order: Greendex source, installed declarations, version-matched official documentation, model memory.

| Integration | Direct official route | Greendex map | Skill strategy |
| --- | --- | --- | --- |
| Next.js | Generated version-matched index in `AGENTS.md` and `.next-docs/` | [Architecture](instructions/architecture.md) | Generated local vendor corpus; regenerate with the command embedded in `AGENTS.md` |
| <a id="nuqs"></a>nuqs | [`llms.txt`](https://nuqs.dev/llms.txt) · [Next.js App Router adapter](https://nuqs.dev/docs/adapters#nextjs-app-router) | [nuqs](instructions/nuqs.md) | Official online documentation and installed declarations; no official `SKILL.md` is available. The maintainer [AGENTS.md](https://github.com/47ng/nuqs/blob/next/AGENTS.md) is upstream contributor guidance, not consumer-app API guidance |
| <a id="coolify-deployment-and-api"></a>Coolify | [`llms.txt`](https://coolify.io/docs/llms.txt) · [`llms-full.txt`](https://coolify.io/docs/llms-full.txt) | [Coolify](instructions/coolify.md) | Online documentation; no official project skill adopted |
| <a id="drizzle-orm-and-kit"></a>Drizzle ORM and Kit | [`llms.txt`](https://orm.drizzle.team/llms.txt) · [`llms-full.txt`](https://orm.drizzle.team/llms-full.txt) | [Drizzle](instructions/drizzle.md) | Online documentation and installed declarations; no official project skill adopted |
| <a id="tanstack-query"></a>TanStack Query | [`latest`](https://tanstack.com/query/latest/llms.txt) · [`v5`](https://tanstack.com/query/v5/llms.txt) | [TanStack Query](instructions/tanstack-query.md) | Versioned online documentation |
| <a id="tanstack-table"></a>TanStack Table | [`latest`](https://tanstack.com/table/latest/llms.txt) | [TanStack Table](instructions/tanstack-table.md) | Package-provided Intent skills for the installed v9 API plus online documentation |
| <a id="orpc"></a>oRPC | [getting started](https://v1.orpc.dev/docs/getting-started.md) · [product index](https://orpc.dev/llms.txt) · [v1 index](https://v1.orpc.dev/llms.txt) | [oRPC](instructions/orpc.md) | Versioned online documentation; no official project skill adopted |
| <a id="better-auth"></a>Better Auth | [`llms.txt`](https://better-auth.com/llms.txt) · [documentation index](https://better-auth.com/docs/llms.txt) | [Better Auth](instructions/better-auth.md) | Official `better-auth-best-practices` skill plus online documentation |
| Oxc | [`llms.txt`](https://oxc.rs/llms.txt) | [Conventions](instructions/conventions.md) | Online documentation; migration-only skills are not routine guidance |
| <a id="react-email"></a>React Email | [`llms.txt`](https://react.email/docs/llms.txt) | [Email](instructions/email.md) | Online documentation; broad provider/editor skill is not installed |
| Nodemailer | [documentation](https://nodemailer.com/) | [Email](instructions/email.md) | Online documentation and installed declarations |
| <a id="fumadocs"></a>Fumadocs | [`llms.txt`](https://fumadocs.vercel.app/llms.txt) | [Documentation application](instructions/documentation-app.md) | Online documentation; generic site-reading skill is not API authority |
| <a id="shadcnui"></a>shadcn/ui | [`llms.txt`](https://ui.shadcn.com/llms.txt) | [UI components](instructions/shadcn.md) | Official `shadcn` skill plus online component documentation |
| <a id="next-intl-and-country-data"></a>next-intl | [documentation](https://next-intl.dev/docs) | [Internationalization](instructions/i18n.md) | Official pages because no working `llms.txt` route is available |
| Country data and flags | [`i18n-iso-countries`](https://github.com/michaelwittig/node-i18n-iso-countries) · [`country-flag-icons`](https://gitlab.com/catamphetamine/country-flag-icons) | [Internationalization](instructions/i18n.md) | Installed declarations and official repositories; no third-party skill |

## Why there is no one-skill-per-package rule

A skill is installed only when it is official, maintained by the vendor, and adds task workflow or project inspection beyond the documentation. Otherwise, the direct official documentation route and installed declarations are more current and easier to verify. Each Greendex map contains its own direct vendor links; this registry is an overview, not a required intermediate hop.
