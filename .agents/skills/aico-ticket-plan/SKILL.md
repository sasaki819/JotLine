---
name: aico-ticket-plan
description: 現状調査と仕様合意を行い、チケットの plan.md に実装可能な作業計画と検証方針を策定する。
---

# aico-ticket-plan

## 目的

関連資産を実物調査したうえで仕様を合意し、`plan.md` に合意仕様・ステップ一覧・検証方針・判断ログを策定する。

## 入力

* 対象チケット ID（省略可）
* 対象 ID の指定が省略された場合は、以下の3段階フォールバックで解決する。
1. ユーザーの明示指定（ID・`slug`・パス）。
2. `uv run <管理ルート>/scripts/ticket_status.py --json` による現在の Git ブランチと `branch` 属性の照合。
3. 自動特定できない場合は該当状態の候補一覧を提示して人間に選択してもらう。

## 前提条件

* 対象チケットの作業ブランチ上であること。
* 対象チケットの状態が `status: in-progress`・`phase: planning`・`phase_status: working` であること（異なる場合は現在状態と差分を提示し人間承認を得る）。

## 手順

1. 関連コード・設計書・既存 ADR を調査する。深い調査や仕様検討は `worker-high`、既存記録やコードの横断要約は `worker-low` へ積極委譲する。  
   サブエージェントワーカーへ委譲する際は、親セッションの会話履歴が引き継がれない前提で、必ず以下の5項目をプロンプトへ明示する。
1. 参照する手順書・スキルパス
2. 対象範囲（ファイル・調査対象・比較基点コミット等）
3. 入力条件・制約（前提条件・対象外・守るべき規約）
4. 変更可否（読み取り専用か、許可する編集範囲はどこか）
5. 期待する成果と報告形式（出力先パス・実行環境・未確認事項を含む）
2. 長くなる調査結果や検証ログは `create_ticket_note.py` で `notes/<NNN>-<slug>.md` へ切り出す。
   ```bash
   uv run <管理ルート>/scripts/create_ticket_note.py --ticket <チケットID> --slug <slug> --title "<件名>" --json
   ```
3. `aico-markdown-write` に従って `plan.md`（合意した仕様・ステップ一覧 `- [ ]`・検証方針・判断ログ）を作成し、人間とすり合わせて承認を得る。
4. 次の行き先（計画レビュー実施 `planning / reviewing`、設計フェーズへ進行 `design / working`、設計不要なためスキップして実装フェーズへ進行 `implementation / working`、調査・評価専用チケットのため設計・実装をスキップしてクロージングへ進行 `closing / working`）を、推奨案先頭の番号付き Markdown 選択肢で提示して人間と合意する。
5. `update_frontmatter.py` で合意した状態へ更新し、`index.md` の `## 現在地` を更新する。
   ```bash
   uv run <管理ルート>/scripts/update_frontmatter.py --file <チケットindex.md> --set phase=<合意phase> --set phase_status=<合意phase_status> --json
   ```

## 完了条件と状態更新

* `plan.md` が人間承認済みであること。
* 合意に応じて `planning / reviewing`、`design / working`、`implementation / working`、または `closing / working` へ更新されていること。

## 報告形式

* 合意した仕様・ステップ数・検証方針の要約
* 作成したノート一覧（ある場合）
* 更新後の状態と、次のアクションを推奨案先頭の番号付き Markdown 選択肢（2〜4件）で案内する
