---
name: new-item
description: Backlog に新しい Item を起票するとき（「〜を起票して」「Item を作って」と頼まれたとき、または作業中に見つけた別課題の起票をユーザーが了承したとき）に使う。
---

# new-item：Item の起票

## 入力

- 起票する内容（ユーザーの説明、または作業中に見つけた課題）
- 関連する Discussion があればそのパス

## 手順

1. 採番する。`backlog/items/` と `backlog/archive/` の両方にあるファイル名の先頭4桁（ID）のうち最大のものに1を足し、4桁ゼロ埋めにする（どちらも空なら `0001`）。
2. slug を決める。英小文字・数字・ハイフンのみで、内容が分かる短い語にする（例：`login-rework`）。
3. `templates/item.md` を `backlog/items/<ID>-<slug>.md` にコピーし、次を埋める。
   - `id`：採番した ID（`"0012"` のようにクォートする）
   - `title`：1行の件名
   - `status`：`backlog`
   - `priority`：ユーザーが指定した値。指定がなければ `medium` のままにし、その旨を報告する
   - `owner`：ユーザーが指定した場合のみ
   - `created`：今日の日付（YYYY-MM-DD）
   - `spec`：空のまま（Spec は new-spec で作る）
   - `discussions`：関連する Discussion のパスをインラインリストで（なければ `[]`）
   - 本文の「概要」「受入基準」。不明な点はユーザーに質問する
   - frontmatter の行末コメント（`# ...`）は残してよい
4. Spec を作らない小規模な Item の場合は、「タスク」欄に作業をチェックボックスで書く。マスタードキュメントへの反映のタスクは残す。Spec を作る場合は「タスク」欄を空にしてよい。
5. `bash tools/ai-standard/backlog-index.sh`（Windows では `powershell -ExecutionPolicy Bypass -File tools/ai-standard/backlog-index.ps1`）を実行して `BACKLOG.md` を再生成する。
6. `bash tools/ai-standard/check-docs.sh`（Windows は `.ps1`）を実行し、作成した Item に関する違反がないことを確認する。

## 出力

- 作成した Item のパス、ID、title、priority
- 再生成した `BACKLOG.md`

## 禁止事項

- 優先度をAIの判断で決めない（ユーザーの指定がなければ既定値 `medium` のままにする）。
- `BACKLOG.md` を手で編集しない。
- 既存の ID を再利用しない。archive にある ID も使用済みとして扱う。
- 起票と同時に実装を始めない。
