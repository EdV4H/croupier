# @edv4h/croupier-plugin-daifugo

Daifugo (大富豪) game plugin for croupier.

## Install

```bash
npm install @edv4h/croupier-core @edv4h/croupier-plugin-daifugo
```

## Usage

```typescript
import { CroupierCore } from "@edv4h/croupier-core";
import { createDaifugoConfig } from "@edv4h/croupier-plugin-daifugo";

const config = createDaifugoConfig(/* options */);
const game = new CroupierCore(config, ["alice", "bob", "carol"]);
```

See the [repository](https://github.com/EdV4H/croupier) for the rules, options and other game plugins.

## License

MIT
