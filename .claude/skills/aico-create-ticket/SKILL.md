---
name: aico-create-ticket
description: 統合ブランチ上でチケットを起票し、概要・AC・DoR 初版および関連リンクを整えて一覧を更新する。
---

# aico-create-ticket

## 目的

ゴールのある作業をチケットとして起票し、概要・AC（受け入れ条件）・DoR（着手合意）の初版と作業ブランチ名を整える。

## 入力

* 件名、`slug`、目的・背景
* 関連する議事録 ID・ADR ID・親チケット ID・Runbook 実施記録（任意）
* 作業ブランチ名（任意。導入先規約に従い、規約がない場合は `feature/<チケットID>` を参考例とする）

## 前提条件

* 現在の Git ブランチが `integration_branch` であること。

## 手順

1. 導入先のブランチ命名規約（`AGENTS.md` マーカー外等）を確認し、作業ブランチ名を決定する。
2. `create_ticket.py` でチケットフォルダ一式を作成する（初期状態は `status: open`・`phase: drafting`・`phase_status: working`）。
   ```bash
   uv run <管理ルート>/scripts/create_ticket.py --slug <slug> --title "<件名>" [--branch "<ブランチ名>"] [--parent <親ID>] [--discussion <議事録ID>] [--adr <ADR_ID>] [--followup-from <Runbook実施記録>] --json
   ```
3. `aico-markdown-write` に従って `index.md` の概要・AC・DoR（任せる範囲・未決事項）・関連リンクを記入する。
4. `rebuild_indexes.py` で一覧およびダッシュボードを再生成する。
   ```bash
   uv run <管理ルート>/scripts/rebuild_indexes.py --json
   ```
5. コミットできる状態を整え、ユーザーが必要に応じてコミット・push や PR/MR を進められるよう案内する（自動コミット・自動 push は行わない）。

## 完了条件と状態更新

* チケットフォルダ一式（`index.md`・`plan.md`・`review/index.md`）が作成され、`status: open` / `phase: drafting` / `phase_status: working` および一覧が整合していること。

## 報告形式

* チケット ID とパス
* 決定した作業ブランチ名
* AC および未決事項の要約
* 次のアクションを推奨案先頭の番号付き Markdown 選択肢（2〜4件）で案内する（推奨：`aico-ticket-start` または起票コミット）
