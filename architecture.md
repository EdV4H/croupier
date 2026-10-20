# Croupier フレームワーク アーキテクチャ設計

## Context

plan.md に記載された4つのゲーム設計（テキサスホールデム、プランニングポーカー、Wevox Values Card、デジタルTCG）を**すべて表現できる**汎用ゲームエンジンフレームワークを設計する。Turborepo モノレポ構成で、ゲームはプラグインパッケージとして管理、ドキュメントサイト（Nextra）とデモアプリ（Vite/React + Hono.js）を含む。

---

## 技術スタック

- **モノレポ**: Turborepo + pnpm workspaces
- **言語**: TypeScript
- **テスト**: Vitest
- **ドキュメント**: Nextra (Next.js)
- **デモアプリ**: Vite + React (フロント) + Hono.js (APIサーバー)
- **ビルド**: tsup（ライブラリパッケージ用）

---

## モノレポ ディレクトリ構造

```
croupier/
  package.json               # ルート (pnpm workspace + turborepo)
  pnpm-workspace.yaml
  turbo.json
  tsconfig.base.json         # 共通TypeScript設定
  plan.md                    # 既存の設計書
  architecture.md            # 本ドキュメント

  packages/
    core/                    # @edv4h/croupier-core - エンジン本体
      package.json
      tsconfig.json
      tsup.config.ts
      vitest.config.ts
      src/
        index.ts             # Public API exports
        croupier-core.ts     # メインエンジンクラス
        types.ts             # 全インターフェース定義
        turn-orders.ts       # 組み込みターン順序
        validation.ts        # バリデーションヘルパー
        events.ts            # イベントエミッター
        util/
          clone.ts           # structuredClone, maskArray, countOnly
          random.ts          # シード付き乱数（再現性）
      tests/
        croupier-core.test.ts
        turn-orders.test.ts
        validation.test.ts
        lifecycle.test.ts
        interrupts.test.ts
        masking.test.ts

    plugin-texas-holdem/     # @edv4h/croupier-plugin-texas-holdem
      package.json
      tsconfig.json
      tsup.config.ts
      src/
        index.ts             # CroupierConfig エクスポート
        hands.ts             # 役判定ロジック
        types.ts             # ゲーム固有の型定義
      tests/
        texas-holdem.test.ts
        hands.test.ts

    plugin-planning-poker/   # @edv4h/croupier-plugin-planning-poker
      package.json
      tsconfig.json
      tsup.config.ts
      src/
        index.ts
        types.ts
      tests/
        planning-poker.test.ts

    plugin-values-card/      # @edv4h/croupier-plugin-values-card
      package.json
      tsconfig.json
      tsup.config.ts
      src/
        index.ts
        types.ts
      tests/
        values-card.test.ts

    plugin-digital-tcg/      # @edv4h/croupier-plugin-digital-tcg
      package.json
      tsconfig.json
      tsup.config.ts
      src/
        index.ts
        cards.ts             # カード定義
        types.ts
      tests/
        digital-tcg.test.ts

  apps/
    docs/                    # ドキュメントサイト (Nextra)
      package.json
      next.config.mjs
      theme.config.tsx
      tsconfig.json
      pages/
        index.mdx            # トップページ
        getting-started.mdx
        core-concepts/
          state-machine.mdx
          phases-and-stages.mdx
          turn-orders.mdx
          state-masking.mdx
          actions.mdx
          interrupts.mdx
        api-reference/
          croupier-config.mdx
          croupier-core.mdx
          turn-orders.mdx
        plugins/
          texas-holdem.mdx
          planning-poker.mdx
          values-card.mdx
          digital-tcg.mdx
        guides/
          create-your-own-game.mdx

    demo/                    # デモアプリ
      package.json
      tsconfig.json
      vite.config.ts

      server/                # Hono.js APIサーバー
        index.ts             # エントリポイント
        rooms.ts             # ルーム管理 (WebSocket)
        game-manager.ts      # CroupierCore インスタンス管理

      client/                # Vite + React フロントエンド
        index.html
        src/
          main.tsx
          app.tsx
          hooks/
            use-game-state.ts  # WebSocket経由のstate購読
          components/
            game-selector.tsx  # ゲーム選択画面
            game-board.tsx     # 共通ゲームボード
            player-hand.tsx    # 手札表示
          games/               # ゲーム固有UI
            texas-holdem/
            planning-poker/
            values-card/
            digital-tcg/
```

---

## パッケージ依存関係

```
@edv4h/croupier-core              ← 依存なし（純粋ロジック）
@edv4h/croupier-plugin-*          ← @edv4h/croupier-core に依存
apps/docs                   ← Nextra, 全パッケージの型情報参照
apps/demo/server            ← @edv4h/croupier-core, 全plugin, hono
apps/demo/client            ← React（coreは直接参照しない、サーバー経由）
```

---

## 4ゲームの構造分析

### ターン順序パターン

| ゲーム | モデル | 説明 |
|--------|--------|------|
| テキサスホールデム | 逐次ラウンドロビン | ベッティングラウンド内で1人ずつ順番に行動 |
| プランニングポーカー | 同時（バリア同期） | 全Voterが同時に行動、全員完了で次へ |
| Values Card | 逐次ラウンドロビン | 1人ずつ順番にドロー＆ディスカード |
| デジタルTCG | 交互 | 1プレイヤーが1ターン全体を担当、交代 |

### フェイズネスト要件

| ゲーム | 階層 |
|--------|------|
| ホールデム | メインフェイズ内にベッティングラウンドのループ |
| Values Card | PlayerTurn内にWaitingForDraw → WaitingForDiscard |
| デジタルTCG | MainPhaseは自由行動ループ（サブステート不要） |
| プランニングポーカー | Voting内にWaitingForVotes（フラットでも可） |

→ **2階層（Phase + Stage）で全ゲームを表現可能。任意深さのネストは不要。**

### 遷移トリガーパターン

| 種類 | 例 | ゲーム |
|------|---|--------|
| 自動（状態述語） | 全員のベット一致 | ホールデム |
| プレイヤー起動 | 「ターン終了」アクション | TCG |
| 進行役起動 | 「見積もり開始」 | プランニングポーカー |
| 割り込み（グローバル） | ライフ≤0、全員Fold | ホールデム、TCG |

---

## @edv4h/croupier-core アーキテクチャ

### コアインターフェース（types.ts）

#### CroupierConfig（メイン設定 — プラグインが実装するもの）

```typescript
interface CroupierConfig<S extends GameState = GameState> {
  name: string;
  setup: (ctx: SetupContext) => S;
  actions: { [name: string]: ActionConfig };
  phases: { [name: string]: PhaseConfig };
  initialPhase?: string;
  defaultTurnOrder?: TurnOrder;
  endIf?: (state: S) => GameResult;
  interrupts?: InterruptGuard[];
  view?: { playerView: (state: S, playerId: PlayerId) => any };
  roles?: { [name: string]: { count?: number } };
}
```

#### TurnOrder（ターン順序戦略）

```typescript
interface TurnOrder {
  first(ctx: TurnContext): PlayerId | PlayerId[];
  next(ctx: TurnContext): PlayerId | PlayerId[] | null;
}
```

組み込み: `ROUND_ROBIN`, `ALTERNATING`, `SIMULTANEOUS`, `custom()`

#### PhaseConfig / StageConfig

```typescript
interface PhaseConfig {
  turnOrder?: TurnOrder;
  allowedActions?: string[];
  onEnter?: (state, ctx) => void;
  onExit?: (state, ctx) => void;
  next?: (state, ctx) => string | null;
  stages?: { [name: string]: StageConfig };
  initialStage?: string;
  allowedRoles?: string[];
}

interface StageConfig {
  allowedActions?: string[];
  turnOrder?: TurnOrder;
  onEnter?: (state, ctx) => void;
  onExit?: (state, ctx) => void;
  next?: (state, ctx) => string | "__end__" | null;
}
```

#### ActionConfig

```typescript
interface ActionConfig {
  execute: (state, playerId, payload) => void;
  validate?: (state, playerId, payload) => boolean | string;
  endsTurn?: boolean;       // TCGの EndTurn 等
  unrestricted?: boolean;   // 進行役アクション等
}
```

#### InterruptGuard

```typescript
interface InterruptGuard {
  condition: (state) => GameResult;  // non-null で即座にゲーム終了
}
```

### CroupierCore エンジンクラス（croupier-core.ts）

#### dispatch() — 唯一の入力エントリポイント

```
dispatch(playerId, actionName, payload)
  1. バリデーション: フェイズ/ステージの allowedActions に含まれるか
  2. バリデーション: プレイヤーが currentPlayers に含まれるか（unrestricted除く）
  3. バリデーション: ロール制限チェック
  4. バリデーション: ActionConfig.validate()
  5. 実行: ActionConfig.execute() で state を更新
  6. ログ記録
  7. 割り込みチェック: interrupts[] を評価
  8. 終了判定: endIf() を評価
  9. ターン進行: turnOrder.next() を呼び出し
  10. 遷移判定: phase/stage の next() を評価
  11. イベント発火: stateChange をブロードキャスト
```

#### フェイズマシン

```
enterPhase(name)
  → onEnter() 実行（state変更可）
  → stages あり → initialStage に入る
  → stages なし → turnOrder.first() で currentPlayers を設定
  → next() を即時チェック（自動進行フェイズ対応）
  → interrupts チェック（onEnter中のライブラリアウト等）

exitPhase(name)
  → onExit() 実行

enterStage(name) / exitStage(name)
  → 同様のライフサイクル
```

#### 自動進行フェイズ

TCGの`TurnStart`のように`allowedActions`がなく`onEnter()`で処理完了→`next()`が即座にフェイズ名を返す。`enterPhase()`内で`next()`を評価するため、プレイヤー入力なしで自動遷移。

#### イベントシステム

```typescript
type CroupierEvent =
  | 'stateChange'    // 成功したアクションの後
  | 'phaseChange'    // フェイズ遷移時
  | 'stageChange'    // ステージ遷移時
  | 'gameOver'       // ゲーム終了時
  | 'actionRejected' // バリデーション失敗時
  | 'actionExecuted' // アクション実行後（遷移前）
```

#### 公開メソッド

```typescript
class CroupierCore<S extends GameState> {
  start(playerIds: PlayerId[], options?: Record<string, any>): void;
  dispatch(playerId: PlayerId, actionName: string, payload?: any): DispatchResult;

  getPlayerView(playerId: PlayerId): any;
  getPlayerViews(): Map<PlayerId, any>;

  getCurrentPhase(): string;
  getCurrentStage(): string | null;
  getCurrentPlayers(): PlayerId[];
  getGameResult(): GameResult;
  isGameOver(): boolean;
  getActionLog(): ActionLogEntry[];
  getValidActions(playerId: PlayerId): string[];

  on(event: CroupierEvent, handler: Function): void;
}
```

---

## 各ゲームプラグインのマッピング

### テキサスホールデム（@edv4h/croupier-plugin-texas-holdem）

| 要素 | 実装方法 |
|------|----------|
| TurnOrder | custom — Fold/AllIn済みスキップ、ベット一致で`null` |
| Phases | Setup → PreFlop → Flop → Turn → River → Showdown |
| Stages | 不要（ベッティングラウンドのループはTurnOrder.next()で制御） |
| 遷移 | 各フェイズの`next()`で`isBettingRoundComplete()`チェック |
| 割り込み | `interrupts` — 全員Fold → 即座にPot分配 |
| Masking | Deck非公開、相手のHoleCards非公開 |

### プランニングポーカー（@edv4h/croupier-plugin-planning-poker）

| 要素 | 実装方法 |
|------|----------|
| TurnOrder | `SIMULTANEOUS`（Votingフェイズ） |
| Phases | Idle → Discussion → Voting → Reveal → Evaluation → Consensus |
| Stages | 不要 |
| 遷移 | Facilitatorが`endsTurn: true`のアクションでトリガー |
| ロール | `unrestricted: true` + `validate()`でFacilitator制限 |
| Masking | Voting中は他プレイヤーのSelectedCard非公開 |

### Wevox Values Card（@edv4h/croupier-plugin-values-card）

| 要素 | 実装方法 |
|------|----------|
| TurnOrder | custom（ROUND_ROBIN系） |
| Phases | Setup → PlayerTurn (ループ) → Presentation |
| Stages | **使用**: WaitingForDraw → WaitingForDiscard |
| 遷移 | Stage `next()` — 手札6枚→WaitingForDiscard、5枚→`"__end__"` |
| 終了 | Phase `next()` — 山札0枚→Presentation |
| Masking | Deck非公開（枚数のみ）、他は全て公開 |

### デジタルTCG（@edv4h/croupier-plugin-digital-tcg）

| 要素 | 実装方法 |
|------|----------|
| TurnOrder | `ALTERNATING` |
| Phases | TurnStart → MainPhase → TurnEnd（交互ループ） |
| Stages | 不要 |
| 自動進行 | TurnStart/TurnEnd — `onEnter()`で処理、`next()`で即遷移 |
| 遷移 | `EndTurn`アクションの`endsTurn: true`でMainPhase終了 |
| 割り込み | `interrupts` — ライフ≤0 or ライブラリアウト |
| Masking | 各プレイヤーのDeck非公開、相手Hand非公開 |

---

## apps/demo アーキテクチャ

### サーバー（Hono.js）

```
Hono.js サーバー
  ├── REST API: ルーム作成・参加・ゲーム一覧
  ├── WebSocket: リアルタイム通信
  │   ├── クライアント → サーバー: { action, payload }
  │   ├── サーバー → クライアント: { playerView } (マスク済み状態)
  │   └── ブロードキャスト: フェイズ変更、ゲーム終了等
  └── GameManager
      ├── CroupierCore インスタンスをルームごとに管理
      ├── dispatch() をWebSocket経由で呼び出し
      └── playerView() を各クライアントに個別送信
```

### クライアント（Vite + React）

```
React SPA
  ├── game-selector: ゲーム選択 + ルーム作成/参加
  ├── use-game-state(): WebSocket hookでマスク済み状態を購読
  ├── 共通コンポーネント: game-board, player-hand, action-buttons
  └── ゲーム固有UI: 各ゲームの見た目をカスタマイズ
```

---

## 主要設計判断

| 判断 | 理由 |
|------|------|
| Turborepo モノレポ | core, plugins, docs, demo を統一管理。ビルド・テストの依存キャッシュ |
| ゲームを plugin-* パッケージに | 独立して開発・公開可能。サードパーティ製プラグインも可能 |
| @edv4h/croupier-core は純粋ロジック（DOM/IO依存なし） | サーバー/ブラウザ/テスト どこでも動作 |
| 2階層（Phase+Stage）、任意ネストなし | 4ゲーム全て2階層で表現可能。複雑さを避ける |
| TurnOrderを`first()`/`next()`戦略オブジェクトに | 逐次・交互・同時の3パターンを最小インターフェースで統一 |
| `endsTurn`フラグ | プレイヤー起動の遷移（EndTurn、StartVoting）を特殊化せず処理 |
| `unrestricted`フラグ | 進行役アクションがターン順序をバイパス。roleの`validate()`と併用 |
| `interrupts[]`を`endIf`と分離 | 正常終了と異常終了を明確に分離。割り込みはフェイズ非依存 |
| `playerView`は手動関数（宣言的APIなし） | ゲームごとのマスキングロジックが多様すぎてスキーマ化不可 |
| `"__end__"`センチネル | Stage→Phase遷移の明確なシグナル |
| ミドルウェアなし（v1） | イベントエミッター＋ライフサイクルフックで4ゲーム全て対応可能 |
| デモアプリで Hono + WebSocket | CroupierCoreのサーバーサイド実行 + リアルタイム状態配信を実証 |

---

## 実装順序

### Phase 1: 基盤
1. Turborepo + pnpm workspace 初期化、turbo.json設定
2. `packages/core` — types.ts（全インターフェース）
3. `packages/core` — turn-orders.ts（3組み込み + custom）
4. `packages/core` — croupier-core.ts（dispatch, フェイズマシン, バリデーション, イベント）
5. `packages/core` — util/（clone, random）
6. `packages/core` — テスト

### Phase 2: プラグイン
7. `packages/plugin-values-card` — 最シンプル、Stage検証
8. `packages/plugin-digital-tcg` — 自動進行、ALTERNATING、割り込み
9. `packages/plugin-planning-poker` — SIMULTANEOUS、unrestricted、roles
10. `packages/plugin-texas-holdem` — 最複雑、全機能総合検証

### Phase 3: アプリケーション
11. `apps/demo/server` — Hono.js + WebSocket + GameManager
12. `apps/demo/client` — React UI + use-game-state hook
13. `apps/docs` — Nextra ドキュメントサイト

---

## 検証方法

- `pnpm turbo test` で全パッケージのテスト一括実行
- 各プラグインで「フルゲームシナリオ」テスト（setup → 数アクション → ゲーム終了まで）
- State Masking: `getPlayerView()` が非公開情報を確実に隠蔽しているか
- 割り込み: 異常終了条件が任意のフェイズから正しく発火するか
- バリデーション: 不正アクション（フェイズ外、ターン外、条件未達）が拒否されるか
- デモアプリ: ブラウザで実際にゲームをプレイして動作確認
