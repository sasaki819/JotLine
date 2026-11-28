# マスタードキュメント（docs/architecture/）

このディレクトリには、システム全体の**最新の設計**を置きます。

- ここにある文書は常に現在のシステムを表すように更新します。個別チケットの作業完了時（DoD 確認時）に、仕様・設計の変更をこのディレクトリの文書へ反映します。
- 変更の経緯はチケット記録（`management/04.tickets/`）および ADR（`management/03.adr/`）に残ります。

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
