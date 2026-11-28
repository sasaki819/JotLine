---
id: implementation-round1-001-avoid-success-notice-when-unchanged
title: applyChange の unchanged 時に成功通知を出さないよう修正
status: done
created: 2026-11-24 18:00:00
updated: 2026-11-27 16:50:00
severity: minor
reviewer: Antigravity (Google DeepMind)
---
# applyChange の unchanged 時に成功通知を出さないよう修正

## 対象

`src/store.ts` L170-175（`applyChange()`）、L473-479（`ungroupSelectedCards()`）

## 指摘内容と根拠

旧レビュー記録（`specs/0007-send-cards-to-group/reviews/2026-11-24-impl-ai.md` R1、元重大度: Low）。

`src/store.ts` L170-175 の `applyChange()` が `this.save()` の戻り値 `"unchanged"` を `"saved"` と同じく `true` として返しているため、`src/store.ts` L473-479 の `ungroupSelectedCards()` で実際には保存・履歴記録が行われない `"unchanged"` 経路でも成功通知 `new Notice("Ungrouped ...")` が出力され得る（例：末尾の未分類グループがメモリ上空のまま直前の未分類グループから末尾へ移動したとき、`serializeJotDocument` 結果が `currentText` と一致して `"unchanged"` になる場合）。`design.md` の「成功通知を追加する場合は、保存成功時にだけ表示する。無変更・失敗時には成功通知を出さない。」と整合させるなら、`applyChange()` で `result === "saved"` のみ `true` を返すか、呼び出し側で保存実行の有無を判別すべき。

## 採否判断（人間選別）

採用（人間承認済み）。

## 修正内容

`src/store.ts` の `applyChange()` で `save()` 結果が `"saved"` 以外のとき（`"unchanged"`・`"failed"`）に `currentText` へ復元して `false` を返すよう修正し、`src/__mocks__/obsidian.ts` と `src/store.test.ts` に回帰テストを追加した（コミット `a088819`）。

## 独立再確認結果

`npm run build`・`npm test`・`npx tsc --noEmit` および GitLab CI パイプラインすべて通過を確認済み。
