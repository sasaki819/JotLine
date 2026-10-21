# 正本ドキュメント（docs/architecture/）

このディレクトリには、システム全体の**最新の設計**を置きます。

- 各 Spec の design.md は「その Item による変更分」の設計です。Item の完了時に、その内容をこのディレクトリの文書へ反映します（tasks.md の固定 Task「正本ドキュメント（docs/architecture/）へ design の内容を反映」）。
- ここにある文書は常に現在のシステムを表すように更新します。変更の経緯は Spec と ADR（`docs/adr/`）に残ります。
- 文書の分け方（全体構成、コンポーネント別、データモデルなど）はプロジェクトで決めてください。

## 文書一覧

JotLine の設計・仕様は、関心事ごとに次の文書に分けています。最初に [00.Overview.md](00.Overview.md) を読んでください。

| 文書 | 内容 |
|---|---|
| [00.Overview.md](00.Overview.md) | 製品のビジョン、解決する課題、コアコンセプト、ドキュメントマップ |
| [01.Architecture.md](01.Architecture.md) | 技術スタック、コンポーネント構造、状態管理（`JotStore`、操作履歴）、スクラッチパッドと任意ノートの運用形態、起動時の初期生成、ドラッグ＆ドロップの仕組み |
| [02.Data-Format-Spec.md](02.Data-Format-Spec.md) | Markdown と HTML コメントマーカーによる保存形式、パース・シリアライズ・エクスポートの規則、フェイルセーフ |
| [03.UI-UX-Specification.md](03.UI-UX-Specification.md) | 画面レイアウト、入力・カード・スレッドの操作、複数選択、エクスポート、キーボードショートカット、アンドゥ／リドゥ、ドラッグ＆ドロップによる移動・コピー |
| [04.Non-Functional.md](04.Non-Functional.md) | ファイル書き込みの安全性、外部変更との競合制御、多言語対応、AI エージェント向け仕様書、ドラッグ＆ドロップによる移動の安全性、パフォーマンスとリソース管理 |
| [05.Build-and-Release.md](05.Build-and-Release.md) | GitLab CI のパイプライン（対象、ステージとジョブ）、ビルド結果のアーティファクト、リリース（リリース前チェック、Package Registry、Releases）、バージョンと変更履歴 |
