---
name: pr-draft
description: Item の作業が終わり、PR（GitHub）または MR（GitLab）の本文を作成するときに使う。
---

# pr-draft：PR／MR 本文の作成

## 入力

- 対象 Item の ID、または Spec のパス

## 手順

1. 対象 Item、Spec（requirements.md、design.md、tasks.md、progress.md）、`reviews/` の Review ファイルを読む。
2. PR／MR テンプレートを読む（GitHub：`.github/pull_request_template.md`、GitLab：`.gitlab/merge_request_templates/AI-Standard.md`。どちらもない場合は下記の項目を使う）。
3. テンプレートの各項目を埋めた本文を作成する。
   - 関連 Item / Spec：リポジトリ内の相対パスでリンクする
   - 変更概要：requirements の目的と受入基準に対応づけて、何を変えたかを書く
   - 設計上の判断：design.md の要点、検討した代替案、関連する ADR
   - レビュー経緯：各 Review ファイルへのリンクと、Finding の件数と状態（fixed / wontfix）の要約
   - チェックリスト：DoD、正本ドキュメントへの反映、ADR の要否判断について、事実を確認できた項目だけにチェックを入れる。確認できない項目は未チェックのまま理由を添える
4. 本文を Markdown で出力する。

## 出力

- PR／MR の本文（Markdown）

## 禁止事項

- PR／MR の作成操作（`gh pr create`、`glab mr create`、Web UI の操作など）を行わない。作成は人が行う。
- 事実を確認していない項目にチェックを入れない。
