---
name: aico-review-triage
description: 未選別（open）のレビュー指摘を人間へ提示し、人間が決定した採否判断を各指摘ファイルと状態へ反映する。
---

# aico-review-triage

## 目的

未選別（`status: open`）のレビュー指摘を人間へ提示し、人間による採否選別の結果を各指摘ファイルと `review/index.md` へ正確に記録する。

## 入力

* 対象チケット ID または Runbook 実施記録 ID（省略可）
* 対象 ID の指定が省略された場合は、以下の3段階フォールバックで解決する。
1. ユーザーの明示指定（ID・`slug`・パス）。
2. `uv run <管理ルート>/scripts/ticket_status.py --json` による現在の Git ブランチと `branch` 属性の照合。
3. 自動特定できない場合は該当状態の候補一覧を提示して人間に選択してもらう。

## 前提条件

* **チケット対象時**：作業ブランチ上であること、`status: in-progress`・`phase_status: triaging` であること。
* **Runbook 実施記録対象時**：統合ブランチ上であること、`review/findings/` に `status: open` の指摘が存在すること。

## 手順

1. `review/findings/` から `status: open` の指摘をすべて読み込み、重要度・対象・根拠・AI 推奨判断を一覧化して人間へ提示する。
2. **必ず人間の判断**を受け、各指摘の採否を確定する。AI は独断で採否を決定してはならない。
3. 各指摘ファイルの `## 採否判断（人間選別）` に判断と理由を必ず記入し（見送り `cancelled` で理由が空欄だと `doctor.py` で `ERROR` となる）、`update_frontmatter.py` で `status` を更新する（採用 → `in-progress`、見送り → `cancelled`）。
   ```bash
   uv run <管理ルート>/scripts/update_frontmatter.py --file <指摘ファイル> --set status=<in-progress|cancelled> --json
   ```
4. `rebuild_indexes.py --scope reviews --target <対象>` で `review/index.md` の指摘一覧を再生成する。
5. チケット対象時は、採用指摘（`in-progress`）が1件以上あれば `phase_status: fixing` へ更新し、全件見送りなら人間確認のうえ合意した次フェーズの `working`（`closing` 時は `status: done`・`closing / done`）へ進める（Runbook 実施記録時は `phase_status` を更新しない）。

## 完了条件と状態更新

* すべての `open` 指摘に人間の採否判断が記録され、`review/index.md` が更新されていること。
* チケット対象時：採用あり → `<phase> / fixing`、全件見送り → 合意した次フェーズ `working`（`closing` 時は `status: done` / `closing / done`）。
* Runbook 実施記録対象時：各指摘の `status` 更新のみ。

## 報告形式

* 採用件数・見送り件数および各指摘の判断一覧
* 更新後の状態と、次のアクションを推奨案先頭の番号付き Markdown 選択肢（2〜4件）で案内する（採用ありなら `aico-review-fix`、全件見送りなら次フェーズ進行）
