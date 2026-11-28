---
name: aico-discuss
description: 相談・構想の壁打ちを進め、事実・仮説・合意事項・未決事項を議事録として構造化して記録する。
---

# aico-discuss

## 目的

相談・構想の壁打ちを整理し、経緯と結論を管理ルート配下の議事録へ構造化して残す。

## 入力

* 相談テーマ（新規作成時は `slug`・件名、継続時は既存議事録 ID またはパス）

## 前提条件

* 現在の Git ブランチが `integration_branch` であること（異なる場合は人間へ確認する）。
* 継続時は対象議事録の `status` が `open` または `in-progress` であること。

## 手順

1. 新規作成時は `create_discussion.py` で議事録を作成する。
   ```bash
   uv run <管理ルート>/scripts/create_discussion.py --slug <slug> --title "<件名>" --status in-progress --json
   ```
2. 関連する既存 ADR・議事録・コードを確認する（深い調査は `worker-high`、既存記録の横断確認は `worker-low` へ必要時委譲可）。  
   サブエージェントワーカーへ委譲する際は、親セッションの会話履歴が引き継がれない前提で、必ず以下の5項目をプロンプトへ明示する。
1. 参照する手順書・スキルパス
2. 対象範囲（ファイル・調査対象・比較基点コミット等）
3. 入力条件・制約（前提条件・対象外・守るべき規約）
4. 変更可否（読み取り専用か、許可する編集範囲はどこか）
5. 期待する成果と報告形式（出力先パス・実行環境・未確認事項を含む）
3. 確認した事実と仮説を分けて人間と議論し、`aico-markdown-write` に従って議事録本文（概要・背景・確認した事実と仮説・議論・合意事項と理由・未決事項・関連）を記録する。
4. 人間と結論を確認したうえで `update_frontmatter.py` により `status`（`in-progress` / `done` / `cancelled`）を更新する。
   ```bash
   uv run <管理ルート>/scripts/update_frontmatter.py --file <議事録パス> --set status=<status> --json
   ```
5. 必要に応じて `aico-create-adr` または `aico-create-ticket` へ接続して相互 ID を紐づけ、`rebuild_indexes.py` で一覧を再生成する。
   ```bash
   uv run <管理ルート>/scripts/rebuild_indexes.py --json
   ```

## 完了条件と状態更新

* 議事録本文が更新され、`status` が人間合意どおり（`in-progress` / `done` / `cancelled`）に反映され、一覧が最新化されていること。

## 報告形式

* 議事録パスと更新後の `status`
* 合意要点と未決事項
* 次の推奨アクション（ADR 化・チケット起票・議論継続など）
