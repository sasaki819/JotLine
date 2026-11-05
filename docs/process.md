# 開発プロセス（ai-dev-standard）

このプロジェクトでの、人とAIによる開発の進め方を説明します。AIが常に従うルールは `AGENTS.md` にあります。

> この文書は ai-dev-standard の管理対象です。直接編集せず、ai-dev-standard 側を更新して sync してください。

## 全体像

```
Discussion ──▶ Item ──▶ Spec ──▶ Task 実装 ──▶ AIレビュー ──▶ 人のレビュー ──▶ PR／MR ──▶ 完了処理
（任意）    new-item  new-spec  implement-task  self-review   apply-review   pr-draft    close-item
```

## 用語

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
| マスタードキュメント | システム全体の最新設計。`docs/architecture/` に置く。design の内容は Item 完了時にここへ反映する |
| DoD | Definition of Done。Item を完了扱いにするための条件 |

## 運用フロー

1. 人が Item を起票、または起票をAIに指示する（スキル：new-item）。
2. 着手が決まったら Spec を作成する（new-spec）。人が requirements、design、tasks を承認する。
3. AIが Task を順に実装する（implement-task）。Task ごとに検証コマンドを実行し、tasks.md と progress.md を更新して、コミットする。
4. 機械検証（ビルド、テスト、lint、check-docs）が通ったら、**別のコンテキスト**でAIレビューを行う（self-review）。
5. 人が Finding を選別する（open を accepted か wontfix にする）。
6. AIが accepted の Finding に対応する（apply-review）。
7. 人が成果物をレビューし、指摘をプロンプトで入力する。AIはそれを Review ファイルに記録して対応する（apply-review）。
8. 人が対応結果を確認する。
9. AIが PR／MR の本文を作成する（pr-draft）。PR／MR の作成操作は人が行う。
10. 上位責任者が PR／MR をレビューする。ここからは人同士がPR／MRのコメントでやり取りする。設計の変更につながる指摘は、design.md や ADR に反映する。
11. マージの前に完了処理を行う（close-item）。

スキルは、AIツールのチャットでスキル名を指定するか、やりたいことを伝えると使われます（例：「new-item スキルで、ログイン画面の改修を起票して」）。

## DoD（Definition of Done）

- tasks.md の全 Task にチェックが入っている（マスタードキュメント反映と ADR 要否判断を含む）。
- 該当 Spec の `reviews/` 配下に、状態が open または accepted の Finding が残っていない。
- check-docs が成功する。
- Item の status が done になり、`backlog/archive/` に移動されている。

## 文書の書き方

### Item（`backlog/items/<ID>-<slug>.md`）

- `templates/item.md` から作る。slug は英小文字・数字・ハイフンのみ。
- status：`backlog` / `ready` / `in-progress` / `done` / `dropped`。priority：`high` / `medium` / `low`。
- 優先度は人が決める。
- status が done か dropped になったら `backlog/archive/` に移動する。
- Spec を作らない小規模な Item は、Item 内の「タスク」欄で作業を管理する。

### Spec（`specs/<ID>-<slug>/`）

- `templates/spec/` の requirements.md、design.md、tasks.md、progress.md から作る。
- design.md は「その Item による変更分」の設計。全体の最新設計（マスタードキュメント）は `docs/architecture/` にあり、Item 完了時に反映する。
- tasks.md の末尾には「マスタードキュメントへの反映」と「ADR の要否判断」の2つの固定 Task を必ず含める。

### Review（`specs/<ID>-<slug>/reviews/YYYY-MM-DD-<target>-<ai|human>.md`）

- `templates/review.md` から作る。同じ日に重複する場合は末尾に `-2` などを付ける。
- 重大度は High / Medium / Low。
- 状態：

| 状態 | 意味 | 変更するのは |
|---|---|---|
| `open` | 未判定 | （AIレビューの起票時の状態） |
| `accepted` | 対応すると判定した | 人（人のレビュー指摘をAIが記録する場合は accepted で起票） |
| `wontfix` | 対応しないと判定した。対応欄に理由が必須 | 人 |
| `fixed` | 対応済み。対応欄に内容とコミットIDを記載 | AI または人 |

### Discussion（`discussions/YYYY-MM-DD-<slug>.md`）

- `templates/discussion.md` から作る。作成後は更新しない履歴として扱う。

### ADR（`docs/adr/NNNN-<slug>.md`）

- `templates/adr.md` から作る（Nygard 形式：Status / Context / Decision / Consequences）。
- 承認後は書き換えない。決定を変える場合は新しい ADR を作り、旧 ADR の Status を `Superseded by NNNN` にする。

## ツール

| コマンド | 内容 |
|---|---|
| `bash tools/ai-standard/backlog-index.sh` | `backlog/` から `BACKLOG.md` を再生成する |
| `bash tools/ai-standard/check-docs.sh` | 文書の整合性を検査する（違反があれば終了コード1） |

Windows では `powershell -ExecutionPolicy Bypass -File tools/ai-standard/backlog-index.ps1` のように `.ps1` 版を使います。

check-docs の検査項目：

1. `.claude/skills/` と `.agents/skills/` の管理対象スキルが一致している。
2. Item の frontmatter に必須項目がそろい、status・priority が許可された値で、ID が重複していない。
3. `BACKLOG.md` が最新である。
4. status が done の Item について、tasks（Spec がなければ Item 内のタスク）が全てチェック済みで、reviews に open / accepted の Finding が残っていない。
5. `AGENTS.md` にプレースホルダ（`{{...}}`）が残っていない。
6. 状態が wontfix の Finding の対応欄が空でない。

## CI

check-docs を CI で実行します。チェックのロジックは check-docs.sh にあり、CI 定義はそれを呼ぶだけです。

### GitLab

`ci/ai-standard.gitlab-ci.yml` にジョブ `ai-standard:check-docs`（stage: `test`）が定義されています。既存の `.gitlab-ci.yml` に次を追加して取り込んでください。

```yaml
include:
  - local: ci/ai-standard.gitlab-ci.yml
```

`.gitlab-ci.yml` がまだない場合は、上記の3行だけのファイルを作成します。`stages` を独自に定義している場合は `test` を含めてください。

MR テンプレートは `.gitlab/merge_request_templates/AI-Standard.md` です。MR 作成画面のテンプレート選択で「AI-Standard」を選びます。

### GitHub

`.github/workflows/ai-standard.yml` が push と pull request で check-docs を実行します。追加の設定は不要です。PR テンプレートは `.github/pull_request_template.md` です。

## ai-dev-standard の更新

標準管理対象のファイル（`tools/ai-standard/manifest.txt` に列挙）は、ai-dev-standard 側の sync で更新します。プロジェクトでは直接編集しないでください。

```
<ai-dev-standard のパス>/sync.sh <このプロジェクトのパス>
```

適用中のバージョンは `.ai-standard-version` に記録されています。
