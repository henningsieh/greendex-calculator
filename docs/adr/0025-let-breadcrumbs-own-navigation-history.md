---
status: accepted
---

# Let Breadcrumbs Own Navigation History

## Context

The Projects table used to carry a `returnTo` search parameter. Opening a Project
wrote the filtered table's URL into the parameter so that a Project details page
could rebuild the exact table state behind its back button. The parameter was
transport state, not product state: it duplicated the browser's own history,
appeared in every detail URL, and had to be validated, serialized, and forwarded
by every link on the path.

The App Shell header now renders a breadcrumb trail per route. Crumbs name the
current page's place in the hierarchy and link only to real ancestor pages.

## Decision

Navigation history belongs to the browser and to the breadcrumbs. The Projects
table's `returnTo` parameter is removed, together with the code that read,
validated, and forwarded it. A filtered table is one browser Back away, and its
state already lives in the URL.

The entry and authentication `returnTo` values are untouched. Invitations, setup
links, and the sign-in destination carry a target that the visitor cannot
otherwise reconstruct after authenticating, so they remain load-bearing.

No redirect or compatibility shim is provided for links that still carry the
removed parameter: unknown search parameters are ignored, and the route itself
is unchanged.

## Consequences

- Detail pages stay shareable: their URL describes the entity, not the visitor's
  path to it.
- Links into a Project or Project Partnership carry no transport state, so a
  new entry point needs no knowledge of the pages that lead to it.
- Restoring the exact filter, sort, cursor, and page size after a round trip is
  no longer a product promise. The browser's Back button, which restores the URL
  including its search parameters, is the supported path.
- Breadcrumbs are the only in-product way back up the hierarchy, so a new nested
  route must add its `@breadcrumb` slot.

## Alternatives rejected

- **Keep `returnTo` but validate it against a route allowlist.** It still writes
  history into every link and still drifts from the browser's own history.
- **Reconstruct the table from `document.referrer` or history state.** It breaks
  on a direct navigation or a new tab, and the failure mode is a silently
  unfiltered table.
- **Add a dedicated "back to results" control.** It is a second navigation model
  competing with the breadcrumbs the shell already renders.
