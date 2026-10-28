# @edv4h/croupier-plugin-planning-poker

Planning poker plugin for croupier.

## Install

```bash
npm install @edv4h/croupier-core @edv4h/croupier-plugin-planning-poker
```

## Usage

```typescript
import { CroupierCore } from "@edv4h/croupier-core";
import { createPlanningPokerConfig } from "@edv4h/croupier-plugin-planning-poker";

const config = createPlanningPokerConfig(/* options */);
const game = new CroupierCore(config, ["alice", "bob", "carol"]);
```

See the [repository](https://github.com/EdV4H/croupier) for the rules, options and other game plugins.

## License

MIT
