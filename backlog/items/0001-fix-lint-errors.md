---
id: "0001"
title: "lint（npx tsc --noEmit）のエラーを解消する"
status: backlog        # backlog / ready / in-progress / done / dropped
priority: medium       # high / medium / low
owner: ""
created: 2026-10-19
spec: ""               # 例: specs/0012-login-rework/（Spec を作らない場合は空）
discussions: []        # 例: [discussions/2026-10-15-auth-ideas.md]
---
## 概要

AGENTS.md で lint コマンドに指定した `npx tsc --noEmit` が、既存の型エラーにより失敗する（終了コード2）。機械検証として lint を通せる状態にするため、これらのエラーを解消する。

2026-10-19 時点で出ているエラーは4件で、原因は次の3つ（1は2箇所で報告される）。

1. `src/declarations.d.ts(12,17)` と `node_modules/svelte/types/index.d.ts(1804,30)`：TS2300 Duplicate identifier 'component'（自前の `*.svelte` モジュール宣言と Svelte 本体の型定義が重複）
2. `node_modules/vite/dist/node/index.d.ts(5,41)`：TS2307 Cannot find module 'rollup/parseAst'（Vitest 経由で読み込まれる vite の型が、現在の `moduleResolution: "node"` では解決できない）
3. `src/main.ts(186,4)`：TS2322 `WorkspaceLeaf | null` を `WorkspaceLeaf | undefined` 型の変数に代入している（`getRightLeaf()` の戻り値）

## 受入基準

- `npx tsc --noEmit` が終了コード0で終了する。
- `npm run build` と `npm test` が引き続き成功する。
- プラグインの動作（実行時の挙動）を変えない。
- 型検査を無効化・緩和する変更（`skipLibCheck` の導入や `// @ts-ignore` の追加など）を行う場合は、その範囲と理由を記録する。

## タスク（Spec を作らない小規模な Item の場合のみ）
- [ ] `*.svelte` モジュール宣言の重複（TS2300）を解消する
- [ ] vite の型 `rollup/parseAst` の解決エラー（TS2307）を解消する
- [ ] `src/main.ts` の `getRightLeaf()` の戻り値の型不一致（TS2322）を解消する
- [ ] `npx tsc --noEmit`、`npm run build`、`npm test` がすべて成功することを確認する
- [ ] 正本ドキュメントへの反映（不要なら「不要」と理由を記載してチェック）
## メモ

- `tsc` は `.svelte` ファイルの中身（`<script lang="ts">` 部分）を型検査しない。Svelte コンポーネントの型検査（`svelte-check` の導入など）はこの Item の範囲外とし、必要なら別 Item とする。
