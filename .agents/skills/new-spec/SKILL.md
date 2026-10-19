---
name: new-spec
description: 着手が決まった Item について Spec（requirements・design・tasks）を作成するときに使う。
---

# new-spec：Spec の作成

## 入力

- 対象 Item の ID またはパス（`backlog/items/<ID>-<slug>.md`）

## 手順

1. 対象 Item と、その `discussions` 欄にある Discussion を読む。Backlog の他の Item は読まない。必要に応じて `docs/architecture/` と `docs/adr/` の関連部分を読む。
2. `specs/<ID>-<slug>/` を作成する（slug は Item のファイル名と同じ）。
3. **requirements**：`templates/spec/requirements.md` をコピーして埋める。背景、目的、スコープ、スコープ外、受入基準（検証可能な形）、関連（Item、Discussion、ADR）を書く。不明点はユーザーに質問する。推測で埋めない。
   - 書き終えたらユーザーに提示し、**承認を得てから**次に進む。
4. **design**：`templates/spec/design.md` をコピーして埋める。冒頭の「本 Item による変更分の設計であり、全体の正本は docs/architecture/ にある」という注記は残す。変更の概要、影響範囲、構成とコンポーネント、インタフェース、データモデル、エラー処理、テスト方針、検討した代替案を書く。該当しない節は「該当なし」と書く。
   - 書き終えたらユーザーに提示し、**承認を得てから**次に進む。
5. **tasks**：`templates/spec/tasks.md` をコピーして埋める。
   - 1 Task はおおむね1セッションで完結する粒度にする。
   - 各 Task に完了条件と検証コマンドを書く。検証コマンドは AGENTS.md のビルド・テスト・lint コマンドを基本にする。
   - 依存関係があれば `(after: 2)` のように書く。
   - 末尾の固定 Task「正本ドキュメント（docs/architecture/）へ design の内容を反映」と「ADR の要否判断（必要なら作成）」を必ず含める。
   - 書き終えたらユーザーに提示し、**承認を得る**。
6. `templates/spec/progress.md` をコピーし、Spec 作成の経緯（主な判断とその理由）を記録する。
7. Item の frontmatter を更新する：`spec` に `specs/<ID>-<slug>/`、`status` に `ready`。
8. backlog-index を実行し、続いて check-docs を実行して違反がないことを確認する。

## 出力

- `specs/<ID>-<slug>/` の requirements.md、design.md、tasks.md、progress.md
- 更新した Item と `BACKLOG.md`

## 禁止事項

- ユーザーの承認なしに次の段階（requirements → design → tasks）へ進まない。
- 実装を始めない（実装は implement-task で行う）。
- 固定 Task を削除しない。
- スコープ外の課題を Spec に取り込まない。別の Item として起票を提案する。
