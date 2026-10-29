# @croupier/server

Croupier のゲームを部屋単位でホストするサーバー（ワークスペース内専用、npm には公開しない）。
ローカル (Node) と Cloudflare Durable Objects で同じロジックが動く。

```
Hono アプリ (http/app.ts)          REST と WebSocket のルート、入力検証
  └ RoomHost (host/room-host.ts)   部屋ごとに 1 入力ずつ: 読み込み → RoomLogic → 保存 → 送信
      └ RoomLogic (room/logic.ts)  部屋・ターン・タイマー・Bot のルール。I/O なしの純粋な処理
ポート: RoomStore / Scheduler / Transport / Lobby
  ├ adapters/node.ts + memory.ts   Map (JSON で保存) / setTimeout / @hono/node-ws
  └ adapters/cloudflare.ts         ctx.storage / setAlarm / Hibernation WebSocket / LobbyDO
```

- 部屋の状態 (`RoomState`) はエンジンのスナップショットとタイマーの期限を含めて JSON で保存する。
  ローカルでも毎回 JSON から復元するので、DO がメモリから退避されても同じように動く。
- タイマーは「ターンの期限」「次の Bot の手番」「部屋の片付け」の期限を state に持ち、
  一番早いものだけをランタイムに予約する（DO の alarm は 1 本）。
- プレイヤーは `playerId` + ブラウザごとの `secret` で識別する。最初にその名前で入った
  ブラウザ以外は、その名前で参加・接続・開始・削除できない。

## 使い方

```ts
// Node
import { startNodeServer } from "@croupier/server/node";
startNodeServer({ registry, port: 9615 });

// Workers (wrangler の main)
import { createCloudflareServer } from "@croupier/server/cloudflare";
const server = createCloudflareServer({ registry });
export const { GameRoomDO, LobbyDO } = server;
export default server.worker;
```

`registry` は遊べるゲームの一覧と `createConfig(gameId, players, gameOptions)`。
クライアントとのメッセージの型は `@croupier/server/protocol`。

## テスト

```
pnpm test   # Node 上のテスト + workerd 上の Durable Objects テスト
```

`tests/contract.ts` の同じシナリオを、メモリ版 (`tests/memory.test.ts`) と
実際の Durable Objects (`tests/workers/`, `@cloudflare/vitest-pool-workers`) の両方で実行する。
