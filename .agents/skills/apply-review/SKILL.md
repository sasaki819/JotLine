---
name: apply-review
description: Review の accepted の Finding に対応するとき、または人がプロンプトで入力したレビュー指摘を Review ファイルに記録して対応するときに使う。
---

# apply-review：指摘への対応と記録

## 入力

- 対象 Spec のパス（`specs/<ID>-<slug>/`）
- (b) の場合：人のレビュー指摘（プロンプトで入力されたもの）

## 手順

### (a) accepted の Finding に対応する

1. `specs/<ID>-<slug>/reviews/` の Review ファイルを読み、状態が `accepted` の Finding を一覧にする。
2. Finding ごとに対応する。対応後、関連する検証コマンド（AGENTS.md のテスト・lint など）を実行する。
3. 検証が成功したらコミットし、Finding の状態を `fixed` にして、対応欄に対応内容とコミットID を書く。
4. 対応できない、または対応方針に判断が必要な Finding は状態を変えずに残し、理由をユーザーに報告する。

### (b) 人のレビュー指摘を記録して対応する

1. `templates/review.md` を `specs/<ID>-<slug>/reviews/YYYY-MM-DD-<target>-human.md` にコピーする（同じ日に同名がある場合は末尾に `-2` などを付ける）。frontmatter は `reviewer: human`、`by` に指摘した人の名前（不明なら質問する）を書く。
2. 入力された指摘を1件ずつ Finding として記録する。状態は `accepted` とする。重大度が示されていなければユーザーに確認する。
3. 記録した Finding に (a) と同じ手順で対応する。

### 共通

- progress.md に対応の記録（判断とその理由を含む）を追記する。
- 最後に check-docs を実行する。

## 出力

- 修正とコミット
- 更新した Review ファイル（fixed の Finding には対応内容とコミットID）
- 対応した Finding と、残した Finding の一覧

## 禁止事項

- 状態が `open` の Finding には手を付けない（対応も状態変更もしない）。
- `wontfix` の Finding に対応しない。
- Finding を `accepted` や `wontfix` に変更しない（人の判断）。ただし (b) の記録時に `accepted` で起票するのは除く。
- Finding の範囲を超える変更をしない。別の課題は新しい Item として起票を提案する。
