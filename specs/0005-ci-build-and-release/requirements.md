# requirements: 0005 GitLab CI でテスト・ビルドを自動化し、ビルド結果をアーティファクトとリリースで管理する

## 背景

- ビルド・テスト・lint・check-docs は手元で実行しており、自動では検証されていない。
- ビルド結果の `main.js` は `.gitignore` 対象でリポジトリに含まれず、利用者は README の手順に従って自分でビルドする必要がある。リリースした版（配布物）もまだない。
- Item 0004 では、動作確認に使ったビルドが意図した版と違っていた（配置先の取り違え）。どのビルドを使っているかを確かめにくい。
- 前提（2026-10-21 時点、ユーザーの説明による）:
  - GitLab は自前のサーバー（`gitlab.sasaki819.mydns.jp`）。プロジェクト用の GitLab Runner をセットアップ済みで、疎通確認済み。
  - Runner の executor は docker。タグなしのジョブも実行する設定。
  - ジョブでイメージを指定しない場合は、Runner の既定のイメージ（プレーンな Alpine）で動き、Node.js / npm がない。

## 目的

GitLab CI で検証とビルドを自動化し、ビルド結果をアーティファクトとして、またバージョンごとのリリースとして GitLab 上で管理する。利用者がビルドせずにプラグインを入手できるようにし、どの版を使っているかを明確にする。

## スコープ

### パイプラインを動かす対象

- MR（マージリクエスト）、`main` ブランチへの push、タグの push のときだけ、パイプラインを動かす。
- MR のない `item/*` などのブランチへの push では動かさない。MR を作るとそのブランチの変更で動く。同じ変更に対してパイプラインが二重に動かないようにする。

### 検証とビルド（すべてのパイプライン）

- 次のジョブを実行し、いずれかが失敗したらパイプラインを失敗させる。
  - check-docs（ai-dev-standard の `ci/ai-standard.gitlab-ci.yml` を取り込む）
  - テスト（`npm test`）
  - lint（`npx tsc --noEmit`）
  - ビルド（`npm run build`）
- テスト・lint・ビルドのジョブは、Node.js のイメージを明示的に指定して実行する（Runner の既定のイメージに依存しない）。
- ビルドのジョブは、`main.js` と `manifest.json` をアーティファクトとして保存し、GitLab の画面からダウンロードできるようにする。保存期間は **30日**（ブランチごとの最新のアーティファクトは、GitLab の既定の設定により期限後も残る）。

### リリース（バージョンのタグの push）

- `vX.Y.Z` 形式（`X`・`Y`・`Z` は数字。例：`v1.0.0`）のタグを push したときに、リリースを作る。それ以外のタグでは、検証とビルドだけを行う。
- リリースの前に次を確かめ、どれかを満たさなければパイプラインを失敗させ、リリースを作らない。
  - タグのバージョン `X.Y.Z` が、`manifest.json` の `version` および `package.json` の `version` と一致する。
  - `CHANGELOG.md` に、そのバージョンの節がある。
  - 検証とビルドのジョブがすべて成功している。
- リリースでは次を行う。
  - そのタグでビルドした `main.js` と `manifest.json` を、GitLab の **Generic Package Registry** に、バージョンごとにアップロードする（期限なく保存される）。
  - GitLab の Releases に、タグの版のリリースを作る。説明文は `CHANGELOG.md` の該当バージョンの節。添付（リンク）として、Package Registry の `main.js` と `manifest.json` をダウンロードできるようにする。

### CHANGELOG.md

- リポジトリ直下に `CHANGELOG.md` を新しく作る。**英語**で書く。
- バージョンごとに節を設ける（`## [X.Y.Z] - YYYY-MM-DD` の形式）。
- 初回のリリースは **1.0.0**（`manifest.json` と `package.json` の現在の値）とし、1.0.0 の節に現在の主な機能をまとめて書く。

### README.md とリリース手順

- インストール手順を、「基本は Releases から `main.js` と `manifest.json` を取得して配置する。ソースからビルドして配置してもよい」という形にする。既存の「ソースからビルドして配置する」手順は残す。
- 開発者向けに、リリースの手順（`manifest.json`・`package.json` の `version` を上げる、`CHANGELOG.md` に節を追加する、`vX.Y.Z` のタグを打って push する）を README に書く。

## スコープ外

- GitHub への対応（GitHub Actions など）。
- Obsidian のコミュニティプラグインの公式一覧への登録と、そのための `versions.json`。
- バージョン番号の自動付与（タグや `version` の更新は人が行う）。
- MR のない `item/*` ブランチへの push でのパイプライン実行。
- ビルド結果の Vault への自動配置。
- GitLab サーバーと Runner 自体の設定・運用（Package Registry の有効化、容量の上限など）。必要な設定がされていない場合は、着手時に相談する。
- これまでのバージョン（1.0.0 より前）の変更履歴の整理（1.0.0 の節にまとめる）。

## 受入基準

- [ ] AC1: MR のパイプラインで、check-docs・テスト・lint・ビルドのジョブが実行され、すべて成功する。いずれかのジョブが失敗すると、パイプラインが失敗する（GitLab 上で確認）。
- [ ] AC2: `main` ブランチへの push とタグの push でもパイプラインが動き、MR のない `item/*` ブランチへの push では動かない。同じ変更に対してパイプラインが二重に動かない（GitLab 上で確認）。
- [ ] AC3: テスト・lint・ビルドのジョブで、指定した Node.js のイメージが使われている（ジョブのログで確認）。
- [ ] AC4: ビルドのジョブのアーティファクトとして `main.js` と `manifest.json` が保存され、GitLab の画面からダウンロードでき、保存期間が30日になっている（GitLab 上で確認）。ダウンロードした `main.js` を Vault に配置すると、プラグインとして動作する（Obsidian 上で確認）。
- [ ] AC5: `v1.0.0` のタグを push すると、Releases に v1.0.0 のリリースが作られ、説明文が `CHANGELOG.md` の 1.0.0 の節になり、添付のリンクから `main.js` と `manifest.json` をダウンロードできる。これらは Package Registry に保存されている（GitLab 上で確認）。
- [ ] AC6: タグのバージョンと `manifest.json` / `package.json` の `version` が一致しない場合、または `CHANGELOG.md` にそのバージョンの節がない場合に、パイプラインが失敗し、リリースが作られない（判定の処理は手元で実行・テストして確認し、パイプラインでの失敗は GitLab 上で確認）。
- [ ] AC7: `vX.Y.Z` 形式以外のタグでは、検証とビルドだけが行われ、リリースは作られない（GitLab 上で確認）。
- [ ] AC8: `CHANGELOG.md` が英語で作られ、1.0.0 の節に現在の主な機能がまとめられている。README のインストール手順が「基本は Releases から取得、ソースからビルドして配置してもよい」の形になり、既存のビルド手順が残っている。README にリリースの手順が書かれている。
- [ ] AC9: プラグインの動作を変えない。手元で `npm run build`、`npm test`、`npx tsc --noEmit` がすべて成功する。

## 関連

- Item: [backlog/items/0005-ci-build-and-release.md](../../backlog/items/0005-ci-build-and-release.md)
- Discussion: なし
- ADR: なし
