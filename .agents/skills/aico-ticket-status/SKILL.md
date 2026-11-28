---
name: aico-ticket-status
description: 現在の作業ブランチ・チケット記録・差分を実物照合し、中断からの再開起点と推奨次スキルを提案する。
---

# aico-ticket-status

## 目的

現在の作業およびチケット状況を実物照合で把握し、中断からの再開起点と次に実行すべきスキルを一意に提案する。

## 入力

* 対象チケット ID（任意・省略可）
* 対象 ID の指定が省略された場合は、以下の3段階フォールバックで解決する。
1. ユーザーの明示指定（ID・`slug`・パス）。
2. `uv run <管理ルート>/scripts/ticket_status.py --json` による現在の Git ブランチと `branch` 属性の照合。
3. 自動特定できない場合は該当状態の候補一覧を提示して人間に選択してもらう。

## 前提条件

* リポジトリ内に `aico-manifest.json` および `scripts/ticket_status.py` が存在すること。

## 手順

1. `ticket_status.py` を実行し、`aico-manifest.json`・現在の Git ブランチ・対象チケット（または進行中チケット候補一覧）・`plan.md` 進捗・未対応指摘件数・`git status`・推奨次スキルを実物照合で取得する。
   ```bash
   uv run <管理ルート>/scripts/ticket_status.py [--ticket <チケットID>] --json
   ```
2. 作業ブランチ上または対象チケット指定時は、必要に応じて `plan.md` の判断ログや統合ブランチとの `git diff` の詳細を確認する（大規模差分や複数記録の要約が必要な場合は必要時 `worker-low` へ委譲可）。  
   サブエージェントワーカーへ委譲する際は、親セッションの会話履歴が引き継がれない前提で、必ず以下の5項目をプロンプトへ明示する。
1. 参照する手順書・スキルパス
2. 対象範囲（ファイル・調査対象・比較基点コミット等）
3. 入力条件・制約（前提条件・対象外・守るべき規約）
4. 変更可否（読み取り専用か、許可する編集範囲はどこか）
5. 期待する成果と報告形式（出力先パス・実行環境・未確認事項を含む）
3. 以下の対応表（`ticket_status.py` の判定結果と一致）に従い、推奨次スキルを提案する。
   * `open / drafting / working` → `aico-ticket-start`
   * `in-progress / planning / working` → `aico-ticket-plan`
   * `in-progress / design / working` → `aico-ticket-design`
   * `in-progress / implementation / working` → `aico-ticket-implement`
   * `in-progress / closing / working` → `aico-ticket-close`
   * `in-progress / <phase> / reviewing` → `aico-review`
   * `in-progress / <phase> / triaging` → `aico-review-triage`
   * `in-progress / <phase> / fixing` → `aico-review-fix`
   * `in-progress / <phase> / re-reviewing` → `aico-review-recheck`
   * `done` / `cancelled`（未統合・一覧未反映時）→ 統合ブランチへのマージおよび一覧再生成（`aico-ticket-close` / `aico-ticket-cancel` の統合後手順）
   * `done` / `cancelled`（統合・一覧反映済み）→ 追加作業不要（必要に応じ `aico-archive` や新規作業起点）
   * 対象チケットなし → 進行中チケット候補から選択、または新規作業起点（`aico-discuss`・`aico-create-ticket`・`aico-runbook-run` 等）を案内
   * 不正な組み合わせ・状態不整合 → 自動進行せず異常状態を人間へ警告し、`aico-doctor` または人間承認後の状態補整を案内

## 完了条件と状態更新

* 実物照合に基づく現在地と推奨次アクションが報告されていること。
* 状態変更は行わない（読み取り専用）。

## 報告形式

* 現在の Git ブランチと `git status` 要約
* 対象チケットの3軸状態（`status` / `phase` / `phase_status`）または進行中チケット候補一覧
* 完了済み／未完了ステップの要点および未対応指摘件数
* 次のアクションを推奨案先頭の番号付き Markdown 選択肢（2〜4件）で案内する
