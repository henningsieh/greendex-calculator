# Calculator Engineering Documentation

These documents describe behavior owned only by the Calculator application. Repository-wide architecture, domain language, integrations, and operations remain indexed from [`docs/README.md`](../../../docs/README.md).

## Domain context

- [Calculator glossary](../GLOSSARY.md)
- [Shared Greendex language](../../../GLOSSARY.md)
- Other contexts: [Cost Tracker](../../../apps/cost-tracker/GLOSSARY.md) · [Documentation](../../../apps/documentation/GLOSSARY.md) — overview in [Glossary map](../../../GLOSSARY-MAP.md)

## Features

- Transport profiles: Cost Tracker reuses Calculator's Participant profile set (`PARTICIPANT_TRANSPORT_EMISSION_PROFILES`); Calculator's Project Shared Travel profile set remains narrower.

- [Participant questionnaire](participate/README.md)
- [Project behavior and permissions](projects/README.md)

## Related repository documentation

- [Shared Projects documentation](../../../docs/projects/README.md)
- [Architecture instructions](../../../docs/agents/instructions/architecture.md)
- [Better Auth integration](../../../docs/agents/instructions/better-auth.md)
- [oRPC integration](../../../docs/agents/instructions/orpc.md)
- [Database documentation](../../../docs/database/README.md)

## Instant navigation opt-outs

Calculator keeps literal `export const instant = false` declarations in route
files. These segments intentionally allow navigation to block and opt out of
instant-navigation validation. The highest `false` in a route tree also opts
that route out of static-shell validation. This does not disable caching or
replace authentication checks. Authentication pages omit `ensureStatic` because
their layout reads request headers before rendering a form.

| Segments under `src/app/[locale]`                                           | Reason                                                                                                                                                                       |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `(auth)/layout.tsx`                                                         | Resolve the session and organization membership before showing auth forms. Signed-in visitors redirect without a form flash. The request-header read stays outside Suspense. |
| `(org-setup)/layout.tsx`                                                    | Resolve session and membership before showing setup. Visitors who do not belong here redirect before the form appears.                                                       |
| `(app)/layout.tsx`                                                          | Resolve authentication, organization membership, the sidebar cookie, and session-keyed prefetches before protected content appears.                                          |
| `(app)/org/dashboard`, `projects-archive`, `participants`, and `team` pages | Read data for the current session and active organization. Team permissions also gate the table.                                                                             |
| `(app)/org/projects/page.tsx`                                               | Resolve the per-request create-project permission as well as session- and organization-keyed data.                                                                           |
| `(app)/org/projects/[id]/page.tsx`                                          | Prefetch project, participant, and travel-leg data keyed by session and project id.                                                                                          |
| `(app)/org/create-project`, `settings`, and `user/settings` pages           | Resolve the active organization or signed-in user before showing creation or preferences forms.                                                                              |
| `(app)/accept-invitation/[invitationId]/page.tsx`                           | Resolve the invitation or return 404 before showing content for an unknown audience.                                                                                         |
| `(public participation)/project/[id]/participate` layout and page           | Resolve the public-link project per request, reject invalid links with 404, and render the questionnaire complete.                                                           |
| `(app)/orpc-server-example/page.tsx`                                        | Exercise live SSR procedure calls on every load. Caching the calls would defeat this diagnostic.                                                                             |

These opt-outs preserve the existing boundaries. Introducing streamed gates or
changing project caching is separate work, not a reason to remove an export.
Keep each export literal unless a compiler and runtime check proves an
alternative for the installed Next.js version.
