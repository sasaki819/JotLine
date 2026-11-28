---
name: aico-ticket-start
description: DoR（着手合意）を確定し、作業ブランチを作成・切替してチケット対応を開始する。
---

# aico-ticket-start

## 目的

DoR（着手合意）を人間と確定し、作業ブランチを準備してチケットを `in-progress` / `planning` / `working` へ進める。

## 入力

* 対象チケット ID（省略可）
* 対象 ID の指定が省略された場合は、以下の3段階フォールバックで解決する。
1. ユーザーの明示指定（ID・`slug`・パス）。
2. `uv run <管理ルート>/scripts/ticket_status.py --json` による現在の Git ブランチと `branch` 属性の照合。
3. 自動特定できない場合は該当状態の候補一覧を提示して人間に選択してもらう。

## 前提条件

* 対象チケットの状態が `status: open`・`phase: drafting`・`phase_status: working` であること（異なる場合は現在状態と差分を人間へ提示し、承認を得てから進める）。

## 手順

1. `ticket_status.py` で対象チケットを特定し、`index.md` の概要・AC・任せる範囲・未決事項を確認する。
2. 人間と確認して着手を妨げる未決事項を解消し、DoR（着手合意）の承認を得て `index.md` の `## DoR（着手合意）` を更新する。
3. 並行作業中の他チケットと変更予定ファイル・共有前提の重なりがないか事前確認する（進行中チケットが多い場合は必要時 `worker-low` へ横断スキャンを委譲可）。  
   サブエージェントワーカーへ委譲する際は、親セッションの会話履歴が引き継がれない前提で、必ず以下の5項目をプロンプトへ明示する。
1. 参照する手順書・スキルパス
2. 対象範囲（ファイル・調査対象・比較基点コミット等）
3. 入力条件・制約（前提条件・対象外・守るべき規約）
4. 変更可否（読み取り専用か、許可する編集範囲はどこか）
5. 期待する成果と報告形式（出力先パス・実行環境・未確認事項を含む）
4. 統合ブランチから `index.md` の `branch` 属性に記録された作業ブランチを作成・切替する（導入先に `AGENTS.md` マーカー外で Git worktree 方針が定義されている場合はその方針に従って作業環境を準備する）。
5. 作業ブランチ側で `update_frontmatter.py` により状態を更新し、`index.md` の `## 現在地` を更新する（全体一覧 `management/index.md` 等は作業ブランチ上で更新しない）。
   ```bash
   uv run <管理ルート>/scripts/update_frontmatter.py --file <チケットindex.md> --set status=in-progress --set phase=planning --set phase_status=working --json
   ```

## 完了条件と状態更新

* DoR が合意され作業ブランチへ切替済みであること。
* 作業ブランチ側で `status: in-progress` / `phase: planning` / `phase_status: working` へ更新されていること。

## 報告形式

* 切替先ブランチ名（および worktree パスがある場合はそのパス）
* 合意した DoR 要点
* 次スキル（`aico-ticket-plan`）の案内
