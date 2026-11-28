---
id: 20261104-221111-ticket-preview-card-drop-position
title: ドラッグ中にカードのドロップ先をプレビュー表示する
status: done
created: 2026-11-04 22:11:11
updated: 2026-11-28 23:31:00
phase: closing
phase_status: done
branch: feature/20261104-221111-ticket-preview-card-drop-position
parent: null
children: []
discussions: []
adrs: []
---
# ドラッグ中にカードのドロップ先をプレビュー表示する

## 概要

旧管理番号: Item 0011

カードをドラッグしている間、現在の位置でドロップするとカードがどこに入るかをプレビューで分かりやすく表示する。

## AC（受け入れ条件）

* [x] ドラッグ中、有効なドロップ先に重ねると、ドロップ後の挿入位置を視覚的に判別できる。
* [x] ドラッグ位置が変わるとプレビューが追従し、実際のドロップ結果と一致する。
* [x] ドラッグをキャンセルするかドロップすると、プレビューが消える。

## DoR（着手合意）

* **任せる範囲**：着手・計画・設計書更新（`docs/architecture/03.UI-UX-Specification.md`）・ドラッグ中ドロップ位置プレビュー実装および同グループ並び替え位置整合・単体/UI自動テスト・独立レビュー/再確認・クローズ・MR作成・CI通過後スカッシュマージまで一括委任（事前合意済み）
* **未決事項**：なし（仕様上の曖昧さや判断分岐が生じた場合は即時停止して人間に確認する）
* **着手合意**：合意済み（2026-11-28、ユーザー指示により未完了チケットの自律実行対象として承認）

## 現在地

* **状況**：実装・設計書更新・単体／UIテスト・独立レビュー（Round 1：2 件修正）・独立再確認（解消 2 件・新規 0 件）およびクローズ確認を完了
* **ブロッカー（確認待ち）**：なし
* **次に取る行動**：作業ブランチをプッシュして MR を作成し、CI 成功後にスカッシュマージして `main` 側で一覧を再生成する

## 変更ファイル

<!-- AICO:AUTO:BEGIN:changed-files -->

| 種別 | パス |
| :--- | :--- |
| `M` | `docs/architecture/03.UI-UX-Specification.md` |
| `A` | `scripts/drop-preview.test.mjs` |
| `M` | `src/dnd.test.ts` |
| `M` | `src/dnd.ts` |
| `M` | `src/store.test.ts` |
| `M` | `src/store.ts` |
| `M` | `src/ui/CardView.svelte` |
| `M` | `src/ui/GroupView.svelte` |

<!-- AICO:AUTO:END:changed-files -->

## DoD（完了の定義）

* **AC 検証結果と根拠**：全 AC を自動テストおよび独立レビュー／再確認で検証済み（`npm test` 14 ファイル・158 テスト全通過、`npx tsc --noEmit` 通過、`npm run build` 通過、`./tools/aico.sh doctor --strict` OK=9/WARN=0/ERROR=0；`src/dnd.test.ts` 14 件・`src/store.test.ts` 49 件・`scripts/drop-preview.test.mjs` 5 件でカード上半分／下半分プレビュー、スロット一致ドロップ、グループ間・空グループ・折りたたみスレッド・別ファイルスレッド・無効対象非表示・キャンセル／ドロップ消去を網羅）
* **未検証項目と人の判断結果**：Obsidian 実機確認は未実施（自動テスト通過＋事前合意により完了）
* **プロジェクト側設計書・仕様書の更新確認**：`docs/architecture/03.UI-UX-Specification.md` のセクション 3・9 にドロップ位置プレビューおよびカード上半分／下半分ドロップ仕様を反映済み
* **ADR の要否判断**：不要（既存の `src/dnd.ts` モジュール共有セッション方式を Svelte ストアへ拡張した局所的な UI 設計であり、他作業へ影響する新規アーキテクチャ決定ではないため）
* **関連記録への導線確認**：`plan.md` および [レビュー一覧](review/index.md) への整合・リンク切れなしを確認済み

## 親子チケット・関連

* 旧管理番号: Item 0011（元ファイル: `backlog/items/0011-preview-card-drop-position.md`）
