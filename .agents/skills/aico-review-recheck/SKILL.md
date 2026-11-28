---
name: aico-review-recheck
description: 独立コンテキストのワーカーへ委譲して指摘修正を実物照合し、解消確認・差し戻し・新規指摘登録を行う。
---

# aico-review-recheck

## 目的

修正担当セッションとは独立したコンテキストで採用指摘の修正内容を実物照合し、解消確認・差し戻し・新規指摘の記録を行う。

## 入力

* 対象チケット ID または Runbook 実施記録 ID（省略可）
* 対象 ID の指定が省略された場合は、以下の3段階フォールバックで解決する。
1. ユーザーの明示指定（ID・`slug`・パス）。
2. `uv run <管理ルート>/scripts/ticket_status.py --json` による現在の Git ブランチと `branch` 属性の照合。
3. 自動特定できない場合は該当状態の候補一覧を提示して人間に選択してもらう。

## 前提条件

* **チケット対象時**：作業ブランチ上であること、`status: in-progress`・`phase_status: re-reviewing` であること。
* **Runbook 実施記録対象時**：統合ブランチ上であること、`review/findings/` に修正済みの `status: in-progress` 指摘が存在すること。

## 手順

1. `status: in-progress` の指摘一覧と修正差分を、独立コンテキストのワーカー（**必須委譲**：原則 `worker-middle`、重要な設計レビュー時は `worker-high`）へ5項目委譲規約を満たして再確認を委譲する。  
   サブエージェントワーカーへ委譲する際は、親セッションの会話履歴が引き継がれない前提で、必ず以下の5項目をプロンプトへ明示する。
1. 参照する手順書・スキルパス
2. 対象範囲（ファイル・調査対象・比較基点コミット等）
3. 入力条件・制約（前提条件・対象外・守るべき規約）
4. 変更可否（読み取り専用か、許可する編集範囲はどこか）
5. 期待する成果と報告形式（出力先パス・実行環境・未確認事項を含む）
2. 各指摘ファイルの `## 独立再確認結果` に確認結果・実行環境・未確認事項を記録する。
   * 問題が解消した指摘：`update_frontmatter.py` で `status: done` へ更新する。
   * 修正不十分な指摘：`status: in-progress` のまま差し戻し理由を追記する。
3. 再確認中に新たな問題を発見した場合は、次ラウンド（`round<N+1>`）の新規指摘ファイル（`status: open`）を作成する。同一再確認で複数件の新規指摘を作成する場合は、1件目のみ `--next-round`（または明示的に `--round <N+1>`）を指定し、2件目以降は同じ `--round <N+1>` を指定してラウンド番号の飛びを防ぐ。
   ```bash
   uv run <管理ルート>/scripts/create_review_finding.py --target <対象> --next-round --slug <slug> --title "<件名>" --severity <critical|major|minor> --reviewer "<実施者>" --json
   ```
4. `record_review_run.py --kind recheck` で `review/index.md` の実施記録を追記し、`rebuild_indexes.py --scope reviews --target <対象>` で指摘一覧を再生成する。
5. チケット対象時は結果に応じて状態を更新する（Runbook 実施記録時は `phase_status` を更新しない）。
   * 新規指摘（`open`）あり → `phase_status: triaging`
   * 差し戻し（`in-progress`）あり（新規指摘なし）→ `phase_status: fixing`
   * 当該フェーズの未解決指摘が 0 件 → 人間承認のうえ、合意した次フェーズの `working`（`closing` 時は `status: done`・`closing / done`）、または同一フェーズで別レビュアーによる追加ラウンド（例：人間指摘の修正後に独立 AI レビューを追加実施）を行う場合は `phase_status: reviewing` へ更新し `aico-review` へ進む

## 完了条件と状態更新

* 独立再確認結果がすべての対象指摘および `review/index.md` へ記録され、指摘一覧が再生成されていること。
* チケット対象時：新規指摘あり → `<phase> / triaging`、差し戻しあり → `<phase> / fixing`、全件確認完了 → 合意した次フェーズ `working`（`closing` 時は `status: done` / `closing / done`）または追加ラウンド実施時は `<phase> / reviewing`。
* Runbook 実施記録対象時：解消指摘を `done`・新規指摘を `open` 作成（`phase_status` なし）。

## 報告形式

* 解消件数・差し戻し件数・新規指摘件数
* 確認した実行環境および未確認事項
* 更新後の状態と、次のアクションを推奨案先頭の番号付き Markdown 選択肢（2〜4件）で案内する（追加ラウンド `aico-review` や次フェーズ進行を含む）
