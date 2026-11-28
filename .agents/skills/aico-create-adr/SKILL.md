---
name: aico-create-adr
description: 複数作業へ影響する重要な設計判断を ADR として記録し、既存 ADR との整合および置換関係を保つ。
---

# aico-create-adr

## 目的

複数作業へ影響する設計判断を ADR（Architecture Decision Record）として記録し、既存判断との整合を維持する。

## 入力

* 決定テーマ、`slug`、件名
* 関連する議事録 ID・チケット ID（任意）
* 置換対象の旧 ADR ID（任意）

## 前提条件

* 原則として `integration_branch` 上であること（作業ブランチ上の議論から発生した場合は、統合ブランチへ切り替えて記録するか記録タイミングを人間へ確認する）。

## 手順

1. 既存 ADR に重複や矛盾がないか確認する（必要時は `worker-low` で既存 ADR 確認、`worker-high` で代替案比較・影響調査を実施可）。  
   サブエージェントワーカーへ委譲する際は、親セッションの会話履歴が引き継がれない前提で、必ず以下の5項目をプロンプトへ明示する。
1. 参照する手順書・スキルパス
2. 対象範囲（ファイル・調査対象・比較基点コミット等）
3. 入力条件・制約（前提条件・対象外・守るべき規約）
4. 変更可否（読み取り専用か、許可する編集範囲はどこか）
5. 期待する成果と報告形式（出力先パス・実行環境・未確認事項を含む）
2. `create_adr.py` で ADR ファイルを作成する（初期状態は原則 `open` とし、未承認ドラフト段階で `--supersedes` は指定しない）。
   ```bash
   uv run <管理ルート>/scripts/create_adr.py --slug <slug> --title "<件名>" --status open [--discussion <議事録ID>] [--ticket <チケットID>] --json
   ```
3. `aico-markdown-write` に従って本文（概要・背景・決定事項・採用理由・採用しなかった案・影響と見直し条件・関連）を記入し、人間へ提示して承認を得る。
4. 人間承認後、`update_frontmatter.py` で `status` を `accepted`（検討継続時は `open`）へ更新する。既存 ADR を置換する場合は、承認後の `accepted` 確定時に `--supersedes` を指定して旧 ADR を `deprecated`＋`superseded_by` へ同時更新する。
   ```bash
   uv run <管理ルート>/scripts/update_frontmatter.py --file <ADRパス> --set status=accepted [--supersedes <旧ADR_ID>] --json
   ```
5. `rebuild_indexes.py` で一覧を再生成する。

## 完了条件と状態更新

* ADR 本文が完成し、`status`（`open` / `accepted`）および必要に応じた旧 ADR の `deprecated`・`superseded_by`・関連相互参照・一覧が整合していること。

## 報告形式

* ADR パスと `status`
* 決定事項の要旨
* 置換した旧 ADR（ある場合）と関連記録
