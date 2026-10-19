---
name: implement-task
description: Spec の tasks.md にある未完了の Task を1つ実装するとき（「次の Task を進めて」「Item 0012 を実装して」と頼まれたとき）に使う。
---

# implement-task：Task の実装

## 入力

- 対象 Item の ID、または Spec のパス（`specs/<ID>-<slug>/`）

## 手順

1. 対象 Spec の requirements.md、design.md、tasks.md、progress.md を読む。Backlog 全体や他の Spec は読まない。
2. 実装する Task を1つ選ぶ。tasks.md の上から順に、未チェックで、`(after: N)` に書かれた依存 Task がすべてチェック済みのものの先頭を選ぶ。progress.md の「中断点」に指示があれば考慮する。
3. Item の status が `ready` なら `in-progress` に変更し、backlog-index を実行する。
4. Task を実装する。design.md に従い、design と異なる実装が必要になった場合は、実装を進める前にユーザーに確認する。
5. Task に書かれた検証コマンドを実行する。
   - **成功した場合だけ** tasks.md の該当 Task にチェックを入れる。
   - 失敗した場合は修正して再実行する。解決できない場合はチェックを入れず、状況をユーザーに報告する。
6. progress.md に今日の日付で、作業ログ、判断とその理由、中断点（次に何をすべきか）を追記する。
7. check-docs を実行する。
8. Task 単位でコミットする。コミットメッセージには Item の ID と Task 名を含める（例：`[0012] Task 2: ログインAPIの入力検証を追加`）。
9. 結果を報告する。次の Task がある場合はその名前を示すが、ユーザーの指示なしに続けて実装しない。

## 固定 Task を選んだ場合

- 「正本ドキュメントへ反映」：design.md の内容を `docs/architecture/` の該当文書に反映する。不要なら理由を progress.md に書いてチェックする。
- 「ADR の要否判断」：重要な設計判断があれば `templates/adr.md` から `docs/adr/NNNN-<slug>.md` を作成する（NNNN は既存の最大番号に1を足す）。要否と理由を progress.md に書く。

## 出力

- 実装の変更とコミット
- 更新した tasks.md、progress.md
- 検証コマンドの実行結果

## 禁止事項

- 一度に複数の Task を実装しない。
- 検証コマンドが成功していない Task にチェックを入れない。「完了」と報告しない。
- スコープ外の課題をその場で直さない。新しい Item として起票を提案する。
- 検証を通すためにテストを削除・無効化しない。
