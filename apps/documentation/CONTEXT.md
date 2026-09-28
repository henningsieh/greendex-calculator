# Documentation Publishing

The documentation app publishes user-facing Greendex documentation with Fumadocs. It is not engineering documentation: repository-wide specs stay in `docs/`, app-owned behavior in `apps/<app>/docs/`, and only rendered user pages live in `apps/documentation/content/docs/`. It uses the shared Greendex language in [`DOMAIN-GLOSSARY.md`](../../DOMAIN-GLOSSARY.md).

## Language

**Published Documentation**:
User-facing pages rendered from `apps/documentation/content/docs/` through Fumadocs layouts, navigation, search, and LLM routes.
_Avoid_: Engineering documentation, inline code comments

## Read next

Owning behavior map: [documentation application](../../docs/agents/instructions/documentation-app.md). Other contexts: [Calculator](../../apps/calculator/CONTEXT.md), [Cost Tracker](../../apps/cost-tracker/CONTEXT.md). Change route: [domain](../../docs/agents/domain.md).

The app also renders Tailwind + shadcn primitives from `apps/documentation/src/components/`; read [UI components](../../docs/agents/instructions/shadcn.md) before changing component classes.
