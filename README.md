# Croupier

Universal game engine framework for turn-based and real-time multiplayer games.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Applications                      │
│  ┌──────────────┐  ┌──────────────────────────────┐ │
│  │  apps/docs   │  │         apps/demo            │ │
│  │  (Nextra)    │  │  Vite + React + Hono (WS)    │ │
│  └──────────────┘  └──────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│                   Game Plugins                       │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌──────────┐ │
│  │Texas     │ │Digital   │ │Planning│ │Values    │ │
│  │Hold'em   │ │TCG       │ │Poker   │ │Card      │ │
│  └──────────┘ └──────────┘ └────────┘ └──────────┘ │
├─────────────────────────────────────────────────────┤
│                  @croupier/core                      │
│  State Machine · Turn Orders · Actions · Bot System  │
│  End Conditions · Events · View Masking              │
│                  (XState v5)                         │
└─────────────────────────────────────────────────────┘
```

## Features

- **Two-level state machine** — Phases + optional stages cover all game patterns
- **Guard-based transitions** — `always[]` and `transitions[]` with declarative guards
- **Flexible turn orders** — `ROUND_ROBIN`, `ALTERNATING`, `SIMULTANEOUS`, or `custom()`
- **Priority-based end conditions** — Unified win/loss/draw detection
- **View masking** — Built-in support for hidden information games
- **Bot system** — Pluggable AI strategies per game
- **Event-driven** — Subscribe to state changes, phase transitions, and game end
- **Plugin architecture** — Games are self-contained configs, no engine modifications needed

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Start demo app (client + server)
pnpm dev --filter @croupier/demo

# Start docs site
pnpm dev --filter @croupier/docs
```

## Monorepo Structure

```
croupier/
├── packages/
│   ├── core/                    # @croupier/core — Engine, types, turn orders
│   ├── plugin-texas-holdem/     # Texas Hold'em with hand evaluation
│   ├── plugin-digital-tcg/      # Hearthstone-style TCG
│   ├── plugin-planning-poker/   # Agile estimation game
│   └── plugin-values-card/      # Wevox Values Card game
├── apps/
│   ├── demo/                    # Vite + React + Hono WebSocket demo
│   └── docs/                    # Nextra documentation site
├── turbo.json
└── pnpm-workspace.yaml
```

## Creating a Game

A game is a `CroupierConfig` object that defines state, actions, phases, and end conditions:

```typescript
import { CroupierCore, SIMULTANEOUS } from "@croupier/core";
import type { CroupierConfig, GameState } from "@croupier/core";

interface MyState extends GameState {
  scores: Record<string, number>;
}

const config: CroupierConfig<MyState> = {
  name: "My Game",
  setup(ctx) {
    const scores: Record<string, number> = {};
    for (const p of ctx.players) scores[p] = 0;
    return { scores };
  },
  actions: {
    score: {
      execute(game, playerId, payload, ctx) {
        game.scores[playerId] += 1;
      },
    },
  },
  phases: {
    play: {
      turnOrder: SIMULTANEOUS,
      allowedActions: ["score"],
    },
  },
  initialPhase: "play",
  endConditions: [
    {
      guard: (ctx) => Object.values(ctx.game.scores).some(s => s >= 10),
      result: (ctx) => {
        const winner = Object.entries(ctx.game.scores)
          .find(([, s]) => s >= 10)?.[0];
        return { winner };
      },
    },
  ],
};

const game = new CroupierCore(config, ["alice", "bob"]);
game.dispatch("alice", "score", {});
```

See the [Create Your Own Game](apps/docs/content/guides/create-your-own-game.mdx) guide for a full walkthrough.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Monorepo | Turborepo + pnpm workspaces |
| Language | TypeScript (strict) |
| State machine | XState v5 |
| Build | tsup (dual CJS + ESM) |
| Test | Vitest |
| Demo server | Hono + WebSocket |
| Demo client | React 19 + Vite |
| Docs | Nextra (Next.js) |

## Game Plugins

| Plugin | Description | Players |
|--------|-------------|---------|
| `@croupier/plugin-texas-holdem` | Texas Hold'em poker with hand evaluation, blinds, and betting rounds | 2–10 |
| `@croupier/plugin-digital-tcg` | Hearthstone-style TCG with mana, deck, and board management | 2 |
| `@croupier/plugin-planning-poker` | Agile estimation with facilitator/voter roles and Fibonacci deck | 2+ |
| `@croupier/plugin-values-card` | Wevox Values Card — choose values that matter most to you | 3+ |

## Releasing

Packages under `packages/*` are versioned with [Changesets](https://changesets.dev). `apps/*` are private and never published.

```bash
# 1. Describe your change (pick packages + semver bump)
pnpm changeset

# 2. Commit the generated .changeset/*.md with your PR
```

On `main`, the [Release workflow](.github/workflows/release.yml) opens a "Version Packages" PR that bumps versions and updates each `CHANGELOG.md`. Merging that PR publishes the new versions (`pnpm release` → `changeset publish`). Internal `workspace:^` dependencies are rewritten to real version ranges on publish.

Each package ships ESM (`dist/index.js`) and CJS (`dist/index.cjs`) with separate type declarations (`index.d.ts` / `index.d.cts`).

The workflow is inert until these repository settings exist:

| Setting | Value |
|---------|-------|
| `vars.RELEASE_ENABLED` | `true` |
| `vars.NPM_REGISTRY_URL` | Registry URL. Default `https://registry.npmjs.org`; `https://npm.pkg.github.com` for GitHub Packages |
| `secrets.NPM_TOKEN` | Publish token (falls back to `GITHUB_TOKEN`, which works for GitHub Packages) |

Packages publish with `access: restricted` (see `.changeset/config.json`). Set it to `public` only for a public npm release.

> Note: GitHub Packages requires the npm scope to match the repository owner, so publishing there means renaming `@croupier/*` to `@edv4h/*`.

## License

Private
