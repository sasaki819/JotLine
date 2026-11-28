---
id: 20261124-120013-ticket-cleanup-empty-unclassified-group
title: 空になった不要な未分類グループのドロップ枠を残さない
status: done
created: 2026-11-24 12:00:13
updated: 2026-11-28 22:25:57
phase: closing
phase_status: done
branch: feature/20261124-120013-ticket-cleanup-empty-unclassified-group
parent: null
children: []
discussions: []
adrs: []
---
# 空になった不要な未分類グループのドロップ枠を残さない

## 概要

旧管理番号: Item 0013

他にカードやグループが存在する状態で未分類グループのカードが 0 枚になったとき、画面上に空のドロップ枠だけが残り再読み込みで消える事象を解消する。
操作直後の表示と保存・再読み込み後の表示が一致するようにする。

### 補足・背景メモ

- Item 0007 の実画面検証（2026-11-24）で確認された課題。
- `GroupView.svelte` が空の未分類グループに対して `DROP_CARDS_HERE` 枠を表示する一方、`serializeJotDocument()` は空の未分類グループを書き出さないため、再読み込み前後で表示が食い違っていた。

## AC（受け入れ条件）

* [x] 他にカードまたはグループが存在する状態で未分類グループが空になった場合、不要な空のドロップ枠が画面に残らない。
* [x] ドキュメント全体のカードが 0 枚になった場合は、既存の初期表示（ウェルカム表示）を維持する。
* [x] 操作直後の表示構成と、ファイル保存・再読み込み後の表示構成が一致する。

## DoR（着手合意）

* **任せる範囲**：設計・実装・自動テスト・独立レビュー・DoD 確認・MR 作成・CI 通過後のスカッシュマージまで一括委任（2026-11-28 ユーザー合意済み）
* **未決事項**：なし
* **着手合意**：合意済み（2026-11-28）

## 現在地

* **状況**：完了（クローズ済み・MR マージ待ち）
* **ブロッカー（確認待ち）**：なし
* **次に取る行動**：作業ブランチを push・MR 作成し、CI 成功後にスカッシュマージして `main` 側の一覧を再生成する

## 変更ファイル

<!-- AICO:AUTO:BEGIN:changed-files -->

| 種別 | パス |
| :--- | :--- |
| `M` | `docs/architecture/02.Data-Format-Spec.md` |
| `M` | `docs/architecture/03.UI-UX-Specification.md` |
| `A` | `scripts/empty-unclassified-group.test.mjs` |
| `M` | `src/parser.test.ts` |
| `M` | `src/parser.ts` |
| `M` | `src/store.test.ts` |
| `M` | `src/store.ts` |

<!-- AICO:AUTO:END:changed-files -->

## DoD（完了の定義）

* **AC 検証結果と根拠**：全 AC 達成。`cleanupEmptyUnclassifiedGroups` を `src/parser.ts`・`src/store.ts` の全更新・パース経路へ適用し、`src/parser.test.ts`・`src/store.test.ts`・`scripts/empty-unclassified-group.test.mjs` で不要な空未分類グループの除去・0 枚ウェルカム維持・保存再読み込み一致を検証、`npm test`（13 files / 141 tests）・`npm run build`・`npx tsc --noEmit`・`tools/aico.sh doctor --strict` 全通過および独立レビュー・独立再確認で未解決指摘 0 件を確認。
* **未検証項目と人の判断結果**：Obsidian 実機確認は未実施（自動テスト通過＋事前合意により完了）。
* **プロジェクト側設計書・仕様書の更新確認**：更新済み（`docs/architecture/03.UI-UX-Specification.md` のグループ移動・解除時の空グループ除去仕様、`docs/architecture/02.Data-Format-Spec.md` 4.1 節のパース時空未分類グループ整理仕様を更新）。
* **ADR の要否判断**：不要（シリアライズ規約とメモリモデルの整合化であり、既存アーキテクチャ方針を変更しないため）。
* **関連記録への導線確認**：確認済み（発見契機チケット `../archived/20261104-221107-ticket-send-cards-to-group/index.md` への相対リンク有効、子チケット・議事録・ADR なし）。

## 親子チケット・関連

* 旧管理番号: Item 0013（元ファイル: `backlog/items/0013-cleanup-empty-unclassified-group.md`）
* 発見契機チケット: [20261104-221107-ticket-send-cards-to-group](../archived/20261104-221107-ticket-send-cards-to-group/index.md)
