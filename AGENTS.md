# JotLine

## プロジェクト概要

Obsidian のコミュニティプラグイン。チャット風の入力バーで断片的なメモを素早くカードとして蓄積し、スレッド化・並び替え・Markdown エクスポートで整理する。データは独自DBを持たず、Markdown ファイルと HTML コメントマーカー（`<!-- group -->` / `<!-- card -->`）で保存する。利用者は、クイックキャプチャや思考整理に使う Obsidian ユーザー。

## 技術スタック

TypeScript（ES2022）、Svelte 4、Obsidian Plugin API（minAppVersion 1.1.0、デスクトップ／モバイル対応）、esbuild + esbuild-svelte（CSS をインライン化した `main.js` 単一バンドル）、Vitest、Node.js / npm

## コマンド

- ビルド: `npm run build`（開発時の監視ビルドは `npm run dev`）
- テスト: `npm test`
- lint: `npx tsc --noEmit`
- 管理記録の診断: `tools/aico.sh doctor`

## 設計書マスター

- システム全体の最新設計は `docs/architecture/` に配置する（詳細は `docs/architecture/README.md` を参照）。
- 機能追加・仕様変更を行うチケットでは、クローズ時の DoD に従い `docs/architecture/` の更新または不要判断を確認する。

## ブランチ運用

- 統合ブランチは `main` とする。議事録・ADR・Runbook・チケット起票・全体一覧の再生成は `main` 上で行う。
- 個別チケットの作業は `aico-ticket-start` で作成した作業ブランチ（既定: `feature/<チケットID>`）上で行う。対象チケットの作業ブランチが既にある場合は、そのブランチで作業する。
- コミット・push は対象の作業ブランチで行い、リモートにも同じ名前のブランチへ push する。
- 「pushして」は対象の作業ブランチへの push と解釈する。
- `main` への直接 push は、ユーザーが `main` を送信先として明示的に指定した場合のみ行う。
- push 前に現在のブランチと送信先を確認する。

<!-- AICO:BEGIN -->

# AIco 協業ガイドライン

## 1. AIco の基本原則

AIco は、AI が作業を主導しつつ人間が重要な判断を行う協業ワークフローである。  
以下の原則に従って作業を進めること。

* **AI 主導と人間判断**：調査・起票・計画・設計・実装・レビュー準備は AI が主導し、着手合意（DoR）・レビュー指摘の採否選別・完了承認（DoD）・仕様矛盾の解消は必ず人間の判断を得る。
* **管理ルートでの情報集約**：相談（議事録）・ADR・チケット・Runbook は管理ルート（既定：`management/`）配下で管理し、プロジェクト固有資産と明確に分離する。
* **スクリプト分離**：記録作成・frontmatter 更新・一覧再生成・変更ファイル一覧更新・アーカイブ・エージェント同期・診断などの機械処理は、手作業で行わず `management/scripts/` 配下の共有スクリプトを使用する。
* **ブランチ更新責務**：議事録・ADR・Runbook・チケット起票・全体一覧の再生成は統合ブランチ上で行い、個別チケットの進行・成果物作成・レビュー記録は作業ブランチ上で行う。
* **AIco 由来領域の保護**：本ファイルのマーカー内（`<!-- AICO:BEGIN -->` 〜 `<!-- AICO:END -->`）、`CLAUDE.md`、`.agents/skills/aico-*`、`tools/aico.*`、`management/01.manual/`・`templates/`・`scripts/` は AIco 由来領域であり、導入先で直接改造しない。プロジェクト固有の規約や上書き方針は本ファイルのマーカー外へ記載する。
* **進行案内と選択肢提示の原則**：工程完了・人間承認待ち・判断委譲の際はオープンな質問だけで終わらせず、推奨案を先頭に置いた 2〜4 件の具体的な番号付き選択肢を通常の Markdown リストで提示する（選択肢を独自タグ内に隠さず、人間が番号のみで応答できる形にする）。
* **行動ガードレール**：
  * 作業中に見つけたスコープ外の課題や不具合はその場で修正せず、発見事実を報告して別チケット起票を提案する。
  * テストや検証コマンドが成功する前に完了報告やチェック（`[x]`）を入れず、テスト削除・無効化・条件緩和で通さない。
  * 作業開始時は全記録を無差別に読み込まず、対象チケットや関連記録など必要最小限のコンテキストだけを読み込む。

## 2. 作業開始時の確認手順

新しいセッションを開始または再開する際は、以下の順で現在状況を実物照合すること。

1. `management/aico-manifest.json` を確認し、`management_root`・`integration_branch`・有効な `tools` を把握する。
2. `management/index.md`（ダッシュボード）および現在の Git ブランチを確認する。
3. 進行中の作業や次に取るべきアクションの判定には `aico-ticket-status` スキル（または `uv run management/scripts/ticket_status.py`）を使用する。

※`management/index.md` は統合済み記録の一覧であり、未統合の作業ブランチ上の途中進捗は含まれない。作業中の最新状況は各作業ブランチのチケット記録で確認すること。

## 3. 工程別スキル案内表

場面に応じて、`.agents/skills/` 配下の以下の `aico-*` スキルを使用すること。

| 区分 | スキル名 | 主な用途 |
| :--- | :--- | :--- |
| 横断・運用 | `aico-markdown-write` | 管理記録・文書作成時の Markdown 品質規約を適用する |
| 横断・運用 | `aico-archive` | 完了済み記録を `archived/` へ移動しリンクと一覧を更新する |
| 横断・運用 | `aico-doctor` | 環境・設定・同期・記録規約・リンク切れを総合診断する |
| 横断・運用 | `aico-feedback` | AIco の問題点や改善要望を構造化 Markdown で出力する |
| 相談・ADR・Runbook | `aico-discuss` | 相談・構想の壁打ちを行い議事録へ構造化して記録する |
| 相談・ADR・Runbook | `aico-create-adr` | 複数作業に影響する設計判断を ADR として記録する |
| 相談・ADR・Runbook | `aico-create-runbook` | 繰り返し実施する定常作業を手順書として作成・改訂する |
| 相談・ADR・Runbook | `aico-runbook-run` | Runbook 手順書に従って実施し、実施記録と添付物を残す |
| チケット | `aico-create-ticket` | 統合ブランチ上でチケットを起票し概要・AC・DoR を整える |
| チケット | `aico-ticket-start` | DoR を確定し作業ブランチを作成・切替して対応を開始する |
| チケット | `aico-ticket-plan` | 現状調査と仕様合意を行い `plan.md` を策定する |
| チケット | `aico-ticket-design` | 合意仕様にもとづき設計書・仕様書を作成・更新する |
| チケット | `aico-ticket-implement` | 計画と設計に沿って実装・テスト検証を進める |
| チケット | `aico-ticket-close` | 変更ファイル更新・DoD 確認・完了確定および統合後の一覧再生成を行う |
| チケット | `aico-ticket-pr` | 作業ブランチの差分と記録から PR/MR 用の Title・Description を出力する（任意） |
| チケット | `aico-ticket-cancel` | 人間承認を得てチケットを中止し統合側へ反映する |
| チケット | `aico-ticket-status` | 実物照合で現在地を把握し次に実行すべきスキルを提案する |
| レビュー | `aico-review` | 独立コンテキストでのレビューまたは人間レビュー指摘の記録を行う |
| レビュー | `aico-review-triage` | 未選別の指摘を人間へ提示し採否判断を記録する |
| レビュー | `aico-review-fix` | 人間が採用した指摘を修正し経緯を記録する |
| レビュー | `aico-review-recheck` | 独立コンテキストで修正内容を実物照合し解消確認・差し戻しを行う |

## 4. ユーザーガイド・マニュアルへの参照

導入手順・最初の1チケットの進め方・日常運用の早見表・FAQ は以下のガイドを参照すること（初見ユーザーから使い方を尋ねられた場合もこれらを案内する）。

* [AIco ユーザーガイド目次](management/01.manual/index.md)
* [Getting Started（導入と初期設定）](management/01.manual/01.getting-started.md)
* [チュートリアル（最初の1チケットを回してみよう）](management/01.manual/02.tutorial.md)
* [チートシート（普段使いの早見表）](management/01.manual/03.cheatsheet.md)
* [使いこなしガイド・FAQ](management/01.manual/04.user-guide.md)
* [おすすめ `worker_models` 設定例](management/01.manual/05.worker-models.md)

<!-- AICO:END -->
