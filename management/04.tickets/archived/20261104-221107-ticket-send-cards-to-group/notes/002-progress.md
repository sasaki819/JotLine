---
id: 002-progress
title: 作業ログ・判断履歴（旧 Spec 0007 progress.md）
created: 2026-11-04 22:11:07
updated: 2026-11-28 01:50:31
---
# 作業ログ・判断履歴（旧 Spec 0007 progress.md）

## 概要

旧 `specs/0007-send-cards-to-group/progress.md` の作業ログおよび判断履歴を AIco チケットノートとして移行保存したもの。

<!-- 日付ごとに追記する。新しい日付を下に足す。 -->

Item 0007 の承認経緯と、カードの移動・グループ解除に関する判断を記録する。

## 2026-11-24

### 作業ログ

- マージ済みの `main` から `feature/0007-send-cards-to-group` を作成し、requirements、design、tasks を順に作成した。
- ユーザーが各文書を承認したため、Item を `ready` に更新し、Spec を関連付けた。
- Task 1 に着手し、Item の `status` を `in-progress` に更新して `BACKLOG.md` を再生成した。
- `src/parser.ts` に共通一括移動ヘルパーと `moveCardsToGroupInDoc()`、`dissolveGroupInDoc()` を実装し、`ungroupCards()` を末尾の未分類グループへ移動する仕様に更新した。
- `src/store.ts` に `moveCardsToGroup()` と `dissolveGroup()` を追加し、`ungroupSelectedCards()` を `applyChange()` 経由に切り替えた。
- `src/ui/GroupView.svelte` のスレッド解散ボタンを `store.dissolveGroup()` へ接続した。
- `src/parser.test.ts`、`src/store.test.ts`、`scripts/group-dissolve.test.mjs` を追加・更新し、`npm run build`、全116テスト、`npx tsc --noEmit`、`bash tools/ai-standard/check-docs.sh` が成功した。
- Task 2 に着手し、`src/i18n/locales/en.ts`・`src/i18n/locales/ja.ts` に `MENU_SEND_TO_GROUP`（`Send to group`／`グループへ移動`）と `MENU_SEND_TO_GROUP_UNGROUP`（`Ungroup`／`グループ解除`）を追加した。
- `src/ui/cardMoveMenu.ts` を新規作成し、表示順の名前付きグループ一覧・区切り線・「グループ解除」の構築と、`MenuItem.setSubmenu()` 対応環境／未対応環境（クリックで子 `Menu` を表示）の両経路を実装した。
- `src/ui/App.svelte` の `handleContextMenuCard()` へ単一・複数選択共通で `addCardMoveMenu()` を組み込み、保存失敗時も含めた選択解除と、新旧すべてのカード解除操作の統一を行った。
- `src/__mocks__/obsidian.ts`、`src/ui/cardMoveMenu.test.ts`、`scripts/card-context-menu.test.mjs` を追加・更新し、`npm run build`、全127テスト、`npx tsc --noEmit`、`bash tools/ai-standard/check-docs.sh` が成功した。
- Task 3（Obsidian 実画面での受入確認）を実施し、AC1〜AC11 を照合した。
  - デスクトップ（Ubuntu 26.04 / Obsidian v1.15.1 / English）：メニューの開閉と候補選択（サブメニュー対応経路）、単一・複数カード移動と順序保持、グループ解除後の末尾配置、スレッド解散、再読み込み、Undo／Redo、キャンセル無変更の全項目で OK を確認した。
  - モバイル（Android 17 / Obsidian v1.15.1 / English）：既存のカードメニューからグループ候補および「グループ解除」を選択・実行できることを確認した（グループ選択後も選択肢が閉じず選び直せる動作を確認）。
  - 最小対応バージョン（Obsidian 1.1.0 等の `MenuItem.setSubmenu()` 非対応環境）：実環境を用意できないため未確認として記録した（フォールバック経路は単体・結合テストで検証済み）。
- 実画面検証で報告された「カード0枚の既存名前付きグループが別カード移動時に消える」不具合について、design の仕様（対象を含まない既存グループの名前・ID・順序を維持する）に反していたため `src/parser.ts` の `moveCardsInDoc()` を修正し、`src/parser.test.ts` に回帰テストを追加した。
- 修正後に `npm run build`、全128テスト（11ファイル）、`npx tsc --noEmit`、`bash tools/ai-standard/check-docs.sh` が成功した。
- 実画面検証で出たスコープ外の課題3件を別 Item として `backlog/items/` に起票した（`0012-unify-unclassified-card-spacing`、`0013-cleanup-empty-unclassified-group`、`0014-keep-selection-after-group-move`）。
- 固定 Task「マスタードキュメント（docs/architecture/）へ design の内容を反映」を実施し、`docs/architecture/03.UI-UX-Specification.md` に右クリックメニューの候補と操作、カード解除時の末尾配置、スレッド解散の動作、操作履歴への反映を記載して、`bash tools/ai-standard/check-docs.sh` が成功した。
- 固定 Task「ADR の要否判断（必要なら作成）」を実施し、ADR 作成不要と判断した。
- `self-review` スキルで別コンテキストの AI レビューを実施し、`specs/0007-send-cards-to-group/reviews/2026-11-24-impl-ai.md` を作成した（High 0件・Medium 0件・Low 1件: R1）。
- ユーザーが R1 を `accepted` としたため `apply-review` を実施し、`src/store.ts` の `applyChange()` が `save()` の `"unchanged"` 時にも `false` を返すよう修正した。`src/__mocks__/obsidian.ts` と `src/store.test.ts` に回帰テストを追加し、`npm run build`、全130テスト（11ファイル）、`npx tsc --noEmit`、`bash tools/ai-standard/check-docs.sh` が成功してコミットした（`a088819`）。R1 の状態を `fixed` に更新した。

### 判断とその理由

- メニューの日本語表示は「グループへ移動」とする。名前付きグループは表示順に並べ、「グループ解除」は区切り線で分ける。
- カードのグループ解除は、対象カードの並び順を維持してファイル末尾の未分類グループへ移す。末尾に未分類グループがない場合は作成する。スレッド解散はその場で名前を外す専用の操作とする。
- 複数カードの移動は一括で保存し、履歴を1件にまとめる。保存に失敗した場合は操作前の配置を復元する。
- サブメニューを提供する環境ではその機能を使う。未対応環境では、親項目のクリックで移動先を選べる子メニューを開く。
- 共通一括移動ヘルパーは元のモデルを変更せずに次状態のグループ配列を組み立てて、グループ ID・グループ名・カード ID 列が一致する場合は `false` を返して保存と履歴を抑制する方式とした（部分更新や途中状態の残留を防ぐため）。
- `ungroupSelectedCards()` の成功通知は `applyChange()` が `true` を返した場合のみ表示するよう変更した（無変更や保存失敗時に通知を出さないため）。
- `addCardMoveMenu()` で `setSubmenu()` の呼び出しが例外を投げた場合は、エラーログのみ出力してクリックで子 `Menu` を開くフォールバック経路へ進めるようにした（例外時もデータ操作を行わず、かつ未対応実装への耐性を保つため）。
- `moveCardsInDoc()` では対象カードを1枚以上含んでいた名前付きグループが移動により空になった場合のみ除去するよう修正した（元々カード0枚の無関係な名前付きグループを維持するため）。
- 実画面検証で挙がった隣接未分類グループ間のマージン（`0012`）、空になった未分類グループ枠の残存（`0013`）、移動後の選択状態維持（`0014`）は Item 0007 の設計範囲外または既存仕様に関わるため、その場では変更せず新規 Item として切り出した。
- マスタードキュメントの更新対象は design の影響範囲どおり `docs/architecture/03.UI-UX-Specification.md` に限定し、操作仕様・末尾配置・スレッド解散との違い・履歴仕様の整合を取った。
- ADR の要否：作成不要と判断した。データ形式、履歴のテキストスナップショット方式（ADR 0001）、依存パッケージ、`minAppVersion`（1.1.0）などアーキテクチャ全体に関わる根本方針の変更がなく、公開 API 外の `MenuItem.setSubmenu()` 対応も `src/ui/cardMoveMenu.ts` 内に局所化して公開 API の子メニューへ安全にフォールバックする実装にとどまるため。
- R1 対応方針：`applyChange()` で `result !== "saved"` の場合に `this.doc.set(parseJotDocument(this.currentText))` で実体と同期して `false` を返す方式とした。呼び出し側で判別する案と比べ、`ungroupSelectedCards()` が無変更時に成功通知を出さないだけでなく、シリアライズされないメモリ上の空未分類グループ残留による実体との乖離も防げるため。

### 中断点（次に何をすべきか）

- `self-review` および `apply-review` 完了（未対応の Finding なし）。次は `pr-draft` または `close-item` の実施。
