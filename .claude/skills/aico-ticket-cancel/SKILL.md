---
name: aico-ticket-cancel
description: 進行中または起票済みのチケットを人間承認を得て中止し、中止理由を記録して統合ブランチ側の一覧へ反映する。
---

# aico-ticket-cancel

## 目的

進行中または起票済みのチケットを人間の承認を得て中止（`cancelled`）し、中止時点の工程履歴と理由を残したうえで統合ブランチ側の一覧へ反映する。

## 入力

* 対象チケット ID（省略可）
* 中止理由
* 対象 ID の指定が省略された場合は、以下の3段階フォールバックで解決する。
1. ユーザーの明示指定（ID・`slug`・パス）。
2. `uv run <管理ルート>/scripts/ticket_status.py --json` による現在の Git ブランチと `branch` 属性の照合。
3. 自動特定できない場合は該当状態の候補一覧を提示して人間に選択してもらう。

## 前提条件

* 対象チケットの `status` が `active`（`open` または `in-progress`）であること。

## 手順

### 1. 中止確定（作業ブランチ側、未着手 `open` の場合は統合ブランチ側）

1. 中止理由と影響（未完了成果物・子チケット・関連議事録への影響）を整理し、人間の中止承認を得る。
2. `index.md` に中止理由を記録し、`phase`・`phase_status` は中止時点の値を維持したまま `update_frontmatter.py` で `status: cancelled` へ更新する。
   ```bash
   uv run <管理ルート>/scripts/update_frontmatter.py --file <チケットindex.md> --set status=cancelled --json
   ```
3. 作業ブランチ上で中止した場合は、統合ブランチへの反映方法（記録のみ取り込むか、統合ブランチ側で直接 `cancelled` を反映するか）を人間へ確認する。作業ブランチ作成前（`status: open`）に中止する場合は、統合ブランチ上でそのまま手順2へ進む。

### 2. 統合ブランチ側（反映後の一覧再生成）

1. CI/CD パイプラインで自動実行していない場合、統合ブランチ側で `rebuild_indexes.py` を実行して一覧およびダッシュボードを再生成する。
   ```bash
   uv run <管理ルート>/scripts/rebuild_indexes.py --json
   ```

## 完了条件と状態更新

* `status: cancelled` へ更新され、中止時点の `phase`・`phase_status` および中止理由が記録されていること。
* 統合ブランチ側反映後に一覧が再生成されていること。

## 報告形式

* チケット ID と中止時点の `phase` / `phase_status`
* 中止理由と影響整理
* 後続の統合・一覧更新案内または一覧再生成結果
