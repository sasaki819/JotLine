---
id: 20261019-143001-ticket-fix-lint-errors
title: lint（npx tsc --noEmit）のエラーを解消する
status: done
created: 2026-10-19 14:30:01
updated: 2026-10-19 14:57:39
phase: closing
phase_status: done
branch: item/0001-fix-lint-errors
parent: null
children: []
discussions: []
adrs: []
---
# lint（npx tsc --noEmit）のエラーを解消する

## 概要

旧管理番号: Item 0001

AGENTS.md で lint コマンドに指定した `npx tsc --noEmit` が、既存の型エラーにより失敗する（終了コード2）。機械検証として lint を通せる状態にするため、これらのエラーを解消する。

2026-10-19 時点で出ているエラーは4件で、原因は次の3つ（1は2箇所で報告される）。

1. `src/declarations.d.ts(12,17)` と `node_modules/svelte/types/index.d.ts(1804,30)`：TS2300 Duplicate identifier 'component'（自前の `*.svelte` モジュール宣言と Svelte 本体の型定義が重複）
2. `node_modules/vite/dist/node/index.d.ts(5,41)`：TS2307 Cannot find module 'rollup/parseAst'（Vitest 経由で読み込まれる vite の型が、現在の `moduleResolution: "node"` では解決できない）
3. `src/main.ts(186,4)`：TS2322 `WorkspaceLeaf | null` を `WorkspaceLeaf | undefined` 型の変数に代入している（`getRightLeaf()` の戻り値）

## AC（受け入れ条件）

* [x] `npx tsc --noEmit` が終了コード0で終了する。
* [x] `npm run build` と `npm test` が引き続き成功する。
* [x] プラグインの動作（実行時の挙動）を変えない。
* [x] 型検査を無効化・緩和する変更（`skipLibCheck` の導入や `// @ts-ignore` の追加など）を行う場合は、その範囲と理由を記録する。

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
| `D` | `src/declarations.d.ts` |
| `M` | `src/main.ts` |
| `M` | `tsconfig.json` |

<!-- AICO:AUTO:END:changed-files -->

## DoD（完了の定義）

* **AC 検証結果と根拠**：`npx tsc --noEmit`、`npm run build`、`npm test`（20件）すべて終了コード 0 で成功。ビルド結果 `main.js` は変更前とバイト単位で一致し実行時挙動の変化なし。
* **未検証項目と人の判断結果**：なし
* **プロジェクト側設計書・仕様書の更新確認**：不要（型検査設定と型注釈のみの変更であり設計・仕様・動作の変更なし）。
* **ADR の要否判断**：不要（小規模な型エラー修正のため）。
* **関連記録への導線確認**：確認済み

## 親子チケット・関連

* 旧管理番号: Item 0001（元ファイル: `backlog/archive/0001-fix-lint-errors.md`）
* 作業計画: [plan.md](plan.md)

### 旧 Item メモ

- 型検査を無効化・緩和する変更（`skipLibCheck` や `// @ts-ignore` の追加）は行っていない。
- `tsc` は `.svelte` ファイルの中身（`<script lang="ts">` 部分）を型検査しない。Svelte コンポーネントの型検査（`svelte-check` の導入など）はこの Item の範囲外とし、必要なら別 Item とする。
