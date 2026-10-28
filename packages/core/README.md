# @edv4h/croupier-core

Turn-based multiplayer game engine built on XState v5: phases and stages, turn orders, actions, end conditions, bots, view masking and snapshots.

## Install

```bash
npm install @edv4h/croupier-core
```

## Usage

```typescript
import { CroupierCore, SIMULTANEOUS } from "@edv4h/croupier-core";
import type { CroupierConfig, GameState } from "@edv4h/croupier-core";

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
      execute(game, playerId) {
        game.scores[playerId] += 1;
      },
    },
  },
  phases: {
    play: { turnOrder: SIMULTANEOUS, allowedActions: ["score"] },
  },
  initialPhase: "play",
  endConditions: [
    {
      guard: (ctx) => Object.values(ctx.game.scores).some((s) => s >= 10),
      result: (ctx) => ({
        winner: Object.entries(ctx.game.scores).find(([, s]) => s >= 10)?.[0],
      }),
    },
  ],
};

const game = new CroupierCore(config, ["alice", "bob"]);
game.dispatch("alice", "score", {});
```

`@edv4h/croupier-core/testing` exports helpers for snapshot round-trip tests.

See the [repository](https://github.com/EdV4H/croupier) for the full documentation and game plugins.

## License

MIT
