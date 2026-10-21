---
id: "0005"
title: "GitLab CI でテスト・ビルドを自動化し、ビルド結果をアーティファクトとリリースで管理する"
status: done        # backlog / ready / in-progress / done / dropped
priority: medium       # high / medium / low
owner: ""
created: 2026-10-21
spec: "specs/0005-ci-build-and-release/"            # 例: specs/0012-login-rework/（Spec を作らない場合は空）
discussions: []        # 例: [discussions/2026-10-15-auth-ideas.md]
---
## 概要

現状、ビルド・テスト・lint・check-docs は手元で実行しており、ビルド結果の `main.js` は `.gitignore` 対象のためリポジトリに含まれない。利用者は README の手順に従って自分でビルドする必要がある。また、プラグインの配置ミス（Item 0004 で、別の場所に配置した古いビルドで動作確認していた件）のように、どのビルドを使っているかが曖昧になりやすい。

GitLab CI（`.gitlab-ci.yml`）を整備し、次を実現する。

1. push と MR ごとに、check-docs・テスト・lint・ビルドを自動で実行する。
2. ビルド結果（`main.js`、`manifest.json`）を、ジョブのアーティファクトとして GitLab 上に保存し、ダウンロードできるようにする。
3. バージョンのタグ（例：`v1.0.0`）を打ったときに、GitLab の Releases に版を登録し、`main.js` と `manifest.json` を添付する。README のインストール手順に、Releases から取得する方法を加える（基本は Releases から取得。既存の「ビルドして配置する」手順も残す）。

前提（2026-10-21 時点、ユーザーの説明による）:

- GitLab は自前のサーバー（`gitlab.sasaki819.mydns.jp`）。プロジェクト用の GitLab Runner をセットアップ済みで、疎通確認済み。
- Runner の executor は docker。タグなしのジョブも実行する設定（`.gitlab-ci.yml` に `tags:` は不要）。
- ジョブでイメージを指定しない場合は Runner の既定のイメージ（プレーンな Alpine）で動き、Node.js / npm がない。そのため、テスト・lint・ビルドのジョブは **Node.js のイメージを指定して** 実行する（ユーザーの指示）。

## 受入基準

- push と MR のパイプラインで、check-docs（`ci/ai-standard.gitlab-ci.yml` の取り込み）、テスト（`npm test`）、lint（`npx tsc --noEmit`）、ビルド（`npm run build`）が実行され、いずれかが失敗するとパイプラインが失敗する。
- テスト・lint・ビルドのジョブは、Node.js のイメージを明示的に指定して実行する（Runner の既定のイメージには依存しない）。
- ビルドのジョブのアーティファクトとして `main.js` と `manifest.json` が保存され、GitLab の画面からダウンロードできる。保存期間が定められている。
- `v` で始まるバージョンのタグを push すると、Releases にその版が登録され、`main.js` と `manifest.json` を添付ファイル（またはリンク）としてダウンロードできる。添付したファイルは、アーティファクトの保存期間が過ぎてもダウンロードできる。
- タグのバージョンと `manifest.json` の `version` が一致しない場合の扱いが定められている（例：リリースを失敗させる）。
- README のインストール手順で、基本の方法として Releases から `main.js` と `manifest.json` を取得して配置する手順が説明され、既存の「ソースからビルドして配置する」手順も、もう一つの方法として残っている。
- 既存の `npm run build` / `npm test` / lint の成功を維持し、プラグインの動作は変えない。

## タスク（Spec を作らない小規模な Item の場合のみ）

## メモ

- リリースの仕組み（添付ファイルの置き場所、バージョンの決め方と `manifest.json` との整合、タグの付け方）に設計判断が必要なため、Spec を作成して進める（new-spec）。
- Spec で決めること（候補）:
  - 使う Node.js のイメージのバージョン（手元は Node 24）と、`npm ci` のキャッシュ。Node.js のイメージを使うこと自体は決定済み（前提を参照）。
  - アーティファクトの保存期間、どのブランチ・パイプラインでビルド結果を残すか。
  - リリースの添付ファイルの置き場所：ジョブのアーティファクトへのリンクは保存期間が切れると消えるため、GitLab の Generic Package Registry にアップロードしてリンクする、など。
  - リリースの作成方法（`.gitlab-ci.yml` の `release:` キーワードと `release-cli` のイメージ）と、必要な権限・トークン（`CI_JOB_TOKEN` で足りるか）。
  - バージョンの管理：タグと `manifest.json`・`package.json` の `version` の整合の取り方。Obsidian のコミュニティプラグインの慣例（`versions.json`）を採るかどうか。
  - ai-dev-standard の check-docs ジョブ（`debian:stable-slim` で `bash` 実行）との並び（`stages`）。
- 自前の GitLab サーバー側の設定（Package Registry が有効か、アーティファクトの容量の上限など）は、着手時にユーザーに確認する。
