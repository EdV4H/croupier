# @edv4h/croupier-plugin-values-card

Values Card game plugin for croupier.

## Install

```bash
npm install @edv4h/croupier-core @edv4h/croupier-plugin-values-card
```

## Usage

```typescript
import { CroupierCore } from "@edv4h/croupier-core";
import { createValuesCardConfig } from "@edv4h/croupier-plugin-values-card";

const config = createValuesCardConfig(/* options */);
const game = new CroupierCore(config, ["alice", "bob", "carol"]);
```

See the [repository](https://github.com/EdV4H/croupier) for the rules, options and other game plugins.

## License

MIT
