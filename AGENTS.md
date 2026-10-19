# JotLine

## プロジェクト概要

Obsidian のコミュニティプラグイン。チャット風の入力バーで断片的なメモを素早くカードとして蓄積し、スレッド化・並び替え・Markdown エクスポートで整理する。データは独自DBを持たず、Markdown ファイルと HTML コメントマーカー（`<!-- group -->` / `<!-- card -->`）で保存する。利用者は、クイックキャプチャや思考整理に使う Obsidian ユーザー。

## 技術スタック

TypeScript（ES2022）、Svelte 4、Obsidian Plugin API（minAppVersion 1.0.0、デスクトップ／モバイル対応）、esbuild + esbuild-svelte（CSS をインライン化した `main.js` 単一バンドル）、Vitest、Node.js / npm

## コマンド

- ビルド: `npm run build`（開発時の監視ビルドは `npm run dev`）
- テスト: `npm test`
- lint: `npx tsc --noEmit`

<!-- プロジェクト固有のルールはこの位置（標準管理領域の外）に追記する。sync では変更されない。 -->

<!-- ai-standard:begin -->
<!-- この区間は ai-dev-standard の管理対象。直接編集せず、ai-dev-standard 側を更新して sync すること。 -->

## 用語

用語は次の定義どおりに使い、別の言い方を混在させない。

| 用語 | 定義 |
|---|---|
| Backlog | 未完了の作業項目の集合。`backlog/` 配下で管理する |
| Item | Backlog の1項目。1ファイル = 1 Item。ID は4桁の連番（例：`0012`） |
| Spec | 着手が決まった Item の詳細文書一式。`specs/<ID>-<slug>/` に置く |
| requirements | Spec のうち、何を・なぜ作るかと受入基準 |
| design | Spec のうち、どう作るか（その Item による変更分の設計） |
| tasks | Spec のうち、実行単位の作業リスト。1 Task はおおむね1セッションで完結する粒度 |
| progress | 作業ログ、判断ログ、中断点の記録（任意） |
| Review | AIまたは人によるレビューの記録。Spec 配下の `reviews/` に置く |
| Finding | Review 内の指摘1件 |
| Discussion | Spec化前のブレインストーミングや議論の経緯記録。`discussions/` に置く |
| ADR | Architecture Decision Record。重要な設計判断とその理由の記録。`docs/adr/` に置く |
| 正本ドキュメント | システム全体の最新設計。`docs/architecture/` に置く。design の内容は Item 完了時にここへ反映する |
| DoD | Definition of Done。Item を完了扱いにするための条件（下記） |

## ディレクトリの役割

| パス | 役割 |
|---|---|
| `BACKLOG.md` | Backlog の一覧。backlog-index が自動生成する（手編集禁止） |
| `backlog/items/` | 未完了の Item（`<ID>-<slug>.md`） |
| `backlog/archive/` | status が done / dropped の Item |
| `specs/<ID>-<slug>/` | Spec（requirements.md、design.md、tasks.md、progress.md、`reviews/`） |
| `discussions/` | Discussion（`YYYY-MM-DD-<slug>.md`）。作成後は更新しない |
| `docs/architecture/` | 正本ドキュメント |
| `docs/adr/` | ADR（`NNNN-<slug>.md`） |
| `docs/process.md` | 人間向けの運用フロー説明 |
| `templates/` | 各文書の雛形。新しい文書は必ずここからコピーして作る |
| `tools/ai-standard/` | backlog-index、check-docs（`.sh` と `.ps1`） |
| `.claude/skills/`、`.agents/skills/` | スキル（同一内容のコピー。標準の管理対象） |

## 作業フロー

| # | 工程 | 担当 | スキル |
|---|---|---|---|
| 1 | Item を起票する | 人、または人の指示でAI | new-item |
| 2 | Spec（requirements → design → tasks）を作成し、人が承認する | AI＋人 | new-spec |
| 3 | Task を1つずつ実装し、検証・記録・コミットする | AI | implement-task |
| 4 | 機械検証が通ったら、**別のコンテキスト**でAIレビューする | AI | self-review |
| 5 | Finding を選別する（open → accepted / wontfix） | 人 | - |
| 6 | accepted の Finding に対応する | AI | apply-review |
| 7 | 人のレビュー指摘を Review に記録して対応する | AI | apply-review |
| 8 | 対応結果を確認する | 人 | - |
| 9 | PR／MR の本文を作成する（作成操作は人が行う） | AI | pr-draft |
| 10 | 上位責任者が PR／MR をレビューする。設計変更は design.md や ADR に反映する | 人 | - |
| 11 | マージ前に完了処理を行う | AI | close-item |

## DoD

- tasks.md の全 Task にチェックが入っている（正本反映と ADR 要否判断を含む）。
- 該当 Spec の `reviews/` 配下に、状態が open または accepted の Finding が残っていない。
- check-docs が成功する。
- Item の status が done になり、`backlog/archive/` に移動されている。

## Review の状態

- `open`：未判定 / `accepted`：人が対応すると判定した / `wontfix`：人が対応しないと判定した（対応欄に理由が必須） / `fixed`：対応済み（対応欄に内容とコミットID）
- AIは accepted の Finding だけに対応する。open を accepted / wontfix に変えるのは人の判断とする。

## AIへの行動規則

- Backlog の優先度をAIが決めない。
- 作業中に見つけた別の課題は、その場で直さず新しい Item として起票を提案する。
- `BACKLOG.md` を手で編集しない。Item を変更したら backlog-index を実行して再生成する。
- `.claude/skills/` と `.agents/skills/` を直接編集しない（標準の管理対象のため）。
- 作業の開始時には、対象 Item の Spec 配下だけを読む。Backlog 全体はコンテキストに読み込まない。
- Task が完了したら、tasks.md のチェックと progress.md を更新する。
- 「完了」の報告は、検証コマンドが成功した場合に限る。

## スクリプト

- Linux / macOS：`bash tools/ai-standard/backlog-index.sh`、`bash tools/ai-standard/check-docs.sh`
- Windows：`powershell -ExecutionPolicy Bypass -File tools/ai-standard/backlog-index.ps1`（check-docs も同様）
<!-- ai-standard:end -->
