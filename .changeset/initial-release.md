---
"@croupier/core": minor
"@croupier/plugin-values-card": minor
"@croupier/plugin-texas-holdem": patch
"@croupier/plugin-daifugo": patch
"@croupier/plugin-digital-tcg": patch
"@croupier/plugin-planning-poker": patch
"@croupier/plugin-trust-bank": patch
---

Initial public release.

- core: snapshot export / restore (`toSnapshot()` / `CroupierCore.fromSnapshot()`), `getRevision()` for optimistic locking, and seeded `ctx.random` for actions and hooks
- plugin-values-card: renew-values-card spec (deck-empty end, auto play strategy, generic cards, `maxTurns` / `shouldEnd`)
- plugin-texas-holdem / plugin-daifugo: mid-game reshuffles use `ctx.random`
- all packages: separate ESM / CJS type declarations in `exports`
