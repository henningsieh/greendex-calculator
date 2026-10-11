# Research: Tailwind CSS v4 canonical-class linting and autofix

## Summary
Canonical-equivalent rewrites are not formatting: Oxfmt sorts Tailwind classes, but does not document class canonicalization; Oxlint has no native Tailwind canonical rule. Best fit is `eslint-plugin-better-tailwindcss`’s `enforce-canonical-classes` loaded as an Oxlint JS plugin: its rule is autofixable and its TSX guide has an Oxlint setup that uses Oxlint parsing, not `typescript-eslint`. Validate the plugin under the repo’s Oxlint version because JS plugins remain alpha. A dedicated CLI (`twlinter`) offers parser-independent scanning and `--fix` as an alternative.

## Findings

1. **Claim:** `better-tailwindcss/enforce-canonical-classes` implements Tailwind’s canonical suggestions (v4.1.15+), and its rule source explicitly declares autofix. It can report simpler equivalent forms and collapse class groups. Its ESLint TS/TSX instructions require `typescript-eslint` / its parser—an issue in this TypeScript 7 setup. **Sources:** [Rule documentation](https://github.com/schoero/eslint-plugin-better-tailwindcss/blob/main/docs/rules/enforce-canonical-classes.md), [rule implementation](https://raw.githubusercontent.com/schoero/eslint-plugin-better-tailwindcss/main/src/rules/enforce-canonical-classes.ts), [TSX setup](https://github.com/schoero/eslint-plugin-better-tailwindcss/blob/main/docs/parsers/tsx.md). **Support:** direct evidence. **Confidence:** high.

2. **Claim:** The same plugin documents an Oxlint JS-plugin configuration for TSX and does not configure an external TS parser there; Oxlint’s JS plugin API supports fixes, but is officially alpha. Oxlint `--fix` can apply fixes. This is the strongest no-typescript-eslint route, subject to testing rule compatibility/version. **Sources:** [plugin’s Oxlint TSX setup](https://github.com/schoero/eslint-plugin-better-tailwindcss/blob/main/docs/parsers/tsx.md), [Oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html), [Oxlint fix capability](https://oxc.rs/docs/guide/usage/linter). **Support:** direct evidence; compatibility caution is interpretation. **Confidence:** medium-high.

3. **Claim:** Oxfmt’s `sortTailwindcss` sorts class order using the Prettier Tailwind sorting algorithm, is disabled by default, and supports a v4 stylesheet path. It is not documented as rewriting noncanonical equivalent utilities. Oxlint’s docs describe generic rules/autofixes, not a native canonical Tailwind rule. **Sources:** [Oxfmt config](https://oxc.rs/docs/guide/usage/formatter/config-file-reference), [Oxlint](https://oxc.rs/docs/guide/usage/linter). **Support:** direct evidence for sorting; absence of a documented rule is not proof none exists in every version. **Confidence:** high.

4. **Claim:** Tailwind’s official `@tailwindcss/upgrade` tool is for v3→v4 migration (dependencies/config/templates), not a general v4 canonical-class cleanup tool; official docs advise reviewing changes. Current docs provide `wrap-break-word` for `overflow-wrap: break-word`; `transform-[…]` exists for a whole transform value, while `translate-x-[…]` is a distinct utility choice. **Sources:** [Upgrade guide](https://tailwindcss.com/docs/upgrade-guide), [overflow-wrap](https://tailwindcss.com/docs/overflow-wrap), [transform](https://tailwindcss.com/docs/transform), [translate](https://tailwindcss.com/docs/translate). **Support:** direct evidence; codemod-scope conclusion is interpretation. **Confidence:** high.

5. **Claim:** `twlinter` is a standalone CLI with `--fix`, claims Tailwind v3/v4 support, and includes `suggestCanonicalClasses`; it also has an Oxlint plugin. Its own docs distinguish text-scanning custom rules from language-service rules that need Tailwind’s design system—so CLI use avoids ESLint/TS parser dependency, but is not a trivial regex-only canonicalizer. **Sources:** [twlinter README](https://github.com/tinyfroggy/twlint), [CLI source](https://github.com/tinyfroggy/twlint/blob/main/src/cli.ts). **Support:** direct project documentation/source. **Confidence:** medium-high.

## Contradictions
None material found. Oxfmt sorting and canonical rewrites are different jobs; do not treat the former as autofixing the latter.

## Missing evidence
No local compatibility test was run against this repository’s installed Oxlint/plugin versions. The `break-words` migration behavior should be checked in the actual Tailwind version/design system before mass-fixing; the official v4 docs establish `wrap-break-word` as the documented utility, not that every old class is always behavior-identical.

## Sources
- Kept: official Oxc, Tailwind, and plugin source/docs above — direct API and behavior evidence.
- Deprioritized: search summaries and third-party package listings — replaced with primary docs/source.

## Recommendation ranking
1. **Try better-tailwindcss as an Oxlint JS plugin** with only `enforce-canonical-classes`; test one fixture containing all target forms, inspect `oxlint --fix` diff. Avoid ESLint config that activates typescript-eslint.
2. **Use `twlinter --fix`** if plugin integration is incompatible; run doctor/scan and review changed files.
3. **Keep Oxfmt for ordering only.** Tailwind upgrade tool is appropriate for actual v3→v4 migration, not recurring canonical lint/autofix.
