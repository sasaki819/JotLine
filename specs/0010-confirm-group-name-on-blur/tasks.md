# tasks: 0010 グループ名の変更をフォーカスアウト時に確定する

<!--
- 1 Task はおおむね1セッションで完結する粒度にする。
- 各 Task に「完了条件」と「検証コマンド」を書く。
- 依存関係がある場合は Task 名の末尾に (after: 2) のように書く。
- 検証コマンドが成功した場合だけチェックを入れる。
- 末尾の2つの固定 Task は削除しない。
-->

- [x] 1. グループ名編集の確定・キャンセル操作を変更する
  - 完了条件: `GroupView.svelte` の確定・キャンセルボタンを削除し、Enter／blur で確定、Escape でキャンセルする。確定・キャンセル時に編集状態を同期的に終了し、後続のイベントによる重複保存とキャンセル後の保存を防ぐ。IME 変換中の Enter／Escape は編集の確定・キャンセルとして扱わない。空白の除去、空白のみ・変更なしの入力に対する既存の処理を維持する。機械検証が成功し、結果を progress.md に記録している。
  - 検証コマンド: `npm run build`、`npm test`、`npx tsc --noEmit`、`bash tools/ai-standard/check-docs.sh`
- [x] 2. 実画面でグループ名編集の受入基準を確認する (after: 1)
  - 完了条件: Obsidian 上で design.md のテスト方針にある手動確認を実施し、AC1〜AC5、IME 変換中の操作、デスクトップとモバイルでの操作結果を progress.md に記録している。フォーカスアウト後の保存は再読み込みで、重複防止は成功通知と Undo 1回で元に戻ることでも確認する。未実施の確認があればチェックを付けず、確認が必要な環境と項目を記録する。
  - 検証コマンド: `bash tools/ai-standard/check-docs.sh`（実画面での手動確認と併せて実施）
- [x] 正本ドキュメント（docs/architecture/）へ design の内容を反映 (after: 2)
  - 完了条件: `docs/architecture/03.UI-UX-Specification.md` に、ボタンの削除、Enter／フォーカスアウトによる確定、Esc によるキャンセルを反映している。
  - 検証コマンド: `bash tools/ai-standard/check-docs.sh`
- [x] ADR の要否判断（必要なら作成） (after: 2)
  - 完了条件: 要否と理由を progress.md に記載し、必要なら templates/adr.md から docs/adr/ に ADR を作成している。
  - 検証コマンド: `bash tools/ai-standard/check-docs.sh`
