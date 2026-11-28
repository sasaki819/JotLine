# 作業計画

## 合意した仕様

小規模 Item（旧 Item 0001、Spec なし）として [index.md](index.md) の概要・AC に沿って実施した。

## ステップ一覧

- [x] `*.svelte` モジュール宣言の重複（TS2300）を解消する
  - Svelte 4 の型定義（`node_modules/svelte/types/index.d.ts`）自体が `declare module '*.svelte'` を提供しているため、重複していた自前の `src/declarations.d.ts` を削除した。
- [x] vite の型 `rollup/parseAst` の解決エラー（TS2307）を解消する
  - `tsconfig.json` の `moduleResolution` を `node` から `bundler` に変更した（package.json の `exports` を解決できるようにするため。実際のバンドルは esbuild が行うため、型検査の設定のみの変更）。
- [x] `src/main.ts` の `getRightLeaf()` の戻り値の型不一致（TS2322）を解消する
  - `openScratchpad()` の変数 `leaf` に `WorkspaceLeaf | null | undefined` の型注釈を付けた（処理は変更なし）。
- [x] `npx tsc --noEmit`、`npm run build`、`npm test` がすべて成功することを確認する
  - 3つとも成功（終了コード0、テスト20件成功）。ビルド結果の `main.js` は変更前のビルドとバイト単位で一致し、実行時の動作に変化がないことを確認した。
- [x] マスタードキュメントへの反映：不要。型検査の設定と型注釈のみの変更で、設計・仕様・動作に変更がなく、設計書（`doc/`、`docs/architecture/`）にも該当する記述がないため。

## 検証方針

[index.md](index.md) の DoD 記載の検証コマンドを実行し通過を確認した。

## 判断ログ

特記事項は [index.md](index.md) の旧 Item メモを参照。
