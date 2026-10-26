---
status: accepted
supersedes: []
---

# App-Owned Messages Behind a Shared i18n Engine

## Context

The shared i18n package shipped the Calculator's own message catalogue. That made Cost Tracker look like it should reuse Calculator sentences about Carbon Footprints and Participant Travel Legs. It should not. Cost Tracker talks about Hosting and Partner Organizations, Project Partnerships, Claims, Travel Cost Entries, and Proof Documents.

## Decision

The shared package keeps the mechanism only. It exports translation hooks, server helpers, and navigation primitives. It ships no message payload. The Calculator owns its catalogue. Cost Tracker will own a separate catalogue later by copying the same pattern. The centralized language configuration stays the single source of locale codes, display metadata, default language, and prefix behavior.

## Considered Options

A shared cross-app dictionary was rejected. Shared product terms keep their shared definitions in the glossaries. Shared sentences would still drift. Calculator copy about Organization administration and Cost Tracker copy about Claim funding answer different questions. Duplication of identical sentences is accepted. A truly shared dictionary needs a second proven reuse and its own decision.

## Consequences

Locale loading resolves the owning app catalogue for the requested locale and falls back to the default language. The loader interface and guard behavior are unchanged. Only the catalogue origin moved. No schema, persistence, or API contract change follows. No glossary change follows. The split is engineering, and the shared and app product terms keep their existing definitions.
