# 作業計画

## 合意した仕様

### 背景

- ビルド・テスト・lint・check-docs は手元で実行しており、自動では検証されていない。
- ビルド結果の `main.js` は `.gitignore` 対象でリポジトリに含まれず、利用者は README の手順に従って自分でビルドする必要がある。リリースした版（配布物）もまだない。
- Item 0004 では、動作確認に使ったビルドが意図した版と違っていた（配置先の取り違え）。どのビルドを使っているかを確かめにくい。
- 前提（2026-10-21 時点、ユーザーの説明による）:
  - GitLab は自前のサーバー（`gitlab.sasaki819.mydns.jp`）。プロジェクト用の GitLab Runner をセットアップ済みで、疎通確認済み。
  - Runner の executor は docker。タグなしのジョブも実行する設定。
  - ジョブでイメージを指定しない場合は、Runner の既定のイメージ（プレーンな Alpine）で動き、Node.js / npm がない。

### 目的

GitLab CI で検証とビルドを自動化し、ビルド結果をアーティファクトとして、またバージョンごとのリリースとして GitLab 上で管理する。利用者がビルドせずにプラグインを入手できるようにし、どの版を使っているかを明確にする。

### スコープ

#### パイプラインを動かす対象

- MR（マージリクエスト）、`main` ブランチへの push、タグの push のときだけ、パイプラインを動かす。
- MR のない `item/*` などのブランチへの push では動かさない。MR を作るとそのブランチの変更で動く。同じ変更に対してパイプラインが二重に動かないようにする。

#### 検証とビルド（すべてのパイプライン）

- 次のジョブを実行し、いずれかが失敗したらパイプラインを失敗させる。
  - check-docs（ai-dev-standard の `ci/ai-standard.gitlab-ci.yml` を取り込む）
  - テスト（`npm test`）
  - lint（`npx tsc --noEmit`）
  - ビルド（`npm run build`）
- テスト・lint・ビルドのジョブは、Node.js のイメージを明示的に指定して実行する（Runner の既定のイメージに依存しない）。
- ビルドのジョブは、`main.js` と `manifest.json` をアーティファクトとして保存し、GitLab の画面からダウンロードできるようにする。保存期間は **30日**（ブランチごとの最新のアーティファクトは、GitLab の既定の設定により期限後も残る）。

#### リリース（バージョンのタグの push）

- `vX.Y.Z` 形式（`X`・`Y`・`Z` は数字。例：`v1.0.0`）のタグを push したときに、リリースを作る。それ以外のタグでは、検証とビルドだけを行う。
- リリースの前に次を確かめ、どれかを満たさなければパイプラインを失敗させ、リリースを作らない。
  - タグのバージョン `X.Y.Z` が、`manifest.json` の `version` および `package.json` の `version` と一致する。
  - `CHANGELOG.md` に、そのバージョンの節がある。
  - 検証とビルドのジョブがすべて成功している。
- リリースでは次を行う。
  - そのタグでビルドした `main.js` と `manifest.json` を、GitLab の **Generic Package Registry** に、バージョンごとにアップロードする（期限なく保存される）。
  - GitLab の Releases に、タグの版のリリースを作る。説明文は `CHANGELOG.md` の該当バージョンの節。添付（リンク）として、Package Registry の `main.js` と `manifest.json` をダウンロードできるようにする。

#### CHANGELOG.md

- リポジトリ直下に `CHANGELOG.md` を新しく作る。**英語**で書く。
- バージョンごとに節を設ける（`## [X.Y.Z] - YYYY-MM-DD` の形式）。
- 初回のリリースは **1.0.0**（`manifest.json` と `package.json` の現在の値）とし、1.0.0 の節に現在の主な機能をまとめて書く。

#### README.md とリリース手順

- インストール手順を、「基本は Releases から `main.js` と `manifest.json` を取得して配置する。ソースからビルドして配置してもよい」という形にする。既存の「ソースからビルドして配置する」手順は残す。
- 開発者向けに、リリースの手順（`manifest.json`・`package.json` の `version` を上げる、`CHANGELOG.md` に節を追加する、`vX.Y.Z` のタグを打って push する）を README に書く。

### スコープ外

- GitHub への対応（GitHub Actions など）。
- Obsidian のコミュニティプラグインの公式一覧への登録と、そのための `versions.json`。
- バージョン番号の自動付与（タグや `version` の更新は人が行う）。
- MR のない `item/*` ブランチへの push でのパイプライン実行。
- ビルド結果の Vault への自動配置。
- GitLab サーバーと Runner 自体の設定・運用（Package Registry の有効化、容量の上限など）。必要な設定がされていない場合は、着手時に相談する。
- これまでのバージョン（1.0.0 より前）の変更履歴の整理（1.0.0 の節にまとめる）。

### 受入基準

- [ ] AC1: MR のパイプラインで、check-docs・テスト・lint・ビルドのジョブが実行され、すべて成功する。いずれかのジョブが失敗すると、パイプラインが失敗する（GitLab 上で確認）。
- [ ] AC2: `main` ブランチへの push とタグの push でもパイプラインが動き、MR のない `item/*` ブランチへの push では動かない。同じ変更に対してパイプラインが二重に動かない（GitLab 上で確認）。
- [ ] AC3: テスト・lint・ビルドのジョブで、指定した Node.js のイメージが使われている（ジョブのログで確認）。
- [ ] AC4: ビルドのジョブのアーティファクトとして `main.js` と `manifest.json` が保存され、GitLab の画面からダウンロードでき、保存期間が30日になっている（GitLab 上で確認）。ダウンロードした `main.js` を Vault に配置すると、プラグインとして動作する（Obsidian 上で確認）。
- [ ] AC5: `v1.0.0` のタグを push すると、Releases に v1.0.0 のリリースが作られ、説明文が `CHANGELOG.md` の 1.0.0 の節になり、添付のリンクから `main.js` と `manifest.json` をダウンロードできる。これらは Package Registry に保存されている（GitLab 上で確認）。
- [ ] AC6: タグのバージョンと `manifest.json` / `package.json` の `version` が一致しない場合、または `CHANGELOG.md` にそのバージョンの節がない場合に、パイプラインが失敗し、リリースが作られない（判定の処理は手元で実行・テストして確認し、パイプラインでの失敗は GitLab 上で確認）。
- [ ] AC7: `vX.Y.Z` 形式以外のタグでは、検証とビルドだけが行われ、リリースは作られない（GitLab 上で確認）。
- [ ] AC8: `CHANGELOG.md` が英語で作られ、1.0.0 の節に現在の主な機能がまとめられている。README のインストール手順が「基本は Releases から取得、ソースからビルドして配置してもよい」の形になり、既存のビルド手順が残っている。README にリリースの手順が書かれている。
- [ ] AC9: プラグインの動作を変えない。手元で `npm run build`、`npm test`、`npx tsc --noEmit` がすべて成功する。

### 関連

- Item: [backlog/items/0005-ci-build-and-release.md](index.md)
- Discussion: なし
- ADR: なし

## ステップ一覧

<!--
- 1 Task はおおむね1セッションで完結する粒度にする。
- 各 Task に「完了条件」と「検証コマンド」を書く。
- 依存関係がある場合は Task 名の末尾に (after: 2) のように書く。
- 検証コマンドが成功した場合だけチェックを入れる。
- 末尾の2つの固定 Task は削除しない。
-->

- [x] 1. CHANGELOG.md とリリースのスクリプトを作る
  - 内容: `CHANGELOG.md`（英語。1.0.0 の節。日付は仮）を作る。`scripts/release-lib.mjs`（`parseVersionTag`、`checkVersions`、`extractChangelogSection`、`buildPackageFileUrl`）と、`scripts/release-lib.test.mjs`（design の「テスト方針」の項目）、`scripts/release.mjs`（`check` と `publish`）を作る。
  - 完了条件: 単体テストと既存のテストが成功し、lint とビルドが通る。`check` が `v1.0.0` で成功し、`v9.9.9`（バージョン不一致）と `1.0.0`（形式違い）で失敗する。CI の変数がない環境で `publish` を実行すると、何もせずに失敗する。
  - 検証コマンド: `npm test`、`npx tsc --noEmit`、`npm run build`、`node scripts/release.mjs check v1.0.0`（成功）、`node scripts/release.mjs check v9.9.9`（失敗）、`node scripts/release.mjs check 1.0.0`（失敗）、`node scripts/release.mjs publish v1.0.0`（失敗）
- [x] 2. README.md のインストール手順とリリース手順を更新する (after: 1)
  - 内容: Installation を「基本は Releases から取得、ソースからビルドして配置してもよい」の形にする（既存のビルド手順は残す）。開発者向けの Releasing の節（version の更新、CHANGELOG の節の追加、`check` での事前確認、タグの push）を追加する。
  - 完了条件: AC8 の README に関する項目を満たす。check-docs が通る。
  - 検証コマンド: `bash tools/ai-standard/check-docs.sh`
- [x] 3. `.gitlab-ci.yml` を作る (after: 1)
  - 内容: design の「`.gitlab-ci.yml`」のとおり、`workflow:rules`（MR・既定ブランチ・タグ）、ステージ（test・build・release）、`.node`（`node:24-bookworm-slim`、npm のキャッシュ、`npm ci`）、ジョブ（check-docs の取り込み、`test`、`lint`、`release:check`、`build`、`release:publish`）を定義する。
  - 完了条件: YAML として正しく読み込める。手元のビルド・テスト・lint が通る。
  - 検証コマンド: YAML の構文確認（`python3 -c 'import yaml,sys; yaml.safe_load(open(".gitlab-ci.yml"))'` など。使えない場合は GitLab の CI Lint を人に依頼）、`npm test`、`npx tsc --noEmit`、`npm run build`
- [x] 4. GitLab 上でパイプラインを確認する (after: 2, 3)
  - 内容: **人が** GitLab 上で次を確認し、結果を progress.md に記録する。あわせて design の「実装時に確認すること」（Package Registry の有効化、プロジェクトの公開範囲、Docker Hub からのイメージ取得）も確認する。
    - AC2: ブランチ `item/0005-ci-build-and-release` を push しただけでは、パイプラインが動かない。
    - AC1・AC3: MR を作ると、MR のパイプラインで check-docs・テスト・lint・ビルドが動いて成功する。テスト・lint・ビルドのログで `node:24-bookworm-slim` が使われている。同じ変更でブランチのパイプラインが二重に動いていない。
    - AC4: ビルドのジョブのアーティファクト（`main.js`・`manifest.json`）を画面からダウンロードでき、保存期間が30日になっている。ダウンロードした `main.js` を検証用 Vault（`~/vault/vault/.obsidian/plugins/jotline/`）に配置すると動作する。
  - 完了条件: 上記がすべて確認され、結果が progress.md に記録されている。不具合があれば修正し、Task 3 の検証コマンドを再実行している。
  - 検証コマンド: GitLab 上・Obsidian 上での手動確認（結果を progress.md に記録）
- [x] 5. GitLab 上でリリースを確認する (after: 4)
  - 内容: **人が** item ブランチの上でタグを打って、次を確認し、結果を progress.md に記録する。確認に使ったタグ・リリース・パッケージの扱いは下記のとおり。
    - AC6: `manifest.json` と一致しないバージョンのタグ（例：`v9.9.9`）を push すると、`release:check` が失敗してパイプラインが失敗し、リリースが作られない。→ 確認後、タグを削除する。
    - AC7: `vX.Y.Z` 形式でないタグ（例：`ci-test-1`）を push すると、検証とビルドだけが動き、リリースは作られない。→ 確認後、タグを削除する。
    - AC5: `v1.0.0` のタグを push すると、Releases に v1.0.0 が作られ、説明文が CHANGELOG の 1.0.0 の節になり、添付のリンク（および `/-/releases/v1.0.0/downloads/main.js`）から `main.js` と `manifest.json` をダウンロードできる。ファイルは Package Registry（`jotline` / `1.0.0`）にある。→ 確認後の扱い（そのまま正式リリースとして残すか、リリース・タグ・パッケージを削除してマージ後に改めてリリースするか）は、その時点でユーザーが決める。
    - design の「実装時に確認すること」のうち、`CI_JOB_TOKEN` でアップロードとリリースの作成ができること。
  - 完了条件: 上記がすべて確認され、結果と、確認に使ったタグ等の後始末が progress.md に記録されている。不具合があれば修正し、関連する Task の検証コマンドを再実行している。
  - 検証コマンド: GitLab 上での手動確認（結果を progress.md に記録）。あわせて `npm test`、`npx tsc --noEmit`、`npm run build`
- [x] マスタードキュメント（docs/architecture/）へ design の内容を反映
  - 完了条件: design.md の内容が docs/architecture/ に反映されている（不要なら「不要」と理由を progress.md に記載）
  - 反映先の想定: `01.Architecture.md` の技術スタック（CI）と、ビルド・リリースの仕組み（新しい節、または新しい文書）。`docs/architecture/README.md` の文書一覧。
- [x] ADR の要否判断（必要なら作成）
  - 完了条件: 要否と理由を progress.md に記載し、必要なら docs/adr/ に ADR を作成している

## 検証方針

- **`scripts/release-lib.test.mjs`（Vitest）**：
  - `parseVersionTag`：`v1.0.0`・`v10.20.30` は受け付け、`1.0.0`・`v1.0`・`v1.0.0-beta`・`release-1` は `null`。
  - `checkVersions`：一致、manifest だけ不一致、package だけ不一致、両方不一致。
  - `extractChangelogSection`：先頭・途中・末尾の節の取り出し、節がない場合、本文が空の場合、似たバージョン（`1.0.0` と `1.0.10`）を取り違えないこと。
  - `buildPackageFileUrl`：URL の組み立て。
- **手元での確認**：`node scripts/release.mjs check v1.0.0` が成功し、`v9.9.9`（バージョン不一致）で失敗することを確かめる（AC6 の判定の処理）。
- **GitLab 上での確認**（人が行う）：MR のパイプライン（AC1・AC3・AC4）、`main` とタグのパイプライン、`item/*` への push で動かないこと（AC2）、`v1.0.0` のタグでのリリース（AC5）、バージョン不一致のタグでの失敗（AC6）、`vX.Y.Z` 以外のタグ（AC7）。不一致や形式違いの確認に使ったタグは、確認後に削除する。
- `.gitlab-ci.yml` の書式は、GitLab の CI Lint（パイプラインエディタ）でも確認できる。

詳細な設計書は [notes/001-design.md](notes/001-design.md) を参照。

## 判断ログ

作業中の判断履歴と詳細な作業ログは [notes/002-progress.md](notes/002-progress.md) に保存している。
