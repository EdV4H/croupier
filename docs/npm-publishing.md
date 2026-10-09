# npm への公開

spire と同じく、公開 npm の `@edv4h` スコープに changesets と **GitHub OIDC の trusted publishing** で出す。長命の `NPM_TOKEN` は使わない。

## 公開するもの（7パッケージ）

```
@edv4h/croupier-core
@edv4h/croupier-plugin-daifugo
@edv4h/croupier-plugin-digital-tcg
@edv4h/croupier-plugin-planning-poker
@edv4h/croupier-plugin-texas-holdem
@edv4h/croupier-plugin-trust-bank
@edv4h/croupier-plugin-values-card
```

`apps/demo`・`apps/docs` は `private: true` なので publish されず、`.changeset/config.json` の `ignore` にも入れてある。

各パッケージは tsup で ESM（`dist/index.js`）と CJS（`dist/index.cjs`）と型定義を出す。`@edv4h/croupier-core` は `@edv4h/croupier-core/testing`（スナップショット往復テスト用ヘルパー）も出す。プラグインの `workspace:*` 依存は `pnpm publish` が実バージョンに置き換える。

## 初回のブートストラップ（未実施）

trusted publisher は **npm 上に既にあるパッケージにしか付けられない**ので、初回だけ手で publish する。それまで Release ワークフローはリポジトリ変数 `NPM_RELEASE` が `true` でない限り動かない。

```bash
npm install -g npm@latest                                    # npm >= 11.5.1
npm login --scope=@edv4h --registry=https://registry.npmjs.org/

git checkout main && git pull
pnpm install --frozen-lockfile
pnpm turbo build --filter='./packages/*'

# -r で依存順に7つ回る。pnpm publish は workspace:* を実バージョンに解決してから送る
pnpm publish -r --access public --registry https://registry.npmjs.org/

./scripts/setup-npm-trusted-publishers.sh
```

そのあと GitHub のリポジトリ設定（Settings → Secrets and variables → Actions → Variables）で `NPM_RELEASE=true` を足す。

- `--registry` を付けても `~/.npmrc` に `//registry.npmjs.org/:_authToken` が無いと匿名で PUT して `E404` になる（spire で踏んだもの）。`npm login` を先に済ませる。
- リポジトリが private のあいだは provenance が付かない見込み（npm は公開リポジトリからの publish にだけ provenance を付ける）。

## 平常運転

1. 公開パッケージを変える PR に changeset を添える（`pnpm changeset`）
2. main にマージすると Release ワークフローが「🎉 release: Version Packages」PR を作る。バージョンを上げ、CHANGELOG を書いた内容
3. その PR をマージすると同じワークフローが `pnpm run release`（パッケージのビルド → `changeset publish`）を実行して npm に publish する

## 公開されたかの確認

```bash
curl -s https://registry.npmjs.org/@edv4h/croupier-core/latest | jq .version
```

`npm search` は検索インデックスが遅れるので使わない。
