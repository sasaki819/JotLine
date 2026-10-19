# 運用ガイド：ai-dev-standard を導入したプロジェクトの進め方

この文書は、ai-dev-standard を導入したプロジェクトで、人とAIがどのように開発を進めるかを説明するチュートリアルです。アイデアを Backlog に出し切り、優先順位を決め、複数の Item を並列で実装して完了させるまでの一連の流れを、そのまま使えるプロンプト例とともに示します。

- この文書は、ai-dev-standard の導入（初期化）が済んでいることを前提にしています。
- ルールの正式な定義は、プロジェクトの [AGENTS.md](../AGENTS.md) と [docs/ai-dev-standard-process.md](ai-dev-standard-process.md) にあります。この文書はその使い方の解説です。

> この文書は ai-dev-standard の管理対象です。直接編集せず、ai-dev-standard 側を更新して sync してください。

---

## 目次

1. [全体像](#1-全体像)
2. [基本操作](#2-基本操作)
3. [ステップ1：アイデアを出し切る（Discussion）](#3-ステップ1アイデアを出し切るdiscussion)
4. [ステップ2：Backlog に起票する（new-item）](#4-ステップ2backlog-に起票するnew-item)
5. [ステップ3：優先順位を決める](#5-ステップ3優先順位を決める)
6. [ステップ4：着手する Item の Spec を作る（new-spec）](#6-ステップ4着手する-item-の-spec-を作るnew-spec)
7. [ステップ5：並列で作業する準備（git worktree）](#7-ステップ5並列で作業する準備git-worktree)
8. [ステップ6：Task を実装する（implement-task）](#8-ステップ6task-を実装するimplement-task)
9. [ステップ7：AIレビューと Finding の選別（self-review / apply-review）](#9-ステップ7aiレビューと-finding-の選別self-review--apply-review)
10. [ステップ8：人のレビュー（apply-review）](#10-ステップ8人のレビューapply-review)
11. [ステップ9：PR／MR を作る（pr-draft）](#11-ステップ9prmr-を作るpr-draft)
12. [ステップ10：完了処理とマージ（close-item）](#12-ステップ10完了処理とマージclose-item)
13. [並列運用のルールと注意点](#13-並列運用のルールと注意点)
14. [よくある場面](#14-よくある場面)
15. [プロンプト早見表](#15-プロンプト早見表)

---

## 1. 全体像

### 流れ

```
 アイデア出し      起票          優先順位       Spec作成        実装（並列）       レビュー            PR／MR        完了
 Discussion ──▶ new-item ──▶ 人が決める ──▶ new-spec ──▶ implement-task ──▶ self-review ──▶ pr-draft ──▶ close-item
  （任意）     （まとめて）                 （人が承認）   （Itemごとに      apply-review                    → マージ
                                                          worktreeで並列）  （人が選別）
```

### 人とAIの役割

| 判断・作業 | 担当 |
|---|---|
| アイデアを出す、議論する | 人（AIは壁打ち相手） |
| Item を起票する | AI（人の指示で） |
| **優先順位を決める** | **人**（AIは判断材料を出すだけ） |
| requirements・design・tasks を書く | AI |
| requirements・design・tasks を**承認する** | **人** |
| Task を実装・検証・コミットする | AI |
| AIレビューを行う | AI（実装とは別のセッション） |
| Finding を **accepted / wontfix に選別する** | **人** |
| Finding に対応する | AI |
| PR／MR の本文を書く | AI |
| PR／MR を作成・レビュー・マージする | 人 |

AIは優先順位を決めず、Finding の採否も判定しません（`AGENTS.md` の行動規則）。この2点は必ず人が判断します。

### 主なファイル

| パス | 内容 | 誰が書くか |
|---|---|---|
| `backlog/items/<ID>-<slug>.md` | 未完了の Item | AI（new-item）、人（priority など） |
| `backlog/archive/` | done / dropped の Item | AI（close-item） |
| `BACKLOG.md` | Item の一覧（自動生成） | backlog-index のみ。**手で編集しない** |
| `specs/<ID>-<slug>/` | requirements / design / tasks / progress / reviews | AI |
| `discussions/YYYY-MM-DD-<slug>.md` | 議論の記録 | AI（人の指示で） |
| `docs/architecture/` | 全体の最新設計（正本） | AI（Item 完了時に反映） |
| `docs/adr/` | 重要な設計判断の記録 | AI（必要なとき） |

---

## 2. 基本操作

### スキルの呼び出し方

スキルは、スキル名を指定するか、やりたいことを自然な言葉で伝えると使われます。この文書のプロンプト例は、どのツールでもそのまま使えるように「〜スキルで」と書いています。

| ツール | 呼び出し方の例 |
|---|---|
| Claude Code | `/new-item ログイン画面の改修` または「new-item スキルで、ログイン画面の改修を起票して」 |
| GitHub Copilot（VS Code） | チャットを Agent モードにして `/new-item ...` または自然な言葉で |
| Google Antigravity | 「new-item スキルで、〜を起票して」のように自然な言葉で |

### スクリプト

| やること | Linux / macOS | Windows |
|---|---|---|
| BACKLOG.md の再生成 | `bash tools/ai-standard/backlog-index.sh` | `powershell -ExecutionPolicy Bypass -File tools\ai-standard\backlog-index.ps1` |
| 文書の整合性チェック | `bash tools/ai-standard/check-docs.sh` | `powershell -ExecutionPolicy Bypass -File tools\ai-standard\check-docs.ps1` |

スキルの中でAIが自動で実行するので、人が手で実行するのは主に、Item を手で編集した後とマージの後です。

### セッションの使い分け

AIの会話（セッション）は、**1つの作業に1セッション**を基本にします。

- 起票や優先順位付けなど Backlog 全体を見る作業は、main ブランチの「管理用セッション」で行う。
- 実装は、Item ごとの worktree で「実装用セッション」を開いて行う。
- AIレビューは、実装用とは**別の新しいセッション**で行う。

長くなったセッションは閉じて構いません。作業の続きは progress.md の「中断点」から再開できます。

---

## 3. ステップ1：アイデアを出し切る（Discussion）

最初に、やりたいことを思いつく限り出します。この段階では整理や優先順位を気にせず、量を出すことを優先します。

### 3.1 AIと壁打ちする

main ブランチの管理用セッションで、次のように始めます。

```
これからこのプロジェクトで取り組みたいことを洗い出したい。
私が思いつくものを順に挙げるので、それぞれについて、関連して検討すべきこと、
抜けていそうな観点（運用、セキュリティ、テスト、ドキュメントなど）を質問・提案して。
まだ起票はしないこと。

最初の案：
- ログイン画面がスマホで崩れる
- 勤怠データを CSV で出したい
- 検索が遅い
- ダークモードに対応したい
```

既存のコードから課題を拾うこともできます。

```
コード中の TODO / FIXME コメント、README の未対応事項、テストがない主要機能を洗い出して一覧にして。
コードは変更しないこと。起票もまだしないこと。
```

### 3.2 議論の経緯を Discussion に残す

議論の内容（出た案、採用しなかった案とその理由）を後から追えるように、Discussion として記録します。

```
templates/discussion.md を使って、今の議論を discussions/2026-10-20-initial-backlog.md に記録して。
participants は [佐藤, AI]。「決定事項」には、起票することにした項目の候補を列挙して。
```

> Discussion は作成後に更新しない履歴として扱います。議論が続いたら、別の日付で新しい Discussion を作ります。

---

## 4. ステップ2：Backlog に起票する（new-item）

洗い出した項目を Item として起票します。**起票は main ブランチで行ってください**（理由は「[13. 並列運用のルールと注意点](#13-並列運用のルールと注意点)」）。

### 4.1 まとめて起票する

```
new-item スキルで、次の項目をそれぞれ1件の Item として起票して。
関連 Discussion は discussions/2026-10-20-initial-backlog.md。
priority はまだ決めないので、すべて既定値（medium）のままでよい。
概要と受入基準は Discussion の内容から書き、不明な点はまとめて質問して。

1. ログイン画面のレスポンシブ対応
2. 勤怠データの CSV エクスポート
3. 社員検索の高速化
4. ダークモード対応
5. README のセットアップ手順の誤りを修正（小規模。Spec は作らない）
```

AIは ID を `0001` から順に採番し、`backlog/items/` に Item を作って `BACKLOG.md` を再生成します。

### 4.2 1件ずつ起票する

作業中に思いついたものは、その都度起票します。

```
new-item スキルで起票して：
「勤怠の締め処理で、月末が土日の場合に前営業日扱いにならない」不具合。
受入基準は、月末が土日・祝日のときに前営業日で締められること。
```

### 4.3 起票内容を確認する

`BACKLOG.md` を開くと一覧が見られます。

```
| ID | タイトル | status | priority | owner | Spec |
|----|----------|--------|----------|-------|------|
| [0001](backlog/items/0001-login-responsive.md) | ログイン画面のレスポンシブ対応 | backlog | medium |  |  |
| [0002](backlog/items/0002-csv-export.md) | 勤怠データの CSV エクスポート | backlog | medium |  |  |
...
```

起票が一段落したらコミットします。

```
起票した Item と BACKLOG.md、Discussion をコミットして。メッセージは「Backlog: 初期 Item を起票」。
```

---

## 5. ステップ3：優先順位を決める

**優先順位は人が決めます。** AIには判断材料を出してもらいます。

### 5.1 判断材料を出してもらう

```
BACKLOG.md と backlog/items/ の各 Item を読んで、優先度を決めるための判断材料を表にして。
列は「ID、タイトル、規模感（S/M/L）、依存する Item、影響を受ける主なコード領域、リスク・不確実性」。
優先度そのものは決めないこと。
並列で進めても衝突しにくい組み合わせ（触るコード領域が重ならないもの）も挙げて。
```

> AGENTS.md には「作業の開始時には Backlog 全体をコンテキストに読み込まない」という規則があります。これは実装を始めるときの規則です。優先順位付けのような Backlog 全体を見る作業は、管理用セッションで明示的に頼んで行います。

### 5.2 priority を決めて反映する

表を見て人が決め、AIに反映させます。

```
priority を次のとおりに更新して、backlog-index を実行して。
- 0002 high（月末の締めに必要）
- 0006 high（不具合）
- 0001 medium
- 0003 medium
- 0004 low
- 0005 low
```

`BACKLOG.md` は status 順（in-progress → ready → backlog）、次に priority 順（high → medium → low）に並びます。

### 5.3 着手する Item と並列数を決める

一度に並列で進める Item は、**2〜3件程度**から始めるのがおすすめです。判断の観点は次のとおりです。

- **依存関係がない**こと（A の成果を B が使う場合、B は A の完了後にする）。
- **触るコード領域が重ならない**こと（同じファイルを並列で変えるとマージで衝突する）。
- **人のレビューが追いつく**数であること（並列数の上限は、AIではなく人のレビュー時間で決まる）。

例：0002（CSV エクスポート、バックエンド）、0006（締め処理の不具合、バッチ）、0005（README、小規模）の3件を並列にする。

---

## 6. ステップ4：着手する Item の Spec を作る（new-spec）

着手する Item ごとに Spec を作ります。Spec の作成も**main ブランチの管理用セッション**で、1件ずつ行うと管理しやすくなります（Spec を作った時点で Item の status が ready になり、BACKLOG.md が更新されるため）。

### 6.1 Spec を作る

```
new-spec スキルで、Item 0002 の Spec を作って。
```

AIは次の順に進め、**段階ごとに承認を求めて**きます。

1. **requirements.md**：背景、目的、スコープ、スコープ外、受入基準。
   - 受入基準が検証可能な書き方になっているか確認してください（例：「CSV に社員番号・日付・出退勤時刻が含まれ、Excel で文字化けせずに開ける」）。
2. **design.md**：変更の概要、影響範囲、インタフェース、データモデル、エラー処理、テスト方針、代替案。
3. **tasks.md**：1セッションで終わる粒度の Task。各 Task に完了条件と検証コマンドが付きます。

承認するとき・直してほしいときの返し方の例です。

```
requirements は承認。design に進んで。
```

```
design の修正をお願い：
- エクスポートは非同期ジョブではなく同期処理でよい（件数は最大1万行）
- 文字コードは UTF-8 BOM 付きにする（Excel 対策）
修正したら再提示して。
```

```
tasks は承認。Task 2 と Task 3 は独立しているので、(after: ...) を付けなくてよい。
```

### 6.2 Spec をコミットする

```
specs/0002-csv-export/ と、更新した Item・BACKLOG.md をコミットして。
メッセージは「[0002] Spec を作成」。
```

並列で進める他の Item（例：0006）も同じように Spec を作ります。小規模な Item（例：0005）は Spec を作らなくて構いません。

---

## 7. ステップ5：並列で作業する準備（git worktree）

並列作業には **git worktree** を使います。Item ごとに別のフォルダ・別のブランチで作業できるので、AIのセッション同士が互いの変更に干渉しません。

### 7.1 Item ごとに worktree を作る

main ブランチ（Spec をコミットした状態）で実行します。

```bash
git worktree add ../myapp-0002 -b item/0002-csv-export
git worktree add ../myapp-0006 -b item/0006-closing-holiday
git worktree add ../myapp-0005 -b item/0005-readme-setup
```

```
myapp/          ← main（管理用セッション）
myapp-0002/     ← item/0002-csv-export（実装用セッション A）
myapp-0006/     ← item/0006-closing-holiday（実装用セッション B）
myapp-0005/     ← item/0005-readme-setup（実装用セッション C）
```

### 7.2 worktree ごとにAIのセッションを開く

| ツール | 開き方 |
|---|---|
| Claude Code | ターミナルを Item ごとに開き、各フォルダで `claude` を起動する |
| VS Code（Copilot） | 各フォルダを別ウィンドウで開く（「ファイル → 新しいウィンドウ」→ フォルダを開く） |
| Antigravity | 各フォルダを別のワークスペースとして開く |

> 依存パッケージ（`node_modules` など）は worktree ごとに必要です。各フォルダで、AGENTS.md に書いたビルドコマンドなどを一度実行してください。

### 7.3 worktree の後片付け

Item のマージ後に削除します。

```bash
git worktree remove ../myapp-0002
git branch -d item/0002-csv-export
```

---

## 8. ステップ6：Task を実装する（implement-task）

各 worktree の実装用セッションで、Task を1つずつ進めます。

### 8.1 Task を1つ実装する

```
implement-task スキルで、Item 0002 の次の Task を実装して。
```

AIは次のように動きます。

1. Spec 配下（requirements / design / tasks / progress）だけを読む。
2. 未完了で依存が解消済みの、先頭の Task を1つ選ぶ。
3. Item の status を in-progress にする（最初の Task のとき）。
4. 実装し、Task の検証コマンドを実行する。**成功したときだけ**チェックを入れる。
5. progress.md に作業ログ・判断・中断点を書く。
6. `[0002] Task 1: ...` の形式でコミットする。
7. 次の Task 名を示して止まる（勝手に続けない）。

結果を確認したら、次を指示します。

```
OK。次の Task に進んで。
```

### 8.2 中断と再開

セッションを閉じても、progress.md の「中断点」から再開できます。

```
implement-task スキルで Item 0002 の作業を再開して。progress.md の中断点から続けること。
```

### 8.3 検証が通らないとき

AIは、検証コマンドが失敗した Task にはチェックを入れず、状況を報告して止まります。

```
失敗の原因の候補を3つ挙げて、それぞれの確認方法を示して。修正はまだしないこと。
```

design と異なる実装が必要になった場合も、AIは実装を進める前に確認を求めてきます。design.md を直すかどうかは人が決めます。

```
design.md を修正してよい。変更理由を progress.md の「判断とその理由」に書いてから実装を続けて。
```

### 8.4 作業中に別の課題を見つけたとき

AIは見つけた課題をその場では直さず、起票を提案してきます。**起票は main の管理用セッションで**行います（worktree で起票すると ID が衝突しやすいため）。

```
（main の管理用セッションで）
new-item スキルで起票して：「社員一覧 API がページングなしで全件を返している」。
発見元は Item 0002 の作業中。
```

### 8.5 固定 Task（正本反映・ADR）

tasks.md の末尾には、次の2つの固定 Task があります。

- **正本ドキュメント（docs/architecture/）へ design の内容を反映**：design.md の内容を、全体の最新設計に取り込みます。
- **ADR の要否判断（必要なら作成）**：後から「なぜこうしたのか」を説明する必要がある判断（ライブラリの選定、データ形式の決定など）があれば、ADR を作ります。

この2つも implement-task で順に処理されます。反映先や ADR の内容は、人が確認してください。

### 8.6 小規模な Item（Spec なし）

Spec を作らない Item（例：0005）は、Item ファイルの「タスク」欄で管理します。implement-task は Spec を前提にしているので、次のように直接指示します。

```
Item 0005 は Spec のない小規模な Item。backlog/items/0005-readme-setup.md のタスク欄に従って修正し、
完了したタスクにチェックを入れてコミットして。正本ドキュメントへの反映が不要なら、理由をタスクに書いてチェックすること。
```

---

## 9. ステップ7：AIレビューと Finding の選別（self-review / apply-review）

全 Task の実装が終わり、ビルド・テスト・lint・check-docs が通ったら、AIレビューを行います。

### 9.1 別のセッションでAIレビューする

実装したセッションとは**別の新しいセッション**を、同じ worktree で開きます。

```
self-review スキルで、specs/0002-csv-export/ の実装をレビューして。対象は impl。
```

> 実装の経緯を知らないAIに、文書と成果物だけを根拠にレビューさせるためです。サブエージェントが使えるツールでは、スキルがサブエージェントを使うこともあります。

AIは `specs/0002-csv-export/reviews/2026-10-22-impl-ai.md` を作り、指摘（Finding）を表にします。この時点では、すべて `open` です。

```
| ID | 重大度 | 指摘 | 状態 | 対応 |
|----|--------|------|------|------|
| R1 | High   | CSV の値にカンマが含まれるとき引用符で囲んでいない（src/export/csv.ts:42） | open |  |
| R2 | Medium | 1万行を超えた場合のエラーがテストされていない | open |  |
| R3 | Low    | 関数名 toCsvRow が他の命名規則と異なる | open |  |
```

### 9.2 人が Finding を選別する

Review ファイルを開き、`open` を `accepted`（対応する）か `wontfix`（対応しない）に変えます。**wontfix には対応欄に理由が必須**です（空だと check-docs がエラーになります）。

ファイルを直接編集してもよいですし、判断をAIに伝えて書き換えさせても構いません。

```
specs/0002-csv-export/reviews/2026-10-22-impl-ai.md の Finding を次のとおり更新して。
- R1：accepted
- R2：accepted
- R3：wontfix（理由：既存コードの命名に合わせているため。命名の統一は別 Item で扱う）
```

### 9.3 accepted の Finding に対応する

```
apply-review スキルで、specs/0002-csv-export/ の accepted の Finding に対応して。
```

AIは Finding ごとに修正・検証・コミットを行い、状態を `fixed` にして、対応欄に内容とコミットIDを書きます。`open` の Finding には手を付けません。

---

## 10. ステップ8：人のレビュー（apply-review）

人が成果物（動作、コード、文書）を確認します。気づいた点は、そのままプロンプトで伝えます。

```
apply-review スキルで、次の指摘を記録して対応して。レビュアーは佐藤。
- High：エクスポートボタンが一般ユーザーにも表示されている。管理者だけに表示すること
- Low：ダウンロードファイル名に日付を含めてほしい（例：attendance_2026-10.csv）
```

AIは `reviews/2026-10-22-impl-human.md` を作り、指摘を `accepted` で記録してから対応します。対応後に結果を確認し、問題がなければ次に進みます。

---

## 11. ステップ9：PR／MR を作る（pr-draft）

```
pr-draft スキルで、Item 0002 の PR の本文を作って。
```

AIは PR／MR テンプレートの各項目（関連 Item / Spec、変更概要、設計上の判断、レビュー経緯、チェックリスト）を埋めた本文を出力します。**PR／MR の作成は人が行います。**

```bash
git push -u origin item/0002-csv-export
# GitHub / GitLab の画面で PR／MR を作成し、AIが出力した本文を貼り付ける
# （GitLab ではテンプレート「AI-Standard」を選ぶと項目の枠が入る）
```

上位責任者（レビュアー）のレビューは、PR／MR のコメントで人同士がやり取りします。設計の変更につながる指摘があれば、AIに反映させます。

```
PR のレビューで「CSV の列順を給与システムの取り込み形式に合わせる」ことになった。
design.md を更新し、実装を修正して。変更理由は progress.md に書くこと。
```

---

## 12. ステップ10：完了処理とマージ（close-item）

PR／MR が承認されたら、**マージの前に**完了処理を行います。

```
close-item スキルで、Item 0002 の完了処理をして。
```

AIは DoD を確認します。

- tasks.md の全 Task にチェックが入っている（正本反映と ADR の要否判断を含む）。
- reviews に `open` / `accepted` の Finding が残っていない。
- check-docs が成功する。

満たさない項目があれば、一覧を示して止まります。すべて満たしていれば、Item の status を `done` にして `backlog/archive/` に移動し、`BACKLOG.md` を再生成します。

```
完了処理の変更をコミットして push して。メッセージは「[0002] 完了処理」。
```

CI（check-docs）が通ったら、PR／MR をマージします。最後に、main の管理用セッションで BACKLOG.md を確認します。

```bash
git switch main && git pull
bash tools/ai-standard/backlog-index.sh && bash tools/ai-standard/check-docs.sh
```

`BACKLOG.md` に差分が出たら（並列でマージした場合に起こります）、コミットしてください。

---

## 13. 並列運用のルールと注意点

### ルール1：起票と Spec 作成は main で、1件ずつ

ID は「既存の最大 ID + 1」で採番されます。別々のブランチで同時に起票すると、同じ ID が二重に使われます。

- 起票（new-item）は **main の管理用セッション**で行い、すぐにコミットする。
- 実装用の worktree では起票しない。課題を見つけたら、main で起票する。

もし ID が衝突しても、マージ後の check-docs が検出します。

```
ERROR [items] duplicate id 0007: backlog/items/0007-paging.md, backlog/items/0007-timezone.md
```

この場合は、後から作った方の ID を振り直します。

```
backlog/items/0007-timezone.md の ID が重複している。未使用の最大 ID + 1 に振り直して
（ファイル名、frontmatter の id、Spec のディレクトリ名と Item の spec 欄も合わせて変更）、backlog-index を実行して。
```

### ルール2：BACKLOG.md の衝突は再生成で解決する

`BACKLOG.md` は各ブランチで再生成されるため、マージで衝突しやすいファイルです。衝突したら、**中身を手で直さず**再生成します。

```bash
git checkout --theirs BACKLOG.md     # どちらでもよい
bash tools/ai-standard/backlog-index.sh
git add BACKLOG.md
```

### ルール3：1つの Item は1つの worktree で

1つの Item の中の Task を、複数のセッションで同時に実装しないでください。tasks.md と progress.md を同時に書き換えて衝突します。並列にする単位は **Item** です。

### ルール4：並列数は人のレビュー能力に合わせる

AIは何本でも並列に動かせますが、Spec の承認、Finding の選別、人のレビューは人が行います。レビュー待ちが溜まってきたら、新しい Item に着手せず、レビューを先に進めてください。

### ルール5：正本ドキュメントの衝突に注意する

複数の Item が同じ `docs/architecture/` の文書を更新すると、マージで衝突します。後からマージする側で、両方の内容を統合してください。

```
main をマージしたら docs/architecture/overview.md が衝突した。
両方の Item の変更内容を統合して衝突を解消し、check-docs を実行して。
```

---

## 14. よくある場面

### Item をやめる

```
Item 0004 は中止する。status を dropped にして backlog/archive/ に移動し、
メモ欄に中止の理由「デザイン刷新の Item に統合するため」を書いて、backlog-index を実行して。
```

### 優先順位を見直す

```
0003 の priority を high に、0001 を low に変更して、backlog-index を実行して。
```

### Spec を作った後で要件が変わった

```
Item 0006 の要件が変わった：祝日判定は会社カレンダー（calendar テーブル）を使う。
requirements.md と design.md を更新して再提示して。承認後に tasks.md も見直すこと。
完了済みの Task への影響があれば列挙して。
```

### Item を分割したい

```
Item 0001 は大きすぎるので分割したい。分割案を3つ程度示して。
私が選んだ案に従って new-item スキルで新しい Item を起票し、0001 の概要・受入基準を縮小して。
```

### 重要な設計判断を記録したい

```
CSV の文字コードを UTF-8 BOM 付きにした判断を ADR に残して。
templates/adr.md を使い、docs/adr/ の既存の最大番号 + 1 で作成すること。
```

### check-docs がエラーになった

```
check-docs のエラーを読んで、それぞれの原因と直し方を説明して。
BACKLOG.md の手編集や、スキルファイルの直接編集で直そうとしないこと。
```

主なエラーと対処は次のとおりです。

| エラー | 対処 |
|---|---|
| `[backlog] BACKLOG.md is out of date` | backlog-index を実行する |
| `[items] duplicate id` | ID を振り直す（[13. ルール1](#ルール1起票と-spec-作成は-main-で1件ずつ)） |
| `[items] invalid status / priority` | 許可された値に直す（status：backlog / ready / in-progress / done / dropped、priority：high / medium / low） |
| `[done] unchecked task` | done の Item に未完了の Task がある。Task を完了させるか、status を戻す |
| `[done] finding ... is 'open'` | Finding を選別・対応する |
| `[reviews] ... 'wontfix' but the response (reason) is empty` | wontfix の対応欄に理由を書く |
| `[skills] ... differs` | スキルが直接編集されている。ai-dev-standard の sync で戻す |
| `[agents] placeholder ... remains` | AGENTS.md のプレースホルダを埋める |

### ai-dev-standard が更新された

```bash
bash <ai-dev-standard のパス>/sync.sh . --dry-run
bash <ai-dev-standard のパス>/sync.sh .
bash tools/ai-standard/backlog-index.sh && bash tools/ai-standard/check-docs.sh
```

sync は main で行い、各 worktree には main をマージして取り込みます。

---

## 15. プロンプト早見表

| 場面 | プロンプト例 | 場所 |
|---|---|---|
| アイデア出し | 「取り組みたいことを洗い出したい。抜けている観点を質問・提案して。まだ起票しないこと」 | main |
| 議論の記録 | 「templates/discussion.md を使って、今の議論を discussions/YYYY-MM-DD-<slug>.md に記録して」 | main |
| まとめて起票 | 「new-item スキルで、次の項目をそれぞれ Item として起票して：…」 | main |
| 優先度の判断材料 | 「各 Item の規模感・依存関係・影響範囲を表にして。優先度は決めないこと」 | main |
| 優先度の反映 | 「priority を次のとおり更新して、backlog-index を実行して：…」 | main |
| Spec 作成 | 「new-spec スキルで、Item NNNN の Spec を作って」 | main |
| 実装 | 「implement-task スキルで、Item NNNN の次の Task を実装して」 | worktree |
| 再開 | 「implement-task スキルで Item NNNN を再開して。progress.md の中断点から続けること」 | worktree |
| AIレビュー | 「self-review スキルで、specs/NNNN-<slug>/ の実装をレビューして」 | worktree（新しいセッション） |
| Finding の選別 | 「R1 は accepted、R2 は wontfix（理由：…）に更新して」 | worktree |
| 指摘への対応 | 「apply-review スキルで、accepted の Finding に対応して」 | worktree |
| 人の指摘の記録 | 「apply-review スキルで、次の指摘を記録して対応して。レビュアーは〇〇：…」 | worktree |
| PR／MR 本文 | 「pr-draft スキルで、Item NNNN の PR の本文を作って」 | worktree |
| 完了処理 | 「close-item スキルで、Item NNNN の完了処理をして」 | worktree（マージ前） |
