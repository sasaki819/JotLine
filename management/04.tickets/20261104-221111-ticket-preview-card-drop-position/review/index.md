# レビュー記録

## レビュー実施記録

| フェーズ | ラウンド | 種別 | 日時 | 比較基点 | 実施者 | 実行環境 | 未確認事項 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| implementation | round1 | 初回レビュー | 2026-11-28 23:27:48 | 6d06cbf0fcbb1106a3de19730056c0864e1a1859 | independent-worker(self) | Linux 7.0.0-44-generic / Node.js v24.13.1 / Vitest 14ファイル156件PASS / tsc PASS / aico doctor PASS | Obsidian実機目視確認（事前合意対象外）、npm run build（読み取り専用制約のためレビュアー未実行） |
| implementation | round1 | 再レビュー | 2026-11-28 23:30:07 | 6d06cbf0fcbb1106a3de19730056c0864e1a1859 | independent-worker(self) | Linux 7.0.0-44-generic / Node.js v24.13.1 / Vitest 14ファイル158件PASS / tsc PASS / aico doctor PASS | Obsidian実機目視確認（事前合意対象外）、npm run build（読み取り専用制約のため再確認ワーカー未実行・本体側で通過確認済み） |

## 指摘一覧

<!-- AICO:AUTO:BEGIN:findings -->

| 指摘ID | タイトル | 重要度 | 状態 | 更新日時 |
| :--- | :--- | :--- | :--- | :--- |
| [implementation-round1-001-drop-does-not-end-drag-session](findings/implementation-round1-001-drop-does-not-end-drag-session.md) | グループ間・別ファイルへのドロップ完了時にドラッグセッションが終了せず .is-dragging 等が残留する | major | done | 2026-11-28 23:31:00 |
| [implementation-round1-002-invalid-dragover-filtered-clear-leaves-stale-preview](findings/implementation-round1-002-invalid-dragover-filtered-clear-leaves-stale-preview.md) | 無効なドロップ先への dragover でフィルタ付き clearDropPreview を呼ぶため別ビューのプレビューが残留し得る | minor | done | 2026-11-28 23:31:00 |

<!-- AICO:AUTO:END:findings -->
