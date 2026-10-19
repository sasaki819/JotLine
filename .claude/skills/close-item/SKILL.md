---
name: close-item
description: PR／MR のマージ前に Item の完了処理（DoD の確認、status を done にしてアーカイブへ移動）を行うときに使う。
---

# close-item：完了処理

## 入力

- 対象 Item の ID またはパス

## 手順

1. 対象 Item を読み、DoD を確認する。
   - Spec がある場合：tasks.md の全 Task にチェックが入っている（「正本ドキュメントへ反映」「ADR の要否判断」を含む）。
   - Spec がない場合：Item 内のタスクに全てチェックが入っている。
   - 該当 Spec の `reviews/` 配下に、状態が `open` または `accepted` の Finding が残っていない。
   - check-docs が成功する（この時点では Item の移動前なので、その前提で実行する）。
2. 満たさない項目が1つでもあれば、**満たさない項目を全て列挙して中断する**。Item は変更しない。
3. 全て満たしていれば：
   1. Item の `status` を `done` にする。
   2. Item を `backlog/items/` から `backlog/archive/` に移動する（ファイル名は変えない。git 管理下なら `git mv` を使う）。
   3. backlog-index を実行して `BACKLOG.md` を再生成する。
   4. check-docs を実行し、成功することを確認する。
4. 結果を報告する。コミットはユーザーの指示に従う。

## 出力

- DoD の確認結果
- （完了した場合）アーカイブへ移動した Item と再生成した `BACKLOG.md`

## 禁止事項

- DoD を満たさないまま status を done にしない。
- 未完了の Task にチェックを入れたり、open / accepted の Finding の状態を変えたりして、DoD を満たしたことにしない。
- Item を削除しない（中止する場合は status を `dropped` にして archive へ移動する）。
