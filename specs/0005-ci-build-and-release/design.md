# design: 0005 GitLab CI でテスト・ビルドを自動化し、ビルド結果をアーティファクトとリリースで管理する

> これは本 Item による変更分の設計であり、全体のマスターは docs/architecture/ にある。
> Item 完了時に、この内容を docs/architecture/ へ反映する。

## 変更の概要

- リポジトリ直下に `.gitlab-ci.yml` を作り、パイプラインを **test → build → release** の3ステージで構成する。
  - test：check-docs（ai-dev-standard の取り込み）、テスト、lint、リリース前チェック（バージョンのタグのときだけ）
  - build：ビルドと、`main.js`・`manifest.json` のアーティファクト保存
  - release：Package Registry へのアップロードと Releases の作成（バージョンのタグのときだけ）
- パイプラインを動かす対象は、`workflow:rules` で MR・`main` ブランチ・タグに限る。
- リリースの処理（バージョンの照合、CHANGELOG の節の取り出し、Package Registry へのアップロード、Releases の作成）は、Node.js のスクリプト `scripts/release.mjs` にまとめる。照合と取り出しの部分は純粋関数（`scripts/release-lib.mjs`）にして、Vitest で単体テストする。
  - GitLab の API は、ジョブごとに発行される `CI_JOB_TOKEN` で呼ぶ。追加のトークンの登録は不要。
  - テスト・ビルドと同じ Node.js のイメージで動くため、リリース用に別のイメージ（`release-cli` など）を使わない。
- `CHANGELOG.md`（英語）を新しく作り、README のインストール手順とリリース手順を更新する。

## 影響範囲

| ファイル | 変更内容 |
|---|---|
| `.gitlab-ci.yml`（新規） | パイプラインの定義 |
| `scripts/release-lib.mjs`（新規） | バージョンの照合、CHANGELOG の節の取り出しなどの純粋関数 |
| `scripts/release-lib.test.mjs`（新規） | 上記の単体テスト |
| `scripts/release.mjs`（新規） | リリース前チェック（`check`）と公開（`publish`）のコマンド |
| `CHANGELOG.md`（新規） | 変更履歴（英語）。1.0.0 の節 |
| `README.md` | インストール手順（Releases からの取得を基本に、既存のビルド手順も残す）、リリース手順 |

- 変更しないもの：プラグインのソース（`src/`）、ビルド設定（`esbuild.config.mjs`）、`manifest.json`・`package.json`（version は 1.0.0 のまま）、ai-dev-standard の管理ファイル（`ci/ai-standard.gitlab-ci.yml` は取り込むだけ）。
- `scripts/` は `tsconfig.json` の対象（`src/**`）外のため、`npx tsc --noEmit` の対象にはならない。Vitest の既定のテストファイルの探索（`**/*.test.mjs` を含む）で、`scripts/release-lib.test.mjs` も `npm test` で実行される。

## 構成とコンポーネント

### `.gitlab-ci.yml`

```yaml
include:
  - local: ci/ai-standard.gitlab-ci.yml   # ai-standard:check-docs（stage: test）

workflow:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
    - if: $CI_COMMIT_TAG
    - when: never          # MR のない item/* ブランチへの push などでは動かさない

stages: [test, build, release]

.node:                     # テスト・lint・ビルド・リリースの共通設定
  image: node:24-bookworm-slim
  cache:
    key:
      files: [package-lock.json]
    paths: [.npm/]
  before_script:
    - npm ci --cache .npm --prefer-offline

test:         { extends: .node, stage: test,  script: [npm test] }
lint:         { extends: .node, stage: test,  script: [npx tsc --noEmit] }

release:check:              # バージョンのタグのときだけ
  extends: .node
  stage: test
  rules:
    - if: $CI_COMMIT_TAG =~ /^v\d+\.\d+\.\d+$/
  script: [node scripts/release.mjs check "$CI_COMMIT_TAG"]

build:
  extends: .node
  stage: build
  script: [npm run build]
  artifacts:
    name: "jotline-$CI_COMMIT_REF_SLUG-$CI_COMMIT_SHORT_SHA"
    paths: [main.js, manifest.json]
    expire_in: 30 days

release:publish:            # バージョンのタグのときだけ
  extends: .node
  stage: release
  rules:
    - if: $CI_COMMIT_TAG =~ /^v\d+\.\d+\.\d+$/
  script: [node scripts/release.mjs publish "$CI_COMMIT_TAG"]
```

- 上は構成を示すための概略で、実際のファイルは YAML の通常の書式で書く。
- **イメージ**：`node:24-bookworm-slim`（手元と同じ Node 24 系。Debian ベースで、`npm ci` に必要なものがそろう）。Runner の既定のイメージ（Alpine）には依存しない。check-docs のジョブは、ai-dev-standard 側の定義どおり `debian:stable-slim` で動く。
- **キャッシュ**：`package-lock.json` が変わらない限り、npm のダウンロードキャッシュ（`.npm/`）を使い回す。各ジョブで `npm ci` を実行する。
- **ステージの順序**：test のジョブ（check-docs・テスト・lint・リリース前チェック）がすべて成功してから build、build が成功してから release が動く（GitLab の既定の動作）。いずれかが失敗するとパイプラインが失敗し、以降のステージは動かない。
- **アーティファクト**：build のアーティファクトは、後続の release ステージのジョブに自動で渡される（`release:publish` は、そのタグでビルドした `main.js` を使う）。
- **重複の防止**：`workflow:rules` で MR・既定ブランチ・タグ以外を `never` にすることで、MR を作ったブランチへの push では MR のパイプラインだけが動く（ブランチのパイプラインと二重にならない）。

### リリースのスクリプト

#### `scripts/release-lib.mjs`（純粋関数）

- `parseVersionTag(tag)`：`vX.Y.Z` 形式なら `X.Y.Z` を返し、それ以外は `null`。
- `checkVersions(tagVersion, manifestVersion, packageVersion)`：3つが一致しなければ、どれが食い違っているかを示すエラーメッセージの配列を返す（一致すれば空配列）。
- `extractChangelogSection(changelog, version)`：`CHANGELOG.md` の本文から、`## [X.Y.Z]` で始まる節の本文（見出しの次の行から、次の `## ` 見出しの直前まで）を取り出して返す。節がない、または本文が空なら `null`。
- `buildPackageFileUrl(apiUrl, projectId, version, fileName)`：Generic Package Registry のファイルの URL（`<api>/projects/<id>/packages/generic/jotline/<version>/<file>`）を組み立てる。

#### `scripts/release.mjs`（コマンド）

- `node scripts/release.mjs check <tag>`
  - タグの形式、バージョンの一致（`manifest.json`・`package.json`）、CHANGELOG の節の有無を確かめる。問題があれば理由を表示して終了コード1で終わる。
  - GitLab の API は使わないため、**手元でもそのまま実行できる**（リリース前の確認に使う）。
- `node scripts/release.mjs publish <tag>`
  1. `check` と同じ確認を行う。
  2. `main.js` と `manifest.json` を、Generic Package Registry（パッケージ名 `jotline`、バージョン `X.Y.Z`）にアップロードする（`PUT .../packages/generic/jotline/<version>/<file>`、ヘッダー `JOB-TOKEN: $CI_JOB_TOKEN`）。
  3. Releases API（`POST .../projects/<id>/releases`、ヘッダー `JOB-TOKEN`）でリリースを作る。
     - `tag_name`：タグ、`name`：`JotLine vX.Y.Z`、`description`：CHANGELOG の該当節
     - `assets.links`：`main.js` と `manifest.json` の Package Registry の URL。`link_type: package`、`direct_asset_path` は `/main.js`・`/manifest.json`（`<プロジェクトURL>/-/releases/vX.Y.Z/downloads/main.js` の固定の URL でもダウンロードできるようにする）。
  - GitLab の API の URL やプロジェクト ID は、CI の定義済み変数（`CI_API_V4_URL`、`CI_PROJECT_ID`、`CI_JOB_TOKEN`）から取る。これらがない環境（手元）で `publish` を実行した場合は、何もせずエラーで終わる。
  - HTTP の呼び出しは、Node.js 組み込みの `fetch` を使う（追加の依存パッケージなし）。

### CHANGELOG.md

```markdown
# Changelog

All notable changes to JotLine are documented in this file.
The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [1.0.0] - YYYY-MM-DD

### Added
- Chat-style quick capture ...
- ...
```

- 英語。節の見出しは `## [X.Y.Z] - YYYY-MM-DD`（日付はリリースする日）。`extractChangelogSection` はこの見出しの形を前提にする。
- 1.0.0 の節には、README の Features をもとに主な機能（クイックキャプチャ、スレッド、複数選択、Markdown エクスポート、アンドゥ／リドゥ、D&D による移動・コピー、多言語対応など）をまとめて書く。日付は、実際にタグを打つときに決める（実装時は仮の日付を置き、リリース時に更新する手順を README に書く）。

### README.md

- **Installation**：
  - 基本の方法として「Releases から `main.js` と `manifest.json` を取得して、`.obsidian/plugins/jotline/` に配置する」を先に書く。Releases のページ（`<プロジェクトURL>/-/releases`）への案内を含める。
  - 既存の「ソースからビルドして配置する」手順は、もう一つの方法として残す。
- **Releasing（開発者向け）**：`manifest.json` と `package.json` の `version` を上げる → `CHANGELOG.md` に節を追加する（日付を含む）→ `node scripts/release.mjs check vX.Y.Z` で事前確認 → コミットして main にマージ → `vX.Y.Z` のタグを打って push、の手順を書く。

## インタフェース

```js
// scripts/release-lib.mjs
export function parseVersionTag(tag: string): string | null;
export function checkVersions(tagVersion: string, manifestVersion: string, packageVersion: string): string[];
export function extractChangelogSection(changelog: string, version: string): string | null;
export function buildPackageFileUrl(apiUrl: string, projectId: string, version: string, fileName: string): string;
```

```sh
node scripts/release.mjs check <tag>     # 手元でも CI でも実行できる。問題があれば終了コード 1
node scripts/release.mjs publish <tag>   # CI（タグのパイプライン）専用
```

## データモデル

- Generic Package Registry：パッケージ名 `jotline`、バージョン `X.Y.Z`、ファイル `main.js`・`manifest.json`。
- Release：タグ `vX.Y.Z`、名前 `JotLine vX.Y.Z`、説明文は CHANGELOG の節、リンク2件（`main.js`・`manifest.json`）。
- プラグインのデータフォーマットには影響しない。

## エラー処理

- **リリース前チェックの失敗**（タグの形式、バージョンの不一致、CHANGELOG の節がない）：`release:check` が理由を表示して失敗し、パイプラインが失敗する。build と release のステージは動かない（リリースは作られない）。
- **アップロードの失敗**：`release:publish` が HTTP のステータスと応答本文を表示して失敗する。リリースはまだ作っていないため、中途半端なリリースは残らない。
- **リリースの作成の失敗**（同じタグのリリースが既にある、など）：応答を表示して失敗する。アップロード済みのファイルは Package Registry に残る。ジョブをやり直す場合は、同じバージョンのファイルが重複してアップロードされるが、リンクは最新のファイルを指す。
- **CI の変数がない環境での `publish`**：何もせず、理由を表示して失敗する。

## テスト方針

- **`scripts/release-lib.test.mjs`（Vitest）**：
  - `parseVersionTag`：`v1.0.0`・`v10.20.30` は受け付け、`1.0.0`・`v1.0`・`v1.0.0-beta`・`release-1` は `null`。
  - `checkVersions`：一致、manifest だけ不一致、package だけ不一致、両方不一致。
  - `extractChangelogSection`：先頭・途中・末尾の節の取り出し、節がない場合、本文が空の場合、似たバージョン（`1.0.0` と `1.0.10`）を取り違えないこと。
  - `buildPackageFileUrl`：URL の組み立て。
- **手元での確認**：`node scripts/release.mjs check v1.0.0` が成功し、`v9.9.9`（バージョン不一致）で失敗することを確かめる（AC6 の判定の処理）。
- **GitLab 上での確認**（人が行う）：MR のパイプライン（AC1・AC3・AC4）、`main` とタグのパイプライン、`item/*` への push で動かないこと（AC2）、`v1.0.0` のタグでのリリース（AC5）、バージョン不一致のタグでの失敗（AC6）、`vX.Y.Z` 以外のタグ（AC7）。不一致や形式違いの確認に使ったタグは、確認後に削除する。
- `.gitlab-ci.yml` の書式は、GitLab の CI Lint（パイプラインエディタ）でも確認できる。

## 検討した代替案

| 案 | 内容 | 採用しなかった理由 |
|---|---|---|
| `release:` キーワードと `release-cli` のイメージでリリースを作る | GitLab の標準的な方法 | リリース用に別のイメージ（`registry.gitlab.com` からの取得）が必要になり、自前のサーバー・Runner の環境で取得できるか、また GitLab のバージョンによる `release-cli` の扱いの違いに依存する。Node.js のスクリプトなら、テスト・ビルドと同じイメージで動き、照合の処理も単体テストできる |
| ジョブのアーティファクトへのリンクをリリースに添付する | アーティファクトの保存期間を無期限にしてリンクする | requirements で Generic Package Registry に保存すると決めた（アーティファクトは一括削除などで消えうる） |
| テストと lint を1つのジョブにまとめる | `npm ci` の回数を減らす | 失敗したときにどちらが原因か GitLab の画面で分かりやすいよう、requirements のとおり分けた。`npm ci` はキャッシュで速くする |
| リリースのスクリプトを TypeScript で書く | `src/` と同じ言語にする | ビルドの手順なしに Node.js でそのまま実行できるよう、`.mjs`（JavaScript）にした |

### 実装時に確認すること

- 自前の GitLab で、Generic Package Registry が有効になっているか（プロジェクトの「デプロイ → パッケージレジストリ」が表示されるか）。無効なら、着手前に相談する。
- `CI_JOB_TOKEN` で、Generic Package Registry へのアップロードと Releases API でのリリースの作成ができるか（GitLab のバージョン・設定による）。できない場合は、プロジェクトアクセストークンを CI/CD 変数に登録する方法に切り替える（その場合は相談する）。
- プロジェクトの公開範囲によっては、リリースの添付ファイルのダウンロードにログインが必要になる（非公開のプロジェクトの場合）。README の案内に影響するため確認する。
- Runner から Docker Hub の `node:24-bookworm-slim` を取得できるか。
