---
id: "0002"
title: "doc/ の設計書を docs/architecture/ へ統合（移動）する"
status: done        # backlog / ready / in-progress / done / dropped
priority: medium       # high / medium / low
owner: ""
created: 2026-10-19
spec: ""               # 例: specs/0012-login-rework/（Spec を作らない場合は空）
discussions: []        # 例: [discussions/2026-10-15-auth-ideas.md]
---
## 概要

ai-dev-standard の導入により、システム全体の最新設計（マスタードキュメント）の置き場所は `docs/architecture/` になった。一方、既存の設計書5本は `doc/` にあり、マスタードキュメントの置き場所が2つに分かれている。`doc/` の内容を `docs/architecture/` へ移動して一本化し、以降の Item のマスタードキュメント反映先を `docs/architecture/` に統一する。

対象（2026-10-19 時点）:

- `doc/00.Overview.md`（製品概要・ドキュメントマップ）
- `doc/01.Architecture.md`（システム構造）
- `doc/02.Data-Format-Spec.md`（データフォーマット）
- `doc/03.UI-UX-Specification.md`（UI/UX 仕様）
- `doc/04.Non-Functional.md`（非機能要件）

## 受入基準

- `doc/` の5文書が `docs/architecture/` に移動され、`doc/` ディレクトリが残っていない。
- 文書の内容（記述そのもの）は、パスやリンクの修正を除いて変わっていない。
- 文書間の相対リンクと、`00.Overview.md` のドキュメントマップ（`doc/` のツリー表記を含む）が新しい配置で正しく辿れる。
- `docs/architecture/README.md` に、配置した文書の一覧と役割が記載されている。
- リポジトリ内に `doc/` を指す参照が残っていない。
- `git mv` で移動し、変更履歴を追えるようにする。
- `check-docs` が OK で終了する。

## タスク（Spec を作らない小規模な Item の場合のみ）
- [x] `doc/` の5文書を `git mv` で `docs/architecture/` へ移動する
  - ファイル名（`00.`〜`04.` の番号付け）は維持した。文書間のリンクは同じディレクトリ内の相対リンクのため、変更なしでそのまま辿れる。
- [x] `00.Overview.md` のドキュメントマップ（ツリー表記・リンク）を新しい配置に合わせて修正する
  - ツリーの起点を `docs/architecture/` にし、`README.md` の行を追加した。
- [x] `docs/architecture/README.md` に文書の一覧と役割を追記する（初期状態の「説明のみです」の記述も更新する）
- [x] リポジトリ内（README.md など）に `doc/` への参照が残っていないことを確認する
  - 残っているのは、この Item 自身と完了済み Item 0001（`backlog/archive/`）の記述だけ。いずれも当時の状況の記録のため変更しない。
- [x] `check-docs` を実行して OK を確認する
- [x] マスタードキュメントへの反映（この Item 自体がマスタードキュメントの再配置のため、上記タスクで完了とする）
## メモ

- `docs/architecture/` はプロジェクト所有の領域で、sync では変更されない（`tools/ai-standard/manifest.txt` の記載による）。
- ファイル名の番号付け（`00.`〜`04.`）を維持するか改めるかは、着手時に決めてよい。改める場合はリンクもあわせて修正する。
