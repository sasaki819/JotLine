---
id: 002-progress
title: 作業ログ・判断履歴（旧 Spec 0005 progress.md）
created: 2026-10-21 12:49:33
updated: 2026-10-22 02:17:40
---
# 作業ログ・判断履歴（旧 Spec 0005 progress.md）

## 概要

旧 `specs/0005-ci-build-and-release/progress.md` の作業ログおよび判断履歴を AIco チケットノートとして移行保存したもの。

<!-- 日付ごとに追記する。新しい日付を下に足す。 -->

## 2026-10-22

### 作業ログ

- Spec を作成した（requirements → design → tasks の順に、それぞれユーザーの承認を得た）。

### 判断とその理由

- **前提**: GitLab は自前のサーバーで、Runner はユーザーがセットアップ済み（docker executor、タグなしのジョブも実行）。イメージを指定しないと Runner の既定のイメージ（プレーンな Alpine）で動き Node.js がないため、テスト・lint・ビルドは Node.js のイメージを明示的に指定する（ユーザーの指示）。
- **パイプラインを動かす対象**: MR・`main` ブランチ・タグだけ（ユーザーの選択）。MR のない `item/*` ブランチへの push では動かさず、パイプラインの二重実行も避ける。
- **リリースの添付ファイルの保存先**: Generic Package Registry（ユーザーの選択）。ジョブのアーティファクトは保存期間や一括削除で消えうるため。
- **バージョンの不一致**: タグと `manifest.json`・`package.json` の `version` が一致しなければリリースを失敗させる（ユーザーの選択）。
- **リリースノート**: `CHANGELOG.md` を整備して使う（ユーザーの選択）。英語で書き（ユーザーの選択。README と同じく利用者が読むため）、タグのバージョンの節がなければリリースを失敗させる（ユーザーの選択）。
- **初回のリリース**: 1.0.0（ユーザーの選択。これまでリリースした版がないため、現在の内容を 1.0.0 とする）。
- **README**: 基本は Releases から取得、既存の「ソースからビルドして配置する」手順も残す（ユーザーの指示）。
- **補った点**（requirements で承認済み）: アーティファクトの保存期間は30日。リリースは `vX.Y.Z` 形式のタグだけで行い、それ以外のタグは検証とビルドのみ。
- **実装方式**（design）: リリースの処理は Node.js のスクリプト（`scripts/release.mjs`、純粋関数は `scripts/release-lib.mjs`）にまとめ、GitLab の API は `CI_JOB_TOKEN` で呼ぶ。`release-cli` のイメージを使わないのは、自前のサーバー・Runner の環境で別のイメージを取得できるかや、GitLab のバージョンによる違いに依存しないため。照合の処理は単体テストでき、`check` は手元でも実行できる。
- **tasks の構成**: GitLab 上での確認（Task 4・5）は人が行う。Task 5 で `v1.0.0` のタグを item ブランチで打った後の扱い（正式リリースとして残すか、削除してマージ後に改めてリリースするか）は、その時点でユーザーが決める。

### 中断点（次に何をすべきか）

- 着手前に、ユーザーに次を確認できるとよい（design の「実装時に確認すること」）: 自前の GitLab で Generic Package Registry が有効か、プロジェクトの公開範囲。
- implement-task で Task 1（CHANGELOG.md とリリースのスクリプト）から着手する。

### 作業ログ（着手前の確認）

- ユーザーに確認した（design の「実装時に確認すること」の一部。ユーザーの報告による）。
  - 自前の GitLab で、プロジェクトの「デプロイ → パッケージレジストリ」が表示される（Generic Package Registry が使える）。
  - プロジェクトは公開。リリースのページと添付ファイルはログインなしでダウンロードできる前提で README を書ける。

### 作業ログ（Task 1）

- ブランチ `item/0005-ci-build-and-release` を main から作成し、Item の status を in-progress にした。
- `CHANGELOG.md`（英語）を作成した。Keep a Changelog の形式で、1.0.0 の節に README の Features をもとに主な機能をまとめた。日付は仮に 2026-10-22 とした（実際にタグを打つ日に更新する）。
- `scripts/release-lib.mjs` を作成した: `parseVersionTag`、`checkVersions`、`extractChangelogSection`、`buildPackageFileUrl`（design のインタフェースどおり）に加え、`check` と `publish` で共通に使う `validateRelease`（タグの形式・version の一致・CHANGELOG の節をまとめて確かめる）と、定数 `PACKAGE_NAME`・`RELEASE_FILES` を追加した。
- `scripts/release.mjs` を作成した: `check <tag>`（手元でも実行可）と `publish <tag>`（CI 専用。Package Registry へのアップロードと Releases API でのリリース作成。`JOB-TOKEN` ヘッダー、Node.js 組み込みの `fetch`）。CI の変数が足りない場合・ビルド結果がない場合は何もせず失敗する。
- `scripts/release-lib.test.mjs` に単体テスト16件を追加した（design の「テスト方針」の項目と `validateRelease`、CRLF の CHANGELOG）。Vitest の既定の探索で `npm test` に含まれることを確認した。
- 検証:
  - `npm test`（7ファイル・86件成功）、`npx tsc --noEmit`（エラーなし）、`npm run build`（成功）。
  - `node scripts/release.mjs check v1.0.0` → 成功（終了コード0、1.0.0 の節を表示）。
  - `check v9.9.9` → 失敗（manifest.json・package.json の不一致、CHANGELOG の節なしの3件。終了コード1）。
  - `check 1.0.0` → 失敗（タグの形式違い。終了コード1）。
  - `publish v1.0.0`（手元）→ CI の変数がないため何もせず失敗（終了コード1）。

### 判断とその理由（Task 1）

- `validateRelease` を純粋関数として追加した（design のインタフェースへの追加）。`check` と `publish` で同じ確認を行うため、まとめて単体テストできる形にした。動作は design のとおりで、設計の変更ではない。
- 添付ファイルは文字列（UTF-8）として読み込んでアップロードする。`main.js`・`manifest.json` はいずれもテキストのため。

### 中断点（Task 1 終了時点）

- 次は Task 2「README.md のインストール手順とリリース手順を更新する」（Task 3 も Task 1 だけに依存するため着手可能）。

### 作業ログ（Task 2）

- `README.md` の Installation を書き直した。
  - 冒頭に、必要な Obsidian のバージョン（1.1.0 以降）と、必要な2ファイルを書いた。
  - Option A（推奨）: Releases ページからのダウンロード。版を指定した固定のダウンロード URL（`/-/releases/vX.Y.Z/downloads/main.js` など）と、CHANGELOG.md への案内を含めた。プロジェクトが公開のため、ログインの案内は書いていない。
  - Option B: 既存の「ソースからビルドする」手順をそのまま残した（見出しの番号付けだけ外した）。
  - 配置と有効化の手順（Where to Place the Files、Enabling in Obsidian）は、両方の方法に共通の手順として残した（番号付けを外した）。
- Development の節に、lint のコマンド（`npx tsc --noEmit`）と、GitLab CI で何が動くか（対象と、ビルド結果を30日間アーティファクトとして残すこと）を追記した。
- Releasing の節を追加した（version の更新、CHANGELOG の節の追加、`node scripts/release.mjs check` での事前確認、main へのマージ、タグの push。失敗する条件と、`vX.Y.Z` 以外のタグの扱い）。
- 検証: `check-docs`（OK）。

### 中断点（Task 2 終了時点）

- 次は Task 3「`.gitlab-ci.yml` を作る」。

### 作業ログ（Task 3）

- `.gitlab-ci.yml` を作成した（design の「`.gitlab-ci.yml`」のとおり）。
  - `include`: `ci/ai-standard.gitlab-ci.yml`（check-docs）。
  - `workflow:rules`: MR（`merge_request_event`）・既定ブランチ・タグのときだけ。それ以外は `when: never`。
  - `stages`: test・build・release。
  - `.node`: `node:24-bookworm-slim`、`package-lock.json` をキーにした `.npm/` のキャッシュ、`npm ci --cache .npm --prefer-offline`。
  - `.version-tag`: `$CI_COMMIT_TAG =~ /^v\d+\.\d+\.\d+$/` のときだけ動かすルール。
  - ジョブ: `test`（`npm test`）、`lint`（`npx tsc --noEmit`）、`release:check`（test ステージ、バージョンのタグのみ）、`build`（アーティファクト `main.js`・`manifest.json`、30日）、`release:publish`（release ステージ、バージョンのタグのみ）。
- 検証: YAML の構文確認（`python3` の `yaml.safe_load` で読み込めることを確認）、`npm test`（7ファイル・86件成功）、`npx tsc --noEmit`（エラーなし）、`npm run build`（成功）。GitLab 固有の書式（`rules`・`extends`・`cache` など）の検証は、Task 4 の GitLab 上のパイプライン（または CI Lint）で行う。

### 判断とその理由（Task 3）

- **リリースの2ジョブでは `npm ci` とキャッシュを使わない（design への補足）**: `release:check`・`release:publish` は `.node` を継承して同じ Node.js のイメージで動かすが、`scripts/release.mjs` は Node.js の組み込みモジュールだけを使うため、`before_script: []` と `cache: []` で依存パッケージのインストールを省いた。リリースの処理を速くし、npm の取得失敗の影響を受けないようにするため。動作の設計は変わらない。
- **バージョンのタグのルールを `.version-tag` に共通化**: `release:check` と `release:publish` で同じ条件を使うため、取り違えが起きないようにした。

### 中断点（Task 3 終了時点）

- 次は Task 4「GitLab 上でパイプラインを確認する」（人が確認する Task）。ブランチを push し、MR を作ってもらう。

### 作業ログ（Task 4）

- ブランチ `item/0005-ci-build-and-release`（Task 3 のコミット `2813a60` まで）を push し、ユーザーが MR を作成して GitLab 上で確認した（ユーザーの報告による）。
  - AC2: ブランチを push しただけでは（MR がない状態では）パイプラインは動かなかった。
  - AC1: MR を作るとパイプラインが動き、check-docs・test・lint・build の4ジョブがすべて成功し、パイプラインは成功（passed）になった。
  - AC3: test・lint・build のジョブのログで `node:24-bookworm-slim` が使われていた。ブランチのパイプラインと二重には動いていなかった。
  - AC4: build のジョブのアーティファクトを zip でダウンロードでき、中身は `main.js` と `manifest.json` だけだった。それらを検証用 Vault に配置してリロードし、正常に動作した。
- design の「実装時に確認すること」のうち、Runner が Docker Hub から `node:24-bookworm-slim` を取得できることも確認できた（ジョブがそのイメージで動いたため）。
- アーティファクトの保存期間（30日）について: ジョブの画面では「これらのアーティファクトは最新のものです。新しいアーティファクトが利用できるようになるまで（期限が切れていても）削除されません」と表示され、期限の日付そのものは表示されなかった。GitLab の API（ジョブの `artifacts_expire_at`）は認証が必要で、こちらからは読み取れなかった。`expire_in: 30 days` を含む設定でパイプラインが作られ build が成功したこと（書式が誤っていればパイプライン自体が作られない）と、上記の表示（期限付きのアーティファクトのうち最新のものに表示される）から、設定は有効と判断した（ユーザーも想定どおりと判断）。ブランチの最新のアーティファクトが期限後も残るのは、requirements に書いたとおりの GitLab の既定の動作。
- 手元の検証コマンドを再実行した: `npm test`（7ファイル・86件成功）、`npx tsc --noEmit`（エラーなし）、`npm run build`（成功）。修正はない。

### 中断点（Task 4 終了時点）

- 次は Task 5「GitLab 上でリリースを確認する」（人が確認する Task）。`v9.9.9`（不一致）・`ci-test-1`（形式違い）・`v1.0.0` のタグを item ブランチで push して確認する。`v1.0.0` の確認後の扱い（正式リリースとして残すか、削除してマージ後に改めてリリースするか）を決めてもらう。

### 作業ログ（Task 5）

- `v1.0.0` の確認後の扱いは (b)（確認用として削除し、マージ後に main で改めて `v1.0.0` をリリースする）とした（ユーザーの判断）。
- item ブランチの `f21bf01` に、順にタグを打って push し、GitLab 上で確認した。
  - AC6: `v9.9.9` → `release:check` が失敗し、パイプラインが失敗した（ユーザーの報告。ログに manifest.json・package.json のバージョン不一致と、CHANGELOG に 9.9.9 の節がないことの3件が表示された）。
  - AC7: `ci-test-1` → check-docs・test・lint・build だけが動いて成功し、リリース用のジョブは作られなかった（ユーザーの報告）。
  - 上記の2つでリリースもパッケージも作られていないことを、公開 API（`/projects/open%2Fjotline/releases`・`/packages`、どちらも認証なしで読める）で確認した（どちらも空）。確認後、2つのタグをリモートとローカルから削除した。
  - AC5: `v1.0.0` → パイプラインが成功した（ユーザーの報告）。公開 API と URL で次を確認した。
    - リリース: タグ `v1.0.0`、名前 `JotLine v1.0.0`、コミット `f21bf014`。説明文は `CHANGELOG.md` の 1.0.0 の節と完全に一致。
    - 添付: `main.js`・`manifest.json` の2件（`link_type: package`、リンク先は Package Registry）。
    - Package Registry: `jotline` / `1.0.0`（generic）。
    - 固定の URL（`/-/releases/v1.0.0/downloads/main.js`・`manifest.json`）から、ログインなしで HTTP 200 でダウンロードでき、`main.js` は手元のビルドとバイト単位で一致した。
- design の「実装時に確認すること」の残り（`CI_JOB_TOKEN` での Package Registry へのアップロードと Releases API でのリリースの作成）も、上記の成功で確認できた。
- 後片付け（(b) のとおり）: ユーザーが GitLab の画面でリリース v1.0.0 とパッケージ `jotline` 1.0.0 を削除し、公開 API で両方とも空になったことを確認したうえで、`v1.0.0` のタグをリモートとローカルから削除した。リモートにタグは残っていない。
- 手元の検証コマンドを再実行した: `npm test`（7ファイル・86件成功）、`npx tsc --noEmit`（エラーなし）、`npm run build`（成功）。修正はない。

### 判断とその理由（Task 5）

- リリースは、マージ後に main の上で改めて `v1.0.0` を打って作る。その時点で `CHANGELOG.md` の 1.0.0 の日付（現在は 2026-10-22）をリリースする日に合わせる必要があれば更新する（README の Releasing の手順のとおり）。この作業は Item 0005 の範囲外で、マージ後にユーザーの指示で行う。

### 中断点（Task 5 終了時点）

- 残りは固定 Task の2つ：「マスタードキュメント（docs/architecture/）へ design の内容を反映」と「ADR の要否判断（必要なら作成）」。

### 作業ログ（固定 Task：マスタードキュメントへの反映）

- 新しい文書 `docs/architecture/05.Build-and-Release.md` を作成した（概要、パイプライン（対象、ステージとジョブ）、リリース（流れ、リリース前チェック、公開、スクリプトの構成）、バージョンと変更履歴）。Task 3〜5 で確認した事実（`CI_JOB_TOKEN` で足りること、ブランチの最新のアーティファクトが期限後も残ること、リリース用ジョブで `npm ci` を省くこと）を含めた。
- `01.Architecture.md` の技術スタックに「CI・リリース」の行を追加した。
- `00.Overview.md` のドキュメントマップ（ツリーとリンク）と、`docs/architecture/README.md` の文書一覧に 05 を追加した。
- 検証: `check-docs`（OK）。`docs/architecture/` 内の相対リンクがすべて存在することを確認した。

### 判断とその理由（マスタードキュメントへの反映）

- ビルド・CI・リリースは既存の 01〜04 のいずれの関心事にも収まらないため、新しい文書（05）にした。
- `AGENTS.md` のプロジェクト固有欄の技術スタックが「minAppVersion 1.0.0」のまま（Item 0004 で 1.1.0 に変更済み）になっていることに気づいた。この Item の範囲外のため直していない（ユーザーに報告する）。

### 作業ログ（固定 Task：ADR の要否判断）

- ADR は **必要** と判断し、`docs/adr/0003-release-via-node-script-and-package-registry.md` を作成した（Status: Proposed）。

### 判断とその理由（ADR の要否判断）

- 「GitLab 標準の `release-cli` を使わず、Node.js のスクリプトと `CI_JOB_TOKEN` でリリースを作る」「配布物を Generic Package Registry に置く」は、代替案から選んだ判断で、リリースの手順や使う GitLab の機能を制約するため、後から理由を説明する必要がある。2つは同じ設計領域（リリースの仕組み）の判断のため、1件の ADR にまとめた。
- パイプラインの対象、アーティファクトの保存期間、CHANGELOG の形式などの仕様上の決定は、requirements とマスタードキュメント（05）に記載済みで、ADR にはしていない。
- ADR の Status は、process の規約に従い Proposed で作成した。ユーザーの承認後に Accepted にする。

### 中断点（ADR の要否判断の終了時点）

- tasks.md の全 Task が完了した。ADR 0003 の承認（Accepted への変更）を待つ。
- 次の工程は、別のコンテキストでの AI レビュー（self-review）。

### 作業ログ（ADR 0003 の承認と AGENTS.md の修正）

- ユーザーが ADR 0003 を承認したため、Status を Proposed から Accepted に変更した。
- ユーザーの指示（「ついでに直す」）により、`AGENTS.md` のプロジェクト固有欄（標準管理領域の外）の技術スタックの `minAppVersion 1.0.0` を `1.1.0` に直した（Item 0004 で変更済みの事実に合わせる）。
- 検証: `check-docs`（OK）。

### 中断点（次に何をすべきか）

- ユーザーが別のコンテキストで AI レビュー（self-review）を行う。

## 2026-10-22（レビュー）

### 作業ログ

- 別のコンテキストで AI レビュー（self-review、レビュアー: Gemini、対象: impl）が行われ、`reviews/2026-10-22-impl-ai.md` が作成された。Finding は0件（指摘なし）。
- 人のレビューも指摘なし（ユーザーの報告による）。指摘がないため、人のレビューの Review ファイルは作成していない。

### 中断点（次に何をすべきか）

- マージ前の close-item、push、pr-draft。
