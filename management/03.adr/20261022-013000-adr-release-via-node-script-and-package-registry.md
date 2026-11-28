---
id: 20261022-013000-adr-release-via-node-script-and-package-registry
title: リリースを Node.js のスクリプトと CI_JOB_TOKEN で作成し、配布物を Generic Package Registry に置く
status: accepted
created: 2026-10-22 01:30:00
updated: 2026-10-22 01:30:00
superseded_by: null
discussions: []
tickets:
  - 20261021-124933-ticket-ci-build-and-release
---
# リリースを Node.js のスクリプトと CI_JOB_TOKEN で作成し、配布物を Generic Package Registry に置く

## 概要

GitLab のリリース作成を自前の Node.js スクリプト（`scripts/release.mjs`）と `CI_JOB_TOKEN` による API 呼び出しで行い、配布物（`main.js`・`manifest.json`）を Generic Package Registry に永続配置する（旧管理番号: ADR 0003）。

## 背景

- Item 0005 で、GitLab CI により検証とビルドを自動化し、バージョンのタグ（`vX.Y.Z`）ごとに GitLab の Releases にリリースを作ることにした。ビルド結果の `main.js` はリポジトリに含めない（`.gitignore` 対象）。
- GitLab は自前のサーバー（`gitlab.sasaki819.mydns.jp`）で、Runner は docker executor。Runner の既定のイメージ（Alpine）には Node.js がないため、テスト・ビルドのジョブは Node.js のイメージ（`node:24-bookworm-slim`）を指定する。
- リリースには、タグと `manifest.json`・`package.json` の `version` の照合、`CHANGELOG.md` からのリリースノートの取り出し、配布物（`main.js`・`manifest.json`）の添付が必要。照合の不備でリリースが作られることは避けたい。
- 配布物は、版ごとに期限なくダウンロードできる必要がある（プロジェクトは公開）。

## 決定事項

- **リリースは Node.js のスクリプト（`scripts/release.mjs`）で作る**（方式2）。
  - `check <tag>`：タグの形式、`manifest.json`・`package.json` の `version` との一致、`CHANGELOG.md` の節の有無を確かめる。GitLab の API を使わず、手元でも実行できる。
  - `publish <tag>`：`check` と同じ確認のあと、配布物をアップロードし、Releases API でリリースを作る（説明文は `CHANGELOG.md` の節）。
  - GitLab の API は、ジョブごとに発行される `CI_JOB_TOKEN`（`JOB-TOKEN` ヘッダー）で呼ぶ。追加のトークンは登録しない。HTTP の呼び出しは Node.js 組み込みの `fetch` を使う。
  - 照合・取り出しの処理は純粋関数（`scripts/release-lib.mjs`）にし、Vitest で単体テストする。
  - テスト・ビルドと同じ Node.js のイメージで動かす（リリース用に別のイメージを使わない）。
- **配布物は Generic Package Registry に置く**（方式4）。パッケージ名 `jotline`、バージョン `X.Y.Z` でアップロードし、リリースから `link_type: package` でリンクする。`direct_asset_path` で `<プロジェクトURL>/-/releases/vX.Y.Z/downloads/<file>` の固定の URL も用意する。
- リリース前チェックをパイプラインの test ステージに置き、失敗したらビルド・リリースのステージに進まないようにする。

## 採用理由

- リリースに必要なものが、Node.js のイメージと `CI_JOB_TOKEN` だけで済む。Item 0005 で、`CI_JOB_TOKEN` による Package Registry へのアップロードとリリースの作成ができることを、実際のタグで確認した。
- 照合の処理を単体テストでき、手元の `check` でリリース前に問題に気づける。照合に失敗したタグでは、リリースが作られない。
- 配布物は版ごとに期限なく保存され、公開プロジェクトではログインなしで固定の URL からダウンロードできる。

## 採用しなかった案

### 検討した方式

- リリースの作成
  1. GitLab の `release:` キーワードと `release-cli` のイメージ（GitLab の標準的な方法）
  2. Node.js のスクリプトから、GitLab の API（Releases API）を `CI_JOB_TOKEN` で呼ぶ
- 配布物の置き場所
  3. ジョブのアーティファクト（保存期間を無期限にしてリリースからリンク）
  4. Generic Package Registry（版ごとにアップロードしてリリースからリンク）

### 方式1・3を採らなかった理由

- 方式1：リリース用に別のイメージ（`registry.gitlab.com` からの取得）が必要になり、自前のサーバー・Runner の環境で取得できるかや、GitLab のバージョンによる `release-cli` の扱いの違いに依存する。照合の処理をテストしにくい。
- 方式3：アーティファクトは保存期間の設定や一括削除で消えうるため、版ごとの配布物の保存先として確実でない。

## 影響と見直し条件

### 悪い面・制約

- GitLab の API（Generic Package Registry、Releases API）と `CI_JOB_TOKEN` の権限に依存する。GitLab の更新や、Job Token の権限設定の変更で動かなくなった場合は、プロジェクトアクセストークンを CI/CD 変数に登録する方式に切り替える必要がある。
- GitLab 標準の `release:` キーワードを使わないため、リリース作成の処理を自前のスクリプトとして保守する。
- リリースの作成に失敗した場合（同じタグのリリースが既にある、など）は、アップロード済みの配布物が Package Registry に残る（やり直すと同じ版のファイルが重複する）。
- Generic Package Registry を無効にすると、リリースの配布物が置けなくなる。

### 今後必要になること

- リリースの手順は README の「Releasing」に従う。リリースをやり直す場合は、GitLab の画面でリリースとパッケージを削除してからタグを打ち直す。
- GitHub など別のホストへ移る場合は、このスクリプトの公開（`publish`）部分を置き換える。

## 関連

* 旧管理番号: ADR 0003（元ファイル: `docs/adr/0003-release-via-node-script-and-package-registry.md`）
* 関連チケット: [20261021-124933-ticket-ci-build-and-release](../04.tickets/archived/20261021-124933-ticket-ci-build-and-release/index.md)
