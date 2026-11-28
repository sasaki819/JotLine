---
id: 20261019-143003-ticket-undo-redo
title: JotLine ビューにアンドゥ／リドゥ機能を追加する（ショートカット＋ボタン）
status: done
created: 2026-10-19 14:30:03
updated: 2026-10-20 01:19:01
phase: closing
phase_status: done
branch: item/0003-undo-redo
parent: null
children: []
discussions: []
adrs:
  - 20261020-003000-adr-undo-history-as-text-snapshots
---
# JotLine ビューにアンドゥ／リドゥ機能を追加する（ショートカット＋ボタン）

## 概要

旧管理番号: Item 0003

現状の JotLine ビュー（サイドペイン・メインエリアとも）では、カードやスレッドに対する操作を取り消せない。`JotStore` に操作履歴がなく、各操作は即座にファイル全体を上書き保存する。Obsidian 標準の Ctrl/Cmd+Z も Markdown エディタ向けのため効かない。加えて、カード削除・一括削除・スレッド削除は確認なしで即時実行されるため、誤操作がそのままデータ消失につながる。

JotLine ビューで行った操作を取り消し（アンドゥ）・やり直し（リドゥ）できるようにする。操作はキーボードショートカットと、ビュー上のボタンの両方から行えるようにする。

この機能は、Item「D&D によるカードとノート間の移動機能」（0004）で JotLine 側の削除を安全に戻せるようにするための前提でもある。

## AC（受け入れ条件）

* [x] JotLine ビューで行った、ファイル内容を変更する操作（カードの追加・編集・削除・分割・統合・上下移動・D&D 並び替え、返信、グループ化・グループ化解除・スレッドのリネーム・解散・削除、一括削除）をアンドゥできる。
* [x] アンドゥした操作をリドゥできる。新しい操作を行うとリドゥ履歴は破棄される。
* [x] JotLine ビューにフォーカスがあるときに、キーボードショートカットでアンドゥ／リドゥできる。カード編集欄・返信欄・スレッド名編集欄・入力欄で文字入力中は、入力欄の標準のアンドゥを妨げない。
* [x] JotLine ビュー上にアンドゥ／リドゥのボタンがあり、実行できない状態では無効表示になる。ボタンのツールチップは i18n 辞書（en / ja）で提供する。
* [x] アンドゥ／リドゥの結果はファイルに保存され、同じファイルを開いている標準エディタにも反映される。
* [x] 外部（標準エディタ、同期、他アプリ等）でファイルが変更された場合でも、データが壊れたり外部の変更が失われたりしない（履歴の扱いは Spec で定める）。
* [x] 既存の操作の挙動、データフォーマット、`npm run build` / `npm test` / lint の成功を維持する。
* [x] 履歴の操作ロジックに単体テストがある。

## DoR（着手合意）

* **任せる範囲**：旧 `ai-dev-standard` 運用下で着手・完了済み
* **未決事項**：なし
* **着手合意**：合意済み（完了・アーカイブ済み）

## 現在地

* **状況**：完了・アーカイブ済み（`ai-dev-standard` から AIco へ移行）
* **ブロッカー（確認待ち）**：なし
* **次に取る行動**：なし

## 変更ファイル

<!-- AICO:AUTO:BEGIN:changed-files -->

| 種別 | パス |
| :--- | :--- |
| `M` | `README.md` |
| `M` | `docs/architecture/01.Architecture.md` |
| `M` | `docs/architecture/03.UI-UX-Specification.md` |
| `M` | `docs/architecture/04.Non-Functional.md` |
| `M` | `docs/architecture/README.md` |
| `A` | `src/__mocks__/obsidian.ts` |
| `A` | `src/history.test.ts` |
| `A` | `src/history.ts` |
| `M` | `src/i18n/locales/en.ts` |
| `M` | `src/i18n/locales/ja.ts` |
| `M` | `src/main.ts` |
| `A` | `src/store.test.ts` |
| `M` | `src/store.ts` |
| `M` | `src/ui/App.svelte` |
| `A` | `vitest.config.mjs` |

<!-- AICO:AUTO:END:changed-files -->

## DoD（完了の定義）

* **AC 検証結果と根拠**：`UndoHistory`・`JotStore` 統合・UI ボタン・ショートカット実装および単体テスト・実機確認・AI 実装レビュー（指摘0件）すべて完了。
* **未検証項目と人の判断結果**：なし
* **プロジェクト側設計書・仕様書の更新確認**：反映済み（`docs/architecture/01.Architecture.md`、`03.UI-UX-Specification.md`、`04.Non-Functional.md`、`docs/architecture/README.md`、`README.md`）。
* **ADR の要否判断**：作成済み（[20261020-003000-adr-undo-history-as-text-snapshots](../../../03.adr/20261020-003000-adr-undo-history-as-text-snapshots.md)）。
* **関連記録への導線確認**：確認済み

## 親子チケット・関連

* 旧管理番号: Item 0003（元ファイル: `backlog/archive/0003-undo-redo.md`）
* 作業計画（旧 `requirements.md`・`tasks.md`）: [plan.md](plan.md)
* 設計詳細（旧 `design.md`）: [notes/001-design.md](notes/001-design.md)
* 作業ログ・判断履歴（旧 `progress.md`）: [notes/002-progress.md](notes/002-progress.md)
* レビュー記録: [review/index.md](review/index.md)
* 関連 ADR: [20261020-003000-adr-undo-history-as-text-snapshots](../../../03.adr/20261020-003000-adr-undo-history-as-text-snapshots.md)

### 旧 Item メモ

- 規模が大きいため Spec を作成して進める（new-spec）。
- Spec で決めること（候補）:
  - ショートカットのキー（例：Ctrl/Cmd+Z、Ctrl/Cmd+Shift+Z、Ctrl+Y）と、Obsidian のホットキー設定から変更できるコマンドとして登録するかどうか
  - ボタンの配置（例：ヘッダー）とアイコン
  - 履歴の保持単位（ビュー／ファイルごと）、上限数、保持期間（ビューを閉じたら破棄するか）
  - 外部変更を検知したときの履歴の扱い（破棄する／外部変更を1つの履歴として扱う など）
  - 実装方式（操作前のドキュメント全体のスナップショットを積む方式が素直。データ構造が小さいため現実的）
- 関連する既存実装：`src/store.ts`（全操作が `doc.update` → `save()` を通る）、`src/ui/App.svelte`（Esc による選択解除のキー処理）。
