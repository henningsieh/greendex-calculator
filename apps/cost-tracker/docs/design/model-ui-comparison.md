# Research: Codex Sol vs Astra for polished UIs

## Summary

No public primary-source documentation was found for the exact IDs `gpt-6.1-sol` and `gpt-6-astra`; OpenAI search results instead describe GPT-6 naming inconsistently and don't substantiate those codenames. Repo-local observations favor Astra for iteration: medium/high Astra produced approved prototype revisions, while Sol has no attribution in this session log. This is evidence about this project’s workflow, not a controlled model comparison; the log does not report thinking levels for all artifacts.

| Dimension             | Sol     | Astra                                                                                                                   | Evidence-based read                                                            |
| --------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Design taste          | Unknown | Human accepted Geist/Mono, charcoal theme, theme switcher and restrained identity choices in Astra-attributed revisions | Local log supports Astra’s successful delivery, not superiority                |
| CSS craft             | Unknown | Hover/accent, border-swap and glow work recorded as completed; 1px footprint preserved and reduced-motion respected     | Local outcomes are positive; later hover work lacks explicit model attribution |
| Interaction detail    | Unknown | Astra low border-swap; prototype included theme/font toggles and responsive layout review                               | Some observed detail, but no head-to-head                                      |
| Instruction following | Unknown | Logged constraints (no font switcher, preserve theme switcher) reflected in final prototype                             | Suggests successful adherence, not comparative score                           |

## Findings

1. **Claim:** Public evidence for exact model identities and UI-specific differences is missing. **Sources:** [OpenAI models](https://developers.openai.com/api/docs/models), [code generation](https://developers.openai.com/api/docs/guides/code-generation). **Support:** direct evidence of available documentation, but absence claim is bounded to this search; search returned no relevant exact-ID primary docs. **Confidence:** medium.
2. **Claim:** Local session evidence records Astra medium (2C) and high (2D) prototype revisions, followed by Astra low (2H) border-swap; humans selected Geist + JetBrains Mono figures, retained theme switching, and approved prototype. **Sources:** [repo session log](erasmus-billing-accounting-theme.md). **Support:** direct evidence. **Confidence:** high.
3. **Claim:** The recorded workflow indicates Astra could follow detailed UI constraints and yield polished refinements, but cannot establish Astra beats Sol. **Sources:** [repo session log](erasmus-billing-accounting-theme.md). **Support:** researcher inference; attribution absent for other workers and outputs. **Confidence:** medium.

## Contradictions

None found. Public model naming/search results were inconsistent and do not resolve the exact IDs.

## Missing evidence

No Sol-attributed artifacts or matched task, rating rubric, screenshots, or comparable thinking-level runs in the supplied session log. No public first-party material substantiating design taste, CSS craft, interaction detail, or instruction-following differences for these exact IDs.

## Sources

- Kept: [OpenAI API models](https://developers.openai.com/api/docs/models) — authoritative model documentation index.
- Kept: [OpenAI code generation](https://developers.openai.com/api/docs/guides/code-generation) — official coding guidance, no verified head-to-head UI results.
- Kept: `erasmus-billing-accounting-theme.md` — direct project-session artifact and human verdicts.
- Rejected/deprioritized: search snippets claiming precise model ranking/pricing — not validated against exact-ID primary documentation.

## Next steps

For a meaningful comparison, run the same UI brief and repository context on both models at matched effort, then compare screenshots and checklist-based human ratings.
