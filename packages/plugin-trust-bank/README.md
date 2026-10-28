# @edv4h/croupier-plugin-trust-bank

Trust Bank card game plugin for croupier.

## Install

```bash
npm install @edv4h/croupier-core @edv4h/croupier-plugin-trust-bank
```

## Usage

```typescript
import { CroupierCore } from "@edv4h/croupier-core";
import { createTrustBankConfig } from "@edv4h/croupier-plugin-trust-bank";

const config = createTrustBankConfig(/* options */);
const game = new CroupierCore(config, ["alice", "bob", "carol"]);
```

See the [repository](https://github.com/EdV4H/croupier) for the rules, options and other game plugins.

## License

MIT
