# tasks: 0006 メイン入力欄から追加したカードをファイル末尾に保存する

<!--
- 1 Task はおおむね1セッションで完結する粒度にする。
- 各 Task に「完了条件」と「検証コマンド」を書く。
- 依存関係がある場合は Task 名の末尾に (after: 2) のように書く。
- 検証コマンドが成功した場合だけチェックを入れる。
- 末尾の2つの固定 Task は削除しない。
-->

- [x] 1. メイン入力欄からの追加をファイル末尾へ変更し、回帰テストを追加する
  - 完了条件: AC1〜AC5 を満たす。`addCard` の追加先未指定時だけ末尾の未分類グループを再利用、または末尾に新設する。対象グループ指定時の挙動は維持する。保存テキストと再読み込み後の順序をテストで確認する。
  - 検証コマンド: `npm test && npx tsc --noEmit && npm run build`
- [ ] 正本ドキュメント（docs/architecture/）へ design の内容を反映 (after: 1)
  - 完了条件: `docs/architecture/03.UI-UX-Specification.md` に、メイン入力欄からのカードがファイル末尾の未分類グループへ追加される規則を反映する。
  - 検証コマンド: `bash tools/ai-standard/check-docs.sh`
- [ ] ADR の要否判断（必要なら作成） (after: 1)
  - 完了条件: 要否と理由を `progress.md` に記載し、必要なら `docs/adr/` に ADR を作成している。
  - 検証コマンド: `bash tools/ai-standard/check-docs.sh`
