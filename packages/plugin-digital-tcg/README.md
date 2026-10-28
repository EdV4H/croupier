# @edv4h/croupier-plugin-digital-tcg

Digital trading card game plugin for croupier.

## Install

```bash
npm install @edv4h/croupier-core @edv4h/croupier-plugin-digital-tcg
```

## Usage

```typescript
import { CroupierCore } from "@edv4h/croupier-core";
import { createDigitalTCGConfig } from "@edv4h/croupier-plugin-digital-tcg";

const config = createDigitalTCGConfig(/* options */);
const game = new CroupierCore(config, ["alice", "bob", "carol"]);
```

See the [repository](https://github.com/EdV4H/croupier) for the rules, options and other game plugins.

## License

MIT
