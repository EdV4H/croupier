# @edv4h/croupier-plugin-texas-holdem

Texas Hold'em plugin for croupier.

## Install

```bash
npm install @edv4h/croupier-core @edv4h/croupier-plugin-texas-holdem
```

## Usage

```typescript
import { CroupierCore } from "@edv4h/croupier-core";
import { createTexasHoldemConfig } from "@edv4h/croupier-plugin-texas-holdem";

const config = createTexasHoldemConfig(/* options */);
const game = new CroupierCore(config, ["alice", "bob", "carol"]);
```

See the [repository](https://github.com/EdV4H/croupier) for the rules, options and other game plugins.

## License

MIT
